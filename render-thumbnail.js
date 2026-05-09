/**
 * Render mockups/thumbnail/ → /thumbnail.png at 1024×1024.
 *
 * Spawns its own python3 http.server on a free port so the script is
 * self-contained (doesn't depend on the dev server already running).
 *
 * Usage:  node render-thumbnail.js
 */
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { writeFileSync } from 'fs';

const require = createRequire(import.meta.url);
const puppeteer = require('/usr/local/lib/node_modules/puppeteer');
const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 8786;

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], {
    cwd: __dirname, stdio: 'pipe',
  });
  // Give the server a moment to bind.
  await new Promise((r) => setTimeout(r, 800));

  let exitCode = 0;
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--enable-webgl',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--disable-gpu-sandbox',
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1024 });
    await page.goto(`http://localhost:${PORT}/mockups/thumbnail/`, {
      waitUntil: 'networkidle0',
    });
    // Wait for the mockup to confirm at least one render has completed.
    await page.waitForFunction(() => window.__rendered === true, { timeout: 5000 });
    // Small extra delay so any post-render async imports settle.
    await new Promise((r) => setTimeout(r, 300));

    // Pull the underlying 1024×1024 canvas as a data URL, decode, and
    // write to disk. Going through the canvas API guarantees we get the
    // full-resolution buffer (the CSS-displayed canvas is only 600×600).
    const dataUrl = await page.evaluate(() => {
      const c = document.getElementById('thumb');
      return c.toDataURL('image/png');
    });
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    const out = resolve(__dirname, 'thumbnail.png');
    writeFileSync(out, buf);
    console.log(`Wrote ${out} (${buf.length} bytes)`);
  } catch (err) {
    console.error('Render failed:', err);
    exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
  process.exit(exitCode);
})();
