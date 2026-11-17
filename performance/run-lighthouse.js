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

function findBrowserPath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const candidates = [
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];

    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const playwrightDir = path.join(localAppData, 'ms-playwright');
    if (fs.existsSync(playwrightDir)) {
      const entries = fs.readdirSync(playwrightDir);
      for (const entry of entries) {
        if (entry.startsWith('chromium-')) {
          const pwChrome = path.join(playwrightDir, entry, 'chrome-win64', 'chrome.exe');
          if (fs.existsSync(pwChrome)) {
            return pwChrome;
          }
        }
      }
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

  const env = { ...process.env };
  const detectedBrowser = findBrowserPath();
  if (detectedBrowser && !env.CHROME_PATH) {
    env.CHROME_PATH = detectedBrowser;
    console.log(`Navegador Chromium detectado: ${detectedBrowser}`);
  }

  const lighthouseCli = require.resolve('lighthouse/cli/index.js');
  const args = [
    lighthouseCli,
    targetUrl,
    '--output=html',
    `--output-path=${OUTPUT_PATH}`,
    '--chrome-flags=--headless --no-sandbox',
  ];

  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env,
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
