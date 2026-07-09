import { chromium } from '@playwright/test';

const baseUrl = process.env.M12_BASE_URL ?? 'http://localhost:4173/';
const screenshotPath = '/tmp/rock-to-rack-m12-replay-result.png';
const ipadScreenshotPath = '/tmp/rock-to-rack-m12-replay-ipad.png';
const viewportCases = {
  desktop: { viewport: { width: 1280, height: 900 } },
  ipad: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }
};

function fullUrl(path = '') {
  return new URL(path, baseUrl).toString();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function launchChromium() {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

async function waitForGame(page) {
  await page.waitForSelector('canvas', { timeout: 10_000 });
  await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10_000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect();
    return Boolean(rect && rect.width > 100 && rect.height > 100);
  }, { timeout: 10_000 });
  await page.waitForSelector('.crisis-overlay', { timeout: 10_000 });
  await page.waitForTimeout(700);
}

async function clickGame(page, gameX, gameY) {
  const rect = await page.locator('canvas').evaluate((canvas) => {
    const bounds = canvas.getBoundingClientRect();
    return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
  });
  await page.mouse.click(rect.left + (gameX / 1280) * rect.width, rect.top + (gameY / 720) * rect.height);
}

async function completeRun(page) {
  const placements = [
    { label: 'Rack', x: 430, y: 260 },
    { label: 'Power', x: 534, y: 260 },
    { label: 'Cooling', x: 638, y: 260 },
    { label: 'Network', x: 742, y: 260 }
  ];

  for (const placement of placements) {
    await page.getByRole('button', { name: placement.label }).click();
    await clickGame(page, placement.x, placement.y);
  }

  const serveDisabledBeforeChip = await page.getByRole('button', { name: 'Serve Nova' }).evaluate((button) => button.disabled);
  assert(serveDisabledBeforeChip, 'Crisis Run allowed completion before installing a campaign chip');
  await clickGame(page, 430, 260);
  await page.getByRole('button', { name: 'CPU' }).click();
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some((button) => button.textContent === 'Install chip' && !button.disabled);
  }, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Install chip' }).click();

  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some((button) => button.textContent === 'Serve Nova' && !button.disabled);
  }, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Serve Nova' }).click();
  await page.waitForSelector('.crisis-result-card', { timeout: 10_000 });
}

const browser = await launchChromium();
const issues = [];

try {
  const context = await browser.newContext(viewportCases.desktop);
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push(`console error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => issues.push(`page error: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      issues.push(`network ${response.status()}: ${response.url()}`);
    }
  });

  await page.goto(fullUrl('?reset#crisis'), { waitUntil: 'domcontentloaded' });
  await waitForGame(page);
  await completeRun(page);
  const firstResult = await page.locator('.crisis-result-card').textContent();
  assert(firstResult?.includes('Run 1'), 'First result did not show Run 1');
  assert(firstResult?.includes('Replay to beat'), 'First result did not show replay target');

  await page.getByRole('button', { name: /Replay to beat/ }).click();
  await page.waitForSelector('.crisis-result-card', { state: 'detached', timeout: 10_000 });
  await waitForGame(page);
  const serveDisabled = await page.getByRole('button', { name: 'Serve Nova' }).evaluate((button) => button.disabled);
  assert(serveDisabled, 'Replay did not reset Serve Nova to disabled');

  await completeRun(page);
  const secondResult = await page.locator('.crisis-result-card').textContent();
  assert(secondResult?.includes('Run 2'), 'Second result did not show Run 2');
  assert(secondResult?.includes('Replay to beat'), 'Second result did not show replay target');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await page.locator('.crisis-result-card .crisis-menu').click();
  await page.waitForSelector('.menu-shell', { timeout: 10_000 });
  const menuText = await page.locator('.menu-shell').textContent();
  assert(menuText?.includes('Best Crisis Run'), 'Menu did not show best Crisis Run after replay loop');

  const ipadContext = await browser.newContext(viewportCases.ipad);
  const ipadPage = await ipadContext.newPage();
  ipadPage.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push(`iPad console error: ${message.text()}`);
    }
  });
  ipadPage.on('pageerror', (error) => issues.push(`iPad page error: ${error.message}`));
  ipadPage.on('response', (response) => {
    if (response.status() >= 400) {
      issues.push(`iPad network ${response.status()}: ${response.url()}`);
    }
  });
  await ipadPage.goto(fullUrl('?reset#crisis'), { waitUntil: 'domcontentloaded' });
  await waitForGame(ipadPage);
  await ipadPage.waitForSelector('.crisis-overlay', { timeout: 10_000 });
  const rackButtonHeight = await ipadPage.getByRole('button', { name: 'Rack' }).evaluate((button) => button.getBoundingClientRect().height);
  assert(rackButtonHeight >= 40, `Rack button too short on iPad viewport: ${rackButtonHeight}`);
  await ipadPage.screenshot({ path: ipadScreenshotPath, fullPage: true });
  await ipadContext.close();

  await context.close();
} finally {
  await browser.close();
}

if (issues.length > 0) {
  throw new Error(`Replay smoke issues:\n${issues.join('\n')}`);
}

console.log(JSON.stringify({ status: 'pass', url: baseUrl, screenshot: screenshotPath, ipadScreenshot: ipadScreenshotPath }, null, 2));
