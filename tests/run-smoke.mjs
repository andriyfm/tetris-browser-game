#!/usr/bin/env node
/* ============================================================
   RUNNER SMOKE TEST — headless Chromium (Playwright)

   Menjalankan tests/smoke.console.js persis seperti ditempel di
   Console browser, lalu gagal (exit 1) kalau:
     - ada cek yang FAIL / IIFE tidak mengembalikan true
     - ada console.error atau error JS (pageerror) di halaman
     - ada request file lokal yang gagal (404 dsb.)

   Pemakaian:
     npm install --no-save playwright
     npx playwright install chromium
     node tests/run-smoke.mjs

   Tanpa BASE_URL, runner menyalakan static server kecil sendiri
   (tanpa dependency). Dengan BASE_URL (mis. di CI), runner
   memakai server yang sudah jalan:
     BASE_URL=http://127.0.0.1:8000 node tests/run-smoke.mjs

   Opsional: CHROME_PATH=/usr/bin/google-chrome untuk memakai
   Chrome yang sudah terpasang alih-alih Chromium Playwright.
   ============================================================ */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SMOKE = join(ROOT, 'tests', 'smoke.console.js');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (e) {
  console.error('Playwright belum terpasang. Jalankan dulu:\n' +
    '  npm install --no-save playwright\n' +
    '  npx playwright install chromium');
  process.exit(2);
}

/* ---------- static server mini (hanya kalau BASE_URL kosong) ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(ROOT, path));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const st = await stat(file);
      if (!st.isFile()) throw new Error('bukan file');
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
    } catch (e) {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

let server = null;
let base = process.env.BASE_URL;
if (!base) {
  server = await startServer();
  base = 'http://127.0.0.1:' + server.address().port;
}
base = base.replace(/\/+$/, '');

const launchOpts = { headless: true };
if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

const pageErrors = [];
const logs = [];

page.on('console', (msg) => {
  const text = msg.text();
  logs.push(text);
  if (msg.type() === 'error') pageErrors.push('console.error: ' + text);
});
page.on('pageerror', (err) => pageErrors.push('pageerror: ' + err.message));
page.on('requestfailed', (req) => {
  pageErrors.push('requestfailed: ' + req.url() + ' (' + (req.failure() || {}).errorText + ')');
});
page.on('response', (resp) => {
  if (resp.url().startsWith(base) && resp.status() >= 400) {
    pageErrors.push('HTTP ' + resp.status() + ': ' + resp.url());
  }
});

let passed = false;
try {
  await page.goto(base + '/index.html?debug=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.def, null, { timeout: 10000 });

  const src = await readFile(SMOKE, 'utf8');
  const result = await page.evaluate(src);

  const passCount = logs.filter((l) => l.includes('PASS')).length;
  const failLines = logs.filter((l) => l.includes('FAIL'));

  for (const l of logs) console.log(l);
  console.log('\nRingkasan: ' + passCount + ' PASS, ' + failLines.length + ' FAIL, hasil IIFE = ' + JSON.stringify(result));

  passed = result === true && failLines.length === 0 && passCount > 0;
} catch (e) {
  console.error('Runner error: ' + (e && e.stack || e));
}

if (pageErrors.length) {
  console.error('\nError di halaman (' + pageErrors.length + '):');
  for (const e of pageErrors) console.error('  - ' + e);
  passed = false;
}

await browser.close();
if (server) server.close();

console.log(passed ? '\n✅ Smoke test lulus' : '\n❌ Smoke test gagal');
process.exit(passed ? 0 : 1);
