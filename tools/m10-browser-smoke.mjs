import { chromium, firefox, webkit } from '@playwright/test';

const baseUrl = process.env.M10_BASE_URL ?? 'http://localhost:4173/';
const screenshots = {
  menu: '/tmp/rock-to-rack-m10-menu.png',
  ch1: '/tmp/rock-to-rack-m10-ch1.png',
  mobileCh6: '/tmp/rock-to-rack-m10-ch6-mobile.png',
  ipadMenu: '/tmp/rock-to-rack-m10-ipad-menu.png',
  ipadCh1: '/tmp/rock-to-rack-m10-ipad-ch1.png'
};
const viewportCases = {
  desktop: { viewport: { width: 1280, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ipad: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function fullUrl(path = '') {
  return new URL(path, baseUrl).toString();
}

async function launchChromium() {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

function watchPage(page, label, issues) {
  page.on('console', (message) => {
    const locationUrl = message.location().url;
    if (message.type() === 'error') {
      issues.push(`[${label}] console error: ${message.text()} at ${locationUrl}`);
    }
  });
  page.on('pageerror', (error) => {
    issues.push(`[${label}] page error: ${error.message}`);
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400) {
      issues.push(`[${label}] network ${status}: ${url}`);
    }
  });
}

async function waitForGame(page) {
  await page.waitForSelector('canvas', { timeout: 10_000 });
  await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10_000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect();
    return Boolean(rect && rect.width > 100 && rect.height > 100);
  }, { timeout: 10_000 });
}

async function expectMetadata(page) {
  const metadata = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
    favicon: document.querySelector('link[rel="icon"]')?.getAttribute('href'),
    fallbackIcon: document.querySelector('link[rel="alternate icon"]')?.getAttribute('href')
  }));

  assert(metadata.title === 'Rock to Rack', `Unexpected title ${metadata.title}`);
  assert(metadata.description?.includes('semiconductor'), 'Missing semiconductor description');
  assert(metadata.ogImage === '/og-cover.svg', `Unexpected og:image ${metadata.ogImage}`);
  assert(metadata.manifest === '/site.webmanifest', `Unexpected manifest ${metadata.manifest}`);
  assert(metadata.favicon === '/favicon.svg', `Unexpected favicon ${metadata.favicon}`);
  assert(metadata.fallbackIcon === '/favicon.ico', `Unexpected fallback icon ${metadata.fallbackIcon}`);
}

async function runMenuAndChapterSmoke(viewport, label, menuScreenshotPath, ch1ScreenshotPath) {
  const issues = [];
  const browser = await launchChromium();
  try {
    const context = await browser.newContext(viewport);
    const page = await context.newPage();
    watchPage(page, label, issues);
    await page.goto(fullUrl('#menu'), { waitUntil: 'domcontentloaded' });
    await waitForGame(page);
    await expectMetadata(page);
    await page.screenshot({ path: menuScreenshotPath, fullPage: true });

    await page.getByRole('button', { name: 'Learn Mode' }).click();
    await page.waitForURL(/#ch1$/, { timeout: 10_000 });
    await waitForGame(page);
    const ch1Heading = await page.locator('body').textContent();
    assert(ch1Heading?.includes('Quartz') || ch1Heading?.includes('Mine'), 'Ch1 did not expose expected chapter UI text');
    await page.screenshot({ path: ch1ScreenshotPath, fullPage: true });
    await context.close();
  } finally {
    await browser.close();
  }

  if (issues.length > 0) {
    throw new Error(`${label} smoke issues:\n${issues.join('\n')}`);
  }
}

async function runMobileSmoke() {
  const issues = [];
  const browser = await launchChromium();
  try {
    const context = await browser.newContext(viewportCases.mobile);
    const page = await context.newPage();
    watchPage(page, 'mobile', issues);
    await page.goto(fullUrl('?reset#ch6'), { waitUntil: 'domcontentloaded' });
    await waitForGame(page);
    await page.getByRole('button', { name: 'Codex' }).first().click();
    await page.waitForSelector('.codex-backdrop', { timeout: 5_000 });
    await page.getByRole('button', { name: 'Close' }).first().click();
    await page.waitForSelector('.codex-backdrop', { state: 'detached', timeout: 5_000 });
    await page.getByRole('button', { name: 'Settings' }).first().click();
    await page.waitForSelector('.settings-backdrop', { timeout: 5_000 });
    await page.screenshot({ path: screenshots.mobileCh6, fullPage: true });
    await context.close();
  } finally {
    await browser.close();
  }

  if (issues.length > 0) {
    throw new Error(`Mobile smoke issues:\n${issues.join('\n')}`);
  }
}

async function optionalBrowserSmoke(browserType, name) {
  try {
    const browser = await browserType.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(fullUrl('#menu'), { waitUntil: 'domcontentloaded' });
    await waitForGame(page);
    await browser.close();
    return { name, status: 'pass' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const unavailable = reason.includes('Executable doesn') || reason.includes('is not installed') || reason.includes('could not find');
    return { name, status: unavailable ? 'unavailable' : 'failed', reason };
  }
}

await runMenuAndChapterSmoke(viewportCases.desktop, 'desktop', screenshots.menu, screenshots.ch1);
await runMenuAndChapterSmoke(viewportCases.ipad, 'ipad', screenshots.ipadMenu, screenshots.ipadCh1);
await runMobileSmoke();
const optional = [
  await optionalBrowserSmoke(firefox, 'firefox'),
  await optionalBrowserSmoke(webkit, 'webkit')
];

console.log(JSON.stringify({ status: 'pass', url: baseUrl, screenshots, optional }, null, 2));
