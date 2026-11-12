const fs = require('node:fs');
const path = require('node:path');

const INPUT_PATH = path.resolve(process.cwd(), 'performance', 'reports', 'backend-results.json');
const OUTPUT_PATH = path.resolve(process.cwd(), 'performance', 'reports', 'reporte-backend.html');
const P95_THRESHOLD_MS = Number(process.env.PERF_P95_THRESHOLD_MS) || 1000;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMs(val) {
  if (val === undefined || val === null || Number.isNaN(Number(val))) {
    return 'N/A';
  }
  return `${Number(val).toFixed(1)} ms`;
}

function formatNum(val, decimals = 0) {
  if (val === undefined || val === null || Number.isNaN(Number(val))) {
    return '0';
  }
  return Number(val).toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function extractMetrics(raw) {
  const aggregate = raw.aggregate || {};
  const counters = aggregate.counters || {};
  const rates = aggregate.rates || {};
  const summaries = aggregate.summaries || aggregate.histograms || {};

  const totalRequests = counters['http.requests'] ?? counters['http.responses'] ?? 0;

  let durationSec = 0;
  if (aggregate.firstCounterAt && aggregate.lastCounterAt && aggregate.lastCounterAt > aggregate.firstCounterAt) {
    durationSec = (aggregate.lastCounterAt - aggregate.firstCounterAt) / 1000;
  } else if (Array.isArray(raw.intermediate) && raw.intermediate.length > 0) {
    durationSec = raw.intermediate.length * 10;
  }

  let rps = rates['http.request_rate'];
  if ((rps === undefined || rps === null) && durationSec > 0) {
    rps = totalRequests / durationSec;
  }
  if ((rps === undefined || rps === null) && Array.isArray(raw.intermediate) && raw.intermediate.length > 0) {
    const rateValues = raw.intermediate
      .map((item) => item.rates && item.rates['http.request_rate'])
      .filter((v) => typeof v === 'number');
    if (rateValues.length > 0) {
      rps = rateValues.reduce((a, b) => a + b, 0) / rateValues.length;
    }
  }

  const responseTime = summaries['http.response_time'] || {};

  // Desglose de códigos HTTP
  let code200 = 0;
  let code2xx = 0;
  let code4xx = 0;
  let code5xx = 0;
  let code500 = 0;
  let networkErrors = 0;
  const statusBreakdown = {};

  for (const [key, value] of Object.entries(counters)) {
    if (key.startsWith('http.codes.')) {
      const codeStr = key.slice('http.codes.'.length);
      const codeNum = Number.parseInt(codeStr, 10);
      statusBreakdown[codeStr] = (statusBreakdown[codeStr] || 0) + value;

      if (codeNum === 200) code200 += value;
      if (codeNum >= 200 && codeNum < 300) code2xx += value;
      else if (codeNum >= 400 && codeNum < 500) code4xx += value;
      else if (codeNum >= 500 && codeNum < 600) {
        code5xx += value;
        if (codeNum === 500) code500 += value;
      }
    } else if (key.startsWith('errors.')) {
      networkErrors += value;
    }
  }

  // Métricas por endpoint (Artillery plugin metrics-by-endpoint)
  const endpointsMap = new Map();
  const ensureEndpoint = (endpoint) => {
    if (!endpointsMap.has(endpoint)) {
      endpointsMap.set(endpoint, {
        endpoint,
        requests: 0,
        code2xx: 0,
        code4xx: 0,
        code5xx: 0,
        codes: {},
        summary: null,
      });
    }
    return endpointsMap.get(endpoint);
  };

  const summaryPrefix = 'plugins.metrics-by-endpoint.response_time.';
  for (const [key, summary] of Object.entries(summaries)) {
    if (key.startsWith(summaryPrefix)) {
      const endpoint = key.slice(summaryPrefix.length);
      const entry = ensureEndpoint(endpoint);
      entry.summary = summary;
      if (!entry.requests && typeof summary.count === 'number') {
        entry.requests = summary.count;
      }
    }
  }

  const counterPrefix = 'plugins.metrics-by-endpoint.';
  for (const [key, value] of Object.entries(counters)) {
    if (!key.startsWith(counterPrefix)) continue;
    const rest = key.slice(counterPrefix.length);
    const codesIdx = rest.lastIndexOf('.codes.');
    if (codesIdx !== -1) {
      const endpoint = rest.slice(0, codesIdx);
      const codeStr = rest.slice(codesIdx + '.codes.'.length);
      const codeNum = Number.parseInt(codeStr, 10);
      const entry = ensureEndpoint(endpoint);
      entry.codes[codeStr] = (entry.codes[codeStr] || 0) + value;
      if (codeNum >= 200 && codeNum < 300) entry.code2xx += value;
      else if (codeNum >= 400 && codeNum < 500) entry.code4xx += value;
      else if (codeNum >= 500 && codeNum < 600) entry.code5xx += value;
    }
  }

  for (const entry of endpointsMap.values()) {
    const totalFromCodes = Object.values(entry.codes).reduce((a, b) => a + b, 0);
    if (totalFromCodes > 0) {
      entry.requests = totalFromCodes;
    }
  }

  const endpoints = Array.from(endpointsMap.values()).sort((a, b) =>
    a.endpoint.localeCompare(b.endpoint),
  );

  return {
    generatedAt: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
    durationSec,
    totalRequests,
    rps: rps ?? 0,
    responseTime,
    code200,
    code2xx,
    code4xx,
    code5xx,
    code500,
    networkErrors,
    statusBreakdown,
    endpoints,
  };
}

function buildHtml(metrics) {
  const p95 = metrics.responseTime.p95;
  const p95Ok = typeof p95 === 'number' ? p95 < P95_THRESHOLD_MS : false;
  const err500Ok = metrics.code500 === 0 && metrics.code5xx === 0;
  const overallPass = p95Ok && err500Ok && metrics.networkErrors === 0;

  const statusRows = Object.entries(metrics.statusBreakdown)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([code, count]) =>
        `<span class="badge ${
          code.startsWith('2') ? 'badge-ok' : code.startsWith('4') ? 'badge-warn' : 'badge-err'
        }">HTTP ${escapeHtml(code)}: <strong>${formatNum(count)}</strong></span>`,
    )
    .join(' ');

  const endpointRowsHtml =
    metrics.endpoints.length > 0
      ? metrics.endpoints
          .map((ep) => {
            const s = ep.summary || {};
            const epP95Ok = typeof s.p95 === 'number' ? s.p95 < P95_THRESHOLD_MS : true;
            const epErrOk = ep.code5xx === 0;
            return `
              <tr>
                <td class="mono">${escapeHtml(ep.endpoint)}</td>
                <td class="num">${formatNum(ep.requests)}</td>
                <td class="num ok">${formatNum(ep.code2xx)}</td>
                <td class="num ${ep.code4xx > 0 ? 'warn' : ''}">${formatNum(ep.code4xx)}</td>
                <td class="num ${ep.code5xx > 0 ? 'err' : ''}">${formatNum(ep.code5xx)}</td>
                <td class="num">${formatMs(s.min)}</td>
                <td class="num">${formatMs(s.mean)}</td>
                <td class="num ${epP95Ok ? 'ok' : 'err'}"><strong>${formatMs(s.p95)}</strong></td>
                <td class="num">${formatMs(s.p99)}</td>
                <td class="num">${formatMs(s.max)}</td>
                <td>
                  <span class="pill ${epP95Ok && epErrOk ? 'pill-pass' : 'pill-fail'}">
                    ${epP95Ok && epErrOk ? 'CUMPLE' : 'ALERTA'}
                  </span>
                </td>
              </tr>`;
          })
          .join('')
      : `
        <tr>
          <td colspan="11" class="empty">
            No se registraron métricas desglosadas por endpoint en el archivo JSON.
          </td>
        </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reporte de Rendimiento Backend — MesaLista</title>
  <style>
    :root {
      --bg: #0f172a;
      --surface: #1e293b;
      --surface-2: #0b1220;
      --border: #334155;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --ok: #22c55e;
      --ok-bg: rgba(34, 197, 94, 0.14);
      --warn: #f59e0b;
      --warn-bg: rgba(245, 158, 11, 0.14);
      --err: #ef4444;
      --err-bg: rgba(239, 68, 68, 0.16);
      --accent: #38bdf8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 2rem 1.25rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.75rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border);
    }
    h1 {
      margin: 0;
      font-size: 1.65rem;
      letter-spacing: -0.02em;
    }
    .subtitle {
      margin: 0.25rem 0 0;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .status-banner {
      padding: 0.6rem 1.15rem;
      border-radius: 999px;
      font-weight: 700;
      font-size: 0.9rem;
      letter-spacing: 0.03em;
    }
    .status-pass {
      background: var(--ok-bg);
      color: var(--ok);
      border: 1px solid rgba(34, 197, 94, 0.35);
    }
    .status-fail {
      background: var(--err-bg);
      color: var(--err);
      border: 1px solid rgba(239, 68, 68, 0.4);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(195px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.15rem 1.25rem;
    }
    .card-label {
      color: var(--muted);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
    }
    .card-value {
      margin-top: 0.45rem;
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text);
    }
    .card-sub {
      margin-top: 0.3rem;
      font-size: 0.82rem;
      color: var(--muted);
    }
    .ok { color: var(--ok); }
    .warn { color: var(--warn); }
    .err { color: var(--err); }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .panel h2 {
      margin: 0 0 1rem;
      font-size: 1.12rem;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
    }
    .badge {
      padding: 0.45rem 0.85rem;
      border-radius: 8px;
      font-size: 0.9rem;
      border: 1px solid var(--border);
      background: var(--surface-2);
    }
    .badge-ok { border-color: rgba(34, 197, 94, 0.35); color: var(--ok); }
    .badge-warn { border-color: rgba(245, 158, 11, 0.35); color: var(--warn); }
    .badge-err { border-color: rgba(239, 68, 68, 0.4); color: var(--err); }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    th, td {
      padding: 0.75rem 0.65rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    th {
      color: var(--muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    td.num, th.num {
      text-align: right;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: var(--accent);
    }
    .pill {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .pill-pass {
      background: var(--ok-bg);
      color: var(--ok);
    }
    .pill-fail {
      background: var(--err-bg);
      color: var(--err);
    }
    .empty {
      text-align: center;
      color: var(--muted);
      padding: 1.5rem;
    }
    footer {
      text-align: center;
      color: var(--muted);
      font-size: 0.82rem;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Reporte de Pruebas de Carga — Backend MesaLista</h1>
        <p class="subtitle">
          Generado el ${escapeHtml(metrics.generatedAt)} · Duración efectiva: ${metrics.durationSec.toFixed(1)} s
        </p>
      </div>
      <div class="status-banner ${overallPass ? 'status-pass' : 'status-fail'}">
        ${overallPass ? 'UMBRALES SUPERADOS (PASS)' : 'UMBRALES INCUMPLIDOS (FAIL)'}
      </div>
    </header>

    <section class="grid">
      <div class="card">
        <div class="card-label">Total de Peticiones</div>
        <div class="card-value">${formatNum(metrics.totalRequests)}</div>
        <div class="card-sub">Solicitudes HTTP enviadas</div>
      </div>

      <div class="card">
        <div class="card-label">Rendimiento (RPS)</div>
        <div class="card-value">${formatNum(metrics.rps, 1)} req/s</div>
        <div class="card-sub">Tasa promedio de peticiones</div>
      </div>

      <div class="card">
        <div class="card-label">Latencia Promedio</div>
        <div class="card-value">${formatMs(metrics.responseTime.mean)}</div>
        <div class="card-sub">Mediana (p50): ${formatMs(metrics.responseTime.median ?? metrics.responseTime.p50)}</div>
      </div>

      <div class="card">
        <div class="card-label">Latencia p95</div>
        <div class="card-value ${p95Ok ? 'ok' : 'err'}">${formatMs(p95)}</div>
        <div class="card-sub">Umbral objetivo: &lt; ${P95_THRESHOLD_MS} ms</div>
      </div>

      <div class="card">
        <div class="card-label">Latencia p99</div>
        <div class="card-value">${formatMs(metrics.responseTime.p99)}</div>
        <div class="card-sub">Máxima: ${formatMs(metrics.responseTime.max)}</div>
      </div>

      <div class="card">
        <div class="card-label">Códigos HTTP 200 / 4xx / 5xx</div>
        <div class="card-value" style="font-size: 1.25rem;">
          <span class="ok">${formatNum(metrics.code200)}</span> /
          <span class="${metrics.code4xx > 0 ? 'warn' : ''}">${formatNum(metrics.code4xx)}</span> /
          <span class="${metrics.code5xx > 0 ? 'err' : 'ok'}">${formatNum(metrics.code5xx)}</span>
        </div>
        <div class="card-sub">Errores de red/timeout: ${formatNum(metrics.networkErrors)}</div>
      </div>
    </section>

    <section class="panel">
      <h2>Desglose de Códigos HTTP</h2>
      <div class="badges">
        <span class="badge badge-ok">2xx (Éxito): <strong>${formatNum(metrics.code2xx)}</strong></span>
        <span class="badge ${metrics.code4xx > 0 ? 'badge-warn' : ''}">4xx (Cliente): <strong>${formatNum(metrics.code4xx)}</strong></span>
        <span class="badge ${metrics.code5xx > 0 ? 'badge-err' : 'badge-ok'}">5xx (Servidor): <strong>${formatNum(metrics.code5xx)}</strong></span>
        ${statusRows}
      </div>
    </section>

    <section class="panel">
      <h2>Resultados por Endpoint</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Endpoint</th>
              <th class="num">Peticiones</th>
              <th class="num">2xx</th>
              <th class="num">4xx</th>
              <th class="num">5xx</th>
              <th class="num">Mín</th>
              <th class="num">Promedio</th>
              <th class="num">p95</th>
              <th class="num">p99</th>
              <th class="num">Máx</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${endpointRowsHtml}
          </tbody>
        </table>
      </div>
    </section>

    <footer>
      MesaLista Performance Suite · Artillery Load Testing &amp; Node.js Report Generator
    </footer>
  </div>
</body>
</html>`;
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Error: No se encontró el archivo de resultados en ${INPUT_PATH}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  const metrics = extractMetrics(raw);
  const html = buildHtml(metrics);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
  console.log(`Reporte HTML de backend generado exitosamente en: ${OUTPUT_PATH}`);
}

main();

