import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const dist = join(process.cwd(), 'dist');
const assets = join(dist, 'assets');
const maxBundleBytes = 5 * 1024 * 1024;
let totalBytes = statSync(join(dist, 'index.html')).size;

for (const file of ['favicon.svg', 'favicon.ico', 'og-cover.svg', 'site.webmanifest', 'sw.js', '404.html']) {
  totalBytes += statSync(join(dist, file)).size;
}

for (const file of readdirSync(assets)) {
  totalBytes += statSync(join(assets, file)).size;
}

if (totalBytes > maxBundleBytes) {
  throw new Error(`Dist size ${totalBytes} exceeds ${maxBundleBytes}`);
}

const baseUrl = process.env.M10_BASE_URL ?? 'http://localhost:4173/';
const browser = await launchChromium();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1
});
const page = await context.newPage();
const startedAt = Date.now();
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 10_000 });
await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10_000 });
const firstPlayableMs = Date.now() - startedAt;
await browser.close();

if (firstPlayableMs > 5_000) {
  throw new Error(`First playable took ${firstPlayableMs}ms`);
}

console.log(JSON.stringify({ status: 'pass', totalBytes, firstPlayableMs }, null, 2));

async function launchChromium() {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    return await chromium.launch({ headless: true });
  }
}
