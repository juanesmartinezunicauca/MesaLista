const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const CANDIDATE_PORTS = [4200, 5173];
const REPORTS_DIR = path.resolve(process.cwd(), 'performance', 'reports');
const OUTPUT_PATH = './performance/reports/reporte-frontend.html';

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: 'localhost',
        port,
        path: '/',
        timeout: 2000,
      },
      (res) => {
        res.resume();
        resolve(true);
      },
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function detectFrontendPort() {
  for (const port of CANDIDATE_PORTS) {
    const isOpen = await checkPort(port);
    if (isOpen) {
      return port;
    }
  }
  return null;
}

async function main() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  console.log('Verificando puerto del frontend local (4200 o 5173)...');
  const port = await detectFrontendPort();

  if (!port) {
    console.error(
      'Error: No se detecto el servidor del frontend escuchando en http://localhost:4200 ni en http://localhost:5173.',
    );
    console.error('Inicia el frontend antes de ejecutar esta prueba (por ejemplo: npm run start:frontend).');
    process.exit(1);
  }

  const targetUrl = `http://localhost:${port}`;
  console.log(`Frontend detectado en ${targetUrl}. Ejecutando Lighthouse...`);

  const isWin = process.platform === 'win32';
  const command = isWin ? 'npx.cmd' : 'npx';
  const chromeFlagsArg = isWin
    ? '--chrome-flags="--headless --no-sandbox"'
    : '--chrome-flags=--headless --no-sandbox';
  const args = [
    'lighthouse',
    targetUrl,
    '--output=html',
    `--output-path=${OUTPUT_PATH}`,
    chromeFlagsArg,
  ];

  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: isWin,
  });

  child.on('error', (err) => {
    console.error('Error al ejecutar Lighthouse:', err.message);
    process.exit(1);
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log(`\nReporte HTML generado exitosamente en: ${path.resolve(OUTPUT_PATH)}`);
    }
    process.exit(code ?? 1);
  });
}

main();
