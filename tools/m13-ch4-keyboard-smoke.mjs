import { chromium } from '@playwright/test';

const baseUrl = process.env.M13_BASE_URL ?? 'http://localhost:4173/';
const screenshot = '/tmp/rock-to-rack-m13-ch4-keyboard.png';

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
}

async function clearBlockingOverlays(page) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await page.locator('.dialogue-shell').count()) {
      const next = page.locator('.dialogue-shell').getByRole('button', { name: /Next|Advance|Done|Close dialogue/ }).first();
      await next.click();
      await page.waitForTimeout(100);
      continue;
    }

    if (await page.locator('.fact-card').count()) {
      await page.locator('.fact-card').getByRole('button', { name: /Dismiss|Close/ }).first().click();
      await page.waitForTimeout(100);
      continue;
    }

    if (await page.locator('.event-card').count()) {
      await page.locator('.event-choice').first().click();
      await page.waitForTimeout(100);
      continue;
    }

    return;
  }

  throw new Error('Could not clear blocking instructional overlays');
}

async function pressAndSettle(page, key, delay = 120) {
  await page.keyboard.press(key);
  await page.waitForTimeout(delay);
  await clearBlockingOverlays(page);
}

async function completeWaferWithKeyboard(page, isFinalWafer) {
  await pressAndSettle(page, 'Space'); // coat pattern
  await pressAndSettle(page, 'n'); // expose
  await pressAndSettle(page, 'Space'); // flash
  await pressAndSettle(page, 'n'); // etch
  await page.keyboard.down('Space');
  await page.waitForTimeout(3_450);
  await page.keyboard.up('Space');
  await page.waitForTimeout(150);
  await clearBlockingOverlays(page);
  await pressAndSettle(page, 'n'); // dope
  await pressAndSettle(page, '1');
  await pressAndSettle(page, '2');
  await pressAndSettle(page, '3');
  await pressAndSettle(page, 'n'); // review
  await pressAndSettle(page, 'n'); // next wafer or quiz

  if (!isFinalWafer) {
    await clearBlockingOverlays(page);
  }
}

const browser = await launchChromium();
const issues = [];

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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

  await page.goto(fullUrl('?reset#ch4'), { waitUntil: 'domcontentloaded' });
  await waitForGame(page);
  await clearBlockingOverlays(page);

  await completeWaferWithKeyboard(page, false);
  await completeWaferWithKeyboard(page, true);

  await page.waitForSelector('.ch1-quiz-card', { timeout: 10_000 });
  await page.getByRole('button', { name: /Some tiny circuits|Some dies fail/ }).click();
  await page.waitForSelector('.ch1-complete-card', { timeout: 10_000 });
  const bodyText = await page.locator('body').textContent();
  assert(bodyText?.includes('Next: Package Chips'), 'Chapter 4 keyboard path did not reach completion');
  await page.screenshot({ path: screenshot, fullPage: true });
  await context.close();
} finally {
  await browser.close();
}

if (issues.length > 0) {
  throw new Error(`Chapter 4 keyboard smoke issues:\n${issues.join('\n')}`);
}

console.log(JSON.stringify({ status: 'pass', url: baseUrl, screenshot }, null, 2));
