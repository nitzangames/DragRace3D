const puppeteer = require('/usr/local/lib/node_modules/puppeteer');
const path = require('path');

const HEADLESS_SHELL = '/Users/nitzanwilnai/.cache/puppeteer/chrome-headless-shell/mac_arm-148.0.7778.97/chrome-headless-shell-mac-arm64/chrome-headless-shell';

(async () => {
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
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('console', m => {
    if (m.type() === 'error') console.error('[console.error]', m.text());
  });
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8185/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  // Click START
  await page.click('#btn-start');
  await new Promise(r => setTimeout(r, 100));

  // Hold both buttons (gas + shift)
  await page.evaluate(() => {
    function pd(id, pointerId) {
      const e = document.getElementById(id);
      const r = e.getBoundingClientRect();
      e.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId, clientX: r.left + 10, clientY: r.top + 10,
        bubbles: true, cancelable: true, isPrimary: true, pressure: 0.5,
      }));
    }
    pd('gas-button', 1);
    pd('shift-button', 2);
  });

  // Wait through intro (2s) + staging hold (0.5s) + tree (1.2s) ≈ 3.7s, then a tad more
  await new Promise(r => setTimeout(r, 3900));

  // Release SHIFT (launch). Keep gas held.
  await page.evaluate(() => {
    const e = document.getElementById('shift-button');
    e.dispatchEvent(new PointerEvent('pointerup', {
      pointerId: 2, bubbles: true, cancelable: true,
    }));
  });

  // Wait ~1.5s into racing for visible motion
  await new Promise(r => setTimeout(r, 1500));

  const out = path.join('/tmp', 'dr3d-race-gate.png');
  await page.screenshot({ path: out });
  console.log('screenshot:', out);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
