const puppeteer = require('/usr/local/lib/node_modules/puppeteer');
const path = require('path');

(async () => {
  const HEADLESS_SHELL = '/Users/nitzanwilnai/.cache/puppeteer/chrome-headless-shell/mac_arm-148.0.7778.97/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: HEADLESS_SHELL,
    protocolTimeout: 120000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
    ],
  });
  const page = await browser.newPage();
  page.on('pageerror', err => console.error('[pageerror]', err.message));
  page.on('console', msg => { if (msg.type() === 'error') console.error('[console]', msg.text()); });
  await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 });
  // Use a port that's likely free; default 8084 may be busy.
  const PORT = process.env.DR3D_PORT || 8185;
  await page.goto('http://localhost:' + PORT + '/tests-visual/cars-gate.html', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  const out = path.join('/tmp', 'dr3d-cars-gate.png');
  await page.screenshot({ path: out, fullPage: true });
  console.log('screenshot:', out);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
