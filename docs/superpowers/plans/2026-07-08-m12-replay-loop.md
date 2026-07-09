# M12 Replay Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Crisis Run replay worth pressing by adding best-score comparison, a clear next-run target, clean replay restart behavior, and a browser smoke test that completes two runs in one session.

**Architecture:** Keep replay logic in the existing Crisis Run slice instead of starting a second feature. Add pure comparison helpers to `src/sim/crisisRun.ts`, pass comparison metadata into the DOM result card, harden `CrisisRunScene` cleanup/restart behavior, and validate the loop through Vitest plus a new Playwright smoke script.

**Tech Stack:** Phaser 3.90, TypeScript, Vite, Vitest, Playwright, `corepack pnpm`.

---

## Intake Classification

TYPE: NEW_FEATURE
COMPLEXITY: MEDIUM
SCOPE: Crisis Run scoring helpers, result overlay, scene replay reset, smoke tests, docs
RISK: LOW

No git commit steps are included because `/Users/omar/Downloads/Game` is not a git repository.

## File Structure

- Modify `src/sim/crisisRun.ts`: add deterministic replay comparison metadata for first run, new best, matched best, and missed best.
- Modify `src/sim/crisisRun.test.ts`: cover comparison helper behavior and keep score tests stable.
- Modify `src/ui/crisisRunOverlay.ts`: show run number, best comparison, target score, and a replay button label that makes the next goal explicit.
- Modify `src/ui/crisisRunOverlay.test.ts`: verify comparison text and replay callback behavior.
- Modify `src/scenes/CrisisRunScene.ts`: pass previous best/run count into the result card, clean up timer and keyboard listeners, and reset modal state before replay/menu navigation.
- Create `tools/m12-replay-smoke.mjs`: browser smoke that finishes a run, clicks Replay, verifies the fresh run state, finishes again, and returns to menu with best-run text visible.
- Modify `package.json`: add `smoke:m12`.
- Modify `src/styles.css`: style the compact replay comparison text without increasing overlay weight.
- Modify `docs/agent-context.md`: append M12 status after implementation and verification.

---

### Task 1: Pure Replay Comparison Helper

**Files:**
- Modify: `src/sim/crisisRun.ts`
- Modify: `src/sim/crisisRun.test.ts`

- [ ] **Step 1: Add failing comparison tests**

Add these imports and tests to `src/sim/crisisRun.test.ts`:

```ts
import {
  bestCrisisRun,
  calculateCrisisRunScore,
  compareCrisisRunToBest,
  createCrisisRunResult,
  gradeForScore
} from './crisisRun';
```

```ts
it('describes a first replay target after the first run', () => {
  const result: CrisisRunResult = {
    runId: 'first',
    mode: 'crisis',
    completedAt: '2026-07-08T12:00:00.000Z',
    elapsedSeconds: 510,
    cityLights: 100,
    servedContracts: 4,
    powerEfficiency: 0.8,
    heatPeak: 55,
    mistakes: 1,
    score: 880,
    grade: 'A',
    shareLine: 'Rock to Rack Crisis Run: 880 points, grade A, 100% city lights online.'
  };

  expect(compareCrisisRunToBest(null, result)).toEqual({
    status: 'first-run',
    bestScore: null,
    deltaFromPreviousBest: null,
    targetScore: 881,
    headline: 'First run scored 880',
    detail: 'Replay to set a higher best score.',
    replayPrompt: 'Replay to beat 880'
  });
});

it('describes a new best and the next target', () => {
  const previous: CrisisRunResult = {
    runId: 'old',
    mode: 'crisis',
    completedAt: '2026-07-08T12:00:00.000Z',
    elapsedSeconds: 540,
    cityLights: 100,
    servedContracts: 4,
    powerEfficiency: 0.7,
    heatPeak: 62,
    mistakes: 1,
    score: 850,
    grade: 'A',
    shareLine: 'Rock to Rack Crisis Run: 850 points, grade A, 100% city lights online.'
  };
  const result = { ...previous, runId: 'new', elapsedSeconds: 430, score: 905, grade: 'S' as const };

  expect(compareCrisisRunToBest(previous, result)).toEqual({
    status: 'new-best',
    bestScore: 850,
    deltaFromPreviousBest: 55,
    targetScore: 906,
    headline: 'New best by 55 pts',
    detail: 'Previous best was 850.',
    replayPrompt: 'Replay to beat 905'
  });
});

it('describes a missed best without changing the target', () => {
  const previous: CrisisRunResult = {
    runId: 'best',
    mode: 'crisis',
    completedAt: '2026-07-08T12:00:00.000Z',
    elapsedSeconds: 420,
    cityLights: 100,
    servedContracts: 4,
    powerEfficiency: 0.9,
    heatPeak: 50,
    mistakes: 0,
    score: 930,
    grade: 'S',
    shareLine: 'Rock to Rack Crisis Run: 930 points, grade S, 100% city lights online.'
  };
  const result = { ...previous, runId: 'miss', elapsedSeconds: 560, score: 872, grade: 'A' as const };

  expect(compareCrisisRunToBest(previous, result)).toEqual({
    status: 'missed-best',
    bestScore: 930,
    deltaFromPreviousBest: -58,
    targetScore: 931,
    headline: '58 pts short of best',
    detail: 'Best remains 930.',
    replayPrompt: 'Replay to beat 930'
  });
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
corepack pnpm vitest run src/sim/crisisRun.test.ts
```

Expected: FAIL because `compareCrisisRunToBest` does not exist.

- [ ] **Step 3: Implement comparison helper**

Add to `src/sim/crisisRun.ts`:

```ts
export type CrisisRunReplayStatus = 'first-run' | 'new-best' | 'matched-best' | 'missed-best';

export interface CrisisRunReplayComparison {
  status: CrisisRunReplayStatus;
  bestScore: number | null;
  deltaFromPreviousBest: number | null;
  targetScore: number;
  headline: string;
  detail: string;
  replayPrompt: string;
}

export function compareCrisisRunToBest(previousBest: CrisisRunResult | null, result: CrisisRunResult): CrisisRunReplayComparison {
  if (!previousBest) {
    return {
      status: 'first-run',
      bestScore: null,
      deltaFromPreviousBest: null,
      targetScore: result.score + 1,
      headline: `First run scored ${result.score}`,
      detail: 'Replay to set a higher best score.',
      replayPrompt: `Replay to beat ${result.score}`
    };
  }

  const delta = result.score - previousBest.score;
  if (delta > 0) {
    return {
      status: 'new-best',
      bestScore: previousBest.score,
      deltaFromPreviousBest: delta,
      targetScore: result.score + 1,
      headline: `New best by ${delta} pts`,
      detail: `Previous best was ${previousBest.score}.`,
      replayPrompt: `Replay to beat ${result.score}`
    };
  }

  if (delta === 0) {
    return {
      status: 'matched-best',
      bestScore: previousBest.score,
      deltaFromPreviousBest: 0,
      targetScore: previousBest.score + 1,
      headline: 'Matched your best',
      detail: `Beat ${previousBest.score} to set a new best.`,
      replayPrompt: `Replay to beat ${previousBest.score}`
    };
  }

  return {
    status: 'missed-best',
    bestScore: previousBest.score,
    deltaFromPreviousBest: delta,
    targetScore: previousBest.score + 1,
    headline: `${Math.abs(delta)} pts short of best`,
    detail: `Best remains ${previousBest.score}.`,
    replayPrompt: `Replay to beat ${previousBest.score}`
  };
}
```

- [ ] **Step 4: Run focused tests and confirm pass**

Run:

```bash
corepack pnpm vitest run src/sim/crisisRun.test.ts
```

Expected: PASS.

---

### Task 2: Result Card Replay Target

**Files:**
- Modify: `src/ui/crisisRunOverlay.ts`
- Modify: `src/ui/crisisRunOverlay.test.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Add failing overlay test**

Modify the test import in `src/ui/crisisRunOverlay.test.ts`:

```ts
import type { CrisisRunReplayComparison } from '../sim/crisisRun';
```

In `renders result score and actions`, create a comparison object:

```ts
const comparison: CrisisRunReplayComparison = {
  status: 'new-best',
  bestScore: 870,
  deltaFromPreviousBest: 40,
  targetScore: 911,
  headline: 'New best by 40 pts',
  detail: 'Previous best was 870.',
  replayPrompt: 'Replay to beat 910'
};
```

Pass `runNumber` and `comparison` into `mountCrisisRunResult`:

```ts
const modal = mountCrisisRunResult(root, {
  result,
  isBest: true,
  runNumber: 2,
  comparison,
  onReplay: () => actions.push('replay'),
  onMenu: () => actions.push('menu')
});
```

Add assertions:

```ts
expect(root.textContent).toContain('Run 2');
expect(root.textContent).toContain('New best by 40 pts');
expect(root.textContent).toContain('Previous best was 870.');
expect(root.textContent).toContain('Replay to beat 910');
```

- [ ] **Step 2: Run focused test and confirm failure**

Run:

```bash
corepack pnpm vitest run src/ui/crisisRunOverlay.test.ts
```

Expected: FAIL because `CrisisRunResultOptions` has no `runNumber` or `comparison`.

- [ ] **Step 3: Extend result card options and render comparison**

Modify `src/ui/crisisRunOverlay.ts`:

```ts
import type { CrisisRunReplayComparison } from '../sim/crisisRun';
import type { CrisisRunResult, DatacenterBuildingType } from '../state/types';
```

```ts
export interface CrisisRunResultOptions {
  result: CrisisRunResult;
  isBest: boolean;
  runNumber: number;
  comparison: CrisisRunReplayComparison;
  onReplay: () => void;
  onMenu: () => void;
}
```

Inside `mountCrisisRunResult`, append comparison elements before the stats:

```ts
const comparison = document.createElement('div');
comparison.className = 'crisis-replay-summary';
comparison.append(
  elementWithText('span', 'crisis-run-number', `Run ${options.runNumber}`),
  elementWithText('strong', '', options.comparison.headline),
  elementWithText('p', '', options.comparison.detail)
);
```

Then include it in `card.append`:

```ts
card.append(
  elementWithText('span', 'crisis-result-kicker', options.isBest ? 'New best' : 'Run complete'),
  elementWithText('h2', '', `${options.result.score} pts - Grade ${options.result.grade}`),
  elementWithText('p', 'crisis-share-line', options.result.shareLine),
  comparison,
  stats
);
```

Change the replay button label:

```ts
button(options.comparison.replayPrompt, 'primary-action crisis-replay', options.onReplay),
```

- [ ] **Step 4: Add compact styles**

Add to `src/styles.css` near the existing crisis result styles:

```css
.crisis-replay-summary {
  display: grid;
  gap: 0.3rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(155, 246, 255, 0.2);
  background: rgba(6, 17, 29, 0.58);
}

.crisis-replay-summary strong,
.crisis-replay-summary p,
.crisis-run-number {
  margin: 0;
}

.crisis-run-number {
  color: rgba(248, 212, 92, 0.9);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}
```

- [ ] **Step 5: Run focused test and confirm pass**

Run:

```bash
corepack pnpm vitest run src/ui/crisisRunOverlay.test.ts
```

Expected: PASS.

---

### Task 3: Clean Replay Restart In Scene

**Files:**
- Modify: `src/scenes/CrisisRunScene.ts`

- [ ] **Step 1: Import comparison helper**

Modify the import:

```ts
import { bestCrisisRun, compareCrisisRunToBest, createCrisisRunResult } from '../sim/crisisRun';
```

- [ ] **Step 2: Track keyboard and timer cleanup**

Add fields to `CrisisRunScene`:

```ts
private runTimer: Phaser.Time.TimerEvent | undefined;
private keyboardHandler: ((event: KeyboardEvent) => void) | undefined;
```

Change the timer creation in `create()`:

```ts
this.runTimer = this.time.addEvent({
  delay: BALANCE.ch6.tickSeconds * 1000,
  loop: true,
  callback: () => this.tickRun(BALANCE.ch6.tickSeconds)
});
```

Change `bindKeyboard()`:

```ts
private bindKeyboard(): void {
  this.keyboardHandler = (event: KeyboardEvent) => {
    const index = Number(event.key) - 1;
    if (index >= 0 && index < BUILD_TYPES.length) {
      this.selectedBuildType = BUILD_TYPES[index];
      this.refreshOverlay();
    }
    if (event.code === 'Space') {
      this.completeIfReady();
    }
  };
  this.input.keyboard?.on('keydown', this.keyboardHandler);
}
```

- [ ] **Step 3: Pass replay metadata into result card**

In `completeIfReady()`, replace the previous best block with:

```ts
const metaBeforeRun = gameStore.getState().meta;
const previousBest = metaBeforeRun.bestCrisisRun;
const runNumber = metaBeforeRun.crisisRuns.length + 1;
const comparison = compareCrisisRunToBest(previousBest, result);
gameStore.recordCrisisRunResult(result);
this.resultModal = mountCrisisRunResult(documentRoot(), {
  result,
  isBest: bestCrisisRun(previousBest, result) === result,
  runNumber,
  comparison,
  onReplay: () => {
    this.resultModal?.cleanup();
    this.resultModal = undefined;
    window.location.hash = 'crisis';
    this.scene.restart();
  },
  onMenu: () => {
    this.resultModal?.cleanup();
    this.resultModal = undefined;
    window.location.hash = 'menu';
    this.scene.start(SceneKey.Menu);
  }
});
```

- [ ] **Step 4: Harden cleanup**

Update `cleanup()`:

```ts
private cleanup(): void {
  this.overlay?.cleanup();
  this.overlay = undefined;
  this.resultModal?.cleanup();
  this.resultModal = undefined;
  this.runTimer?.remove(false);
  this.runTimer = undefined;
  if (this.keyboardHandler) {
    this.input.keyboard?.off('keydown', this.keyboardHandler);
    this.keyboardHandler = undefined;
  }
  this.zones.splice(0).forEach((zone) => zone.destroy());
}
```

- [ ] **Step 5: Run TypeScript build to catch integration errors**

Run:

```bash
corepack pnpm build
```

Expected: PASS with only the existing large Phaser chunk warning.

---

### Task 4: Two-Run Browser Smoke

**Files:**
- Create: `tools/m12-replay-smoke.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create replay smoke script**

Create `tools/m12-replay-smoke.mjs`:

```js
import { chromium } from '@playwright/test';

const baseUrl = process.env.M12_BASE_URL ?? 'http://localhost:4173/';
const screenshotPath = '/tmp/rock-to-rack-m12-replay-result.png';

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
  await page.waitForSelector('.crisis-overlay', { timeout: 10_000 });
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

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.waitForSelector('.menu-shell', { timeout: 10_000 });
  const menuText = await page.locator('.menu-shell').textContent();
  assert(menuText?.includes('Best Crisis Run'), 'Menu did not show best Crisis Run after replay loop');

  await context.close();
} finally {
  await browser.close();
}

if (issues.length > 0) {
  throw new Error(`Replay smoke issues:\n${issues.join('\n')}`);
}

console.log(JSON.stringify({ status: 'pass', url: baseUrl, screenshot: screenshotPath }, null, 2));
```

- [ ] **Step 2: Add package script**

Modify `package.json`:

```json
"smoke:m12": "node tools/m12-replay-smoke.mjs"
```

Keep the existing `smoke:m10`, `smoke:m11`, and `perf:m10` scripts.

- [ ] **Step 3: Run syntax check**

Run:

```bash
node --check tools/m12-replay-smoke.mjs
```

Expected: PASS.

---

### Task 5: Verification And Handoff

**Files:**
- Modify: `docs/agent-context.md`

- [ ] **Step 1: Run focused tests**

Run:

```bash
corepack pnpm vitest run src/sim/crisisRun.test.ts src/ui/crisisRunOverlay.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full verification**

Run:

```bash
corepack pnpm simulate
corepack pnpm test
corepack pnpm verify:static
corepack pnpm build
```

Expected:
- Simulation: PASS
- Tests: PASS
- Static verification: PASS
- Build: PASS with only the existing large Phaser chunk warning

- [ ] **Step 3: Start or reuse local preview**

Check port 4173:

```bash
lsof -nP -iTCP:4173 -sTCP:LISTEN
```

If no listener is present, start:

```bash
corepack pnpm preview -- --host localhost --port 4173
```

- [ ] **Step 4: Run browser smoke**

Run:

```bash
corepack pnpm smoke:m12
```

Expected: PASS and screenshot written to:

```bash
/tmp/rock-to-rack-m12-replay-result.png
```

- [ ] **Step 5: Update handoff**

Append to `docs/agent-context.md` under Current Handoff:

```md
- M12 completed the Crisis Run replay loop: result cards now show run number, best-score comparison, next replay target, clean replay restart behavior, and a two-run browser smoke script.
```

Also add the plan path to the plan list:

```md
- The M12 implementation plan is `docs/superpowers/plans/2026-07-08-m12-replay-loop.md`.
```

- [ ] **Step 6: Final moderation**

Use the moderator template. Scope should include:

```text
M12 replay comparison helper, crisis result overlay, CrisisRunScene replay restart, smoke:m12 script, styles, docs.
```

PASS requires:
- No TypeScript errors.
- Full Vitest suite passes.
- `smoke:m12` completes two Crisis Runs from one browser session.
- Replay restart clears the result card and disables `Serve Nova` until the next run is rebuilt.

---

## Self-Review

Spec coverage:
- User selected replay as priority: covered by Tasks 1-4.
- User was unsure about item 2: intentionally excluded from this milestone.
- Verification and browser evidence: covered by Task 5.

Placeholder scan:
- No deferred feature placeholders are included.
- The second undecided feature is explicitly out of scope.

Type consistency:
- `CrisisRunReplayComparison` is exported from `src/sim/crisisRun.ts`.
- `mountCrisisRunResult` receives `comparison` and `runNumber`.
- `CrisisRunScene` computes comparison before recording the result.
