import { chromium } from '@playwright/test';

const baseUrl = process.env.M11_BASE_URL ?? 'http://localhost:4173/';
const screenshots = {
  menu: '/tmp/rock-to-rack-m11-menu.png',
  crisis: '/tmp/rock-to-rack-m11-crisis.png',
  result: '/tmp/rock-to-rack-m11-result.png',
  mobile: '/tmp/rock-to-rack-m11-mobile.png',
  ipad: '/tmp/rock-to-rack-m11-ipad.png'
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

function watchPage(page, issues, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push(`[${label}] console error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    issues.push(`[${label}] page error: ${error.message}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      issues.push(`[${label}] network ${response.status()}: ${response.url()}`);
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

async function settleEntrance(page) {
  await page.waitForTimeout(700);
}

async function clickGame(page, gameX, gameY) {
  const rect = await page.locator('canvas').evaluate((canvas) => {
    const bounds = canvas.getBoundingClientRect();
    return {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height
    };
  });
  await page.mouse.click(
    rect.left + (gameX / 1280) * rect.width,
    rect.top + (gameY / 720) * rect.height
  );
}

async function ensureChipSelected(page, chipLabel) {
  const chipButton = page.getByRole('button', { name: chipLabel });
  await chipButton.waitFor({ state: 'visible', timeout: 10_000 });
  const selected = await chipButton.evaluate((button) => button.classList.contains('is-selected'));
  if (!selected) {
    await chipButton.click();
  }
  await page.waitForFunction((label) => {
    return Array.from(document.querySelectorAll('.crisis-chips button')).some((button) => {
      return button.textContent === label && button.classList.contains('is-selected');
    });
  }, chipLabel, { timeout: 10_000 });
}

async function runDesktopSmoke() {
  const issues = [];
  const browser = await launchChromium();
  try {
    const context = await browser.newContext(viewportCases.desktop);
    const page = await context.newPage();
    watchPage(page, issues, 'desktop');

    await page.goto(fullUrl('?reset#menu'), { waitUntil: 'domcontentloaded' });
    await waitForGame(page);
    await page.waitForSelector('.menu-shell', { timeout: 10_000 });
    await settleEntrance(page);
    await page.screenshot({ path: screenshots.menu, fullPage: true });
    await page.getByRole('button', { name: /(Play|Start )?Crisis Run/ }).click();
    await page.waitForURL(/#crisis$/, { timeout: 10_000 });
    await waitForGame(page);
    await page.waitForSelector('.crisis-overlay', { timeout: 10_000 });
    await settleEntrance(page);
    await page.screenshot({ path: screenshots.crisis, fullPage: true });

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
    await page.getByRole('button', { name: 'Serve Nova' }).waitFor({ state: 'visible', timeout: 10_000 });
    const serveDisabledBeforeChip = await page.getByRole('button', { name: 'Serve Nova' }).evaluate((button) => button.disabled);
    assert(serveDisabledBeforeChip, 'Crisis Run allowed completion before installing a campaign chip');
    await clickGame(page, 430, 260);
    await ensureChipSelected(page, 'CPU');
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some((button) => button.textContent === 'Install chip' && !button.disabled);
    }, { timeout: 10_000 });
    await page.getByRole('button', { name: 'Install chip' }).click();
    await page.getByRole('button', { name: 'Serve Nova' }).waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some((button) => button.textContent === 'Serve Nova' && !button.disabled);
    }, { timeout: 10_000 });
    await page.getByRole('button', { name: 'Serve Nova' }).click();
    await page.waitForSelector('.crisis-result-card', { timeout: 10_000 });
    const text = await page.locator('.crisis-result-card').textContent();
    assert(text?.includes('Grade'), 'Result card did not include grade');
    assert(text?.includes('Rock to Rack Crisis Run'), 'Result card did not include share line');
    await page.screenshot({ path: screenshots.result, fullPage: true });
    await context.close();
  } finally {
    await browser.close();
  }

  if (issues.length > 0) {
    throw new Error(`Desktop smoke issues:\n${issues.join('\n')}`);
  }
}

async function runIpadSmoke() {
  const issues = [];
  const browser = await launchChromium();
  try {
    const context = await browser.newContext(viewportCases.ipad);
    const page = await context.newPage();
    watchPage(page, issues, 'ipad');

    await page.goto(fullUrl('?reset#crisis'), { waitUntil: 'domcontentloaded' });
    await waitForGame(page);
    await page.waitForSelector('.crisis-overlay', { timeout: 10_000 });
    await settleEntrance(page);
    const rackButtonHeight = await page.getByRole('button', { name: 'Rack' }).evaluate((button) => button.getBoundingClientRect().height);
    assert(rackButtonHeight >= 40, `Rack button too short on iPad viewport: ${rackButtonHeight}`);
    await page.screenshot({ path: screenshots.ipad, fullPage: true });
    await context.close();
  } finally {
    await browser.close();
  }

  if (issues.length > 0) {
    throw new Error(`iPad smoke issues:\n${issues.join('\n')}`);
  }
}

async function runMobileSmoke() {
  const issues = [];
  const browser = await launchChromium();
  try {
    const context = await browser.newContext(viewportCases.mobile);
    const page = await context.newPage();
    watchPage(page, issues, 'mobile');
    await page.goto(fullUrl('?reset#crisis'), { waitUntil: 'domcontentloaded' });
    await waitForGame(page);
    await page.waitForSelector('.crisis-overlay', { timeout: 10_000 });
    await settleEntrance(page);
    const firstButtonHeight = await page.getByRole('button', { name: 'Rack' }).evaluate((button) => button.getBoundingClientRect().height);
    assert(firstButtonHeight >= 40, `Rack button too short: ${firstButtonHeight}`);
    await page.screenshot({ path: screenshots.mobile, fullPage: true });
    await context.close();
  } finally {
    await browser.close();
  }

  if (issues.length > 0) {
    throw new Error(`Mobile smoke issues:\n${issues.join('\n')}`);
  }
}

await runDesktopSmoke();
await runIpadSmoke();
await runMobileSmoke();

console.log(JSON.stringify({ status: 'pass', url: baseUrl, screenshots }, null, 2));
