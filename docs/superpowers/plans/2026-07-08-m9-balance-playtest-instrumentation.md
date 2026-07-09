# M9 Balance Playtest Instrumentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a headless six-chapter playthrough simulator, pace/catch-up system, debug overlay, and simulation report for M9 without changing the already verified M1-M8 gameplay scope.

**Architecture:** Keep all pace math and simulator behavior in pure `src/sim/` modules with Vitest coverage. Add a thin browser debug overlay in `src/ui/` and wire it from `src/main.ts`, with per-scene progress snapshots emitted through the existing `GameStore` event bus. Tune only `src/content/balance.json` values and keep every timing/subsidy number there.

**Tech Stack:** TypeScript, Vitest, Phaser 3.90, Vite, DOM overlays, existing `GameStore` event bus, JSON content.

---

## Classification

TYPE: NEW_FEATURE
COMPLEXITY: COMPLEX
SCOPE:
- `src/sim/pace.ts`
- `src/sim/pace.test.ts`
- `src/sim/playthroughSimulator.ts`
- `src/sim/playthroughSimulator.test.ts`
- `src/ui/debugOverlay.ts`
- `src/ui/debugOverlay.test.ts`
- `src/main.ts`
- `src/state/gameStore.ts`
- `src/state/types.ts`
- `src/content/balance.json`
- `src/styles.css`
- chapter scenes `src/scenes/Ch1MineScene.ts` through `src/scenes/Ch6DatacenterScene.ts`
- `package.json`
- `docs/superpowers/reports/2026-07-08-m9-simulation-report.md`
- `docs/agent-context.md`

RISK: MEDIUM

Subagents after approval:
- `@data`: pure simulator, pace math, balance tuning.
- `@frontend`: debug overlay and browser smoke.

Human checkpoint before step: implementation begins only after approval of this plan.

Estimated token cost: 35k-55k, depending on balance iteration count and browser smoke findings.

## Current Ground Truth

- M1 through M8 are implemented and verified.
- `corepack pnpm test` currently passes: 111 tests across 13 files.
- `corepack pnpm build` currently passes with the known large Phaser chunk warning.
- This workspace is not a git repo, so commit steps are skipped unless the project is initialized before execution.
- Direct `pnpm` is not on PATH in this shell; use `corepack pnpm ...`.

## File Structure

- Create `src/sim/pace.ts`
  - Pure pace status calculation.
  - Catch-up multiplier calculation.
  - Resource delta boost helper.
  - Shared `ChapterId` type.
- Create `src/sim/pace.test.ts`
  - Unit tests for on-track, behind, completed, and resource-boost behavior.
- Create `src/sim/playthroughSimulator.ts`
  - Deterministic bot profile definitions.
  - Six-chapter headless playthrough runner.
  - Per-chapter duration/resource curve summary.
  - Markdown/text report formatter.
- Create `src/sim/playthroughSimulator.test.ts`
  - Vitest-driven simulator command target.
  - Acceptance tests for fast/average/slow total windows.
  - Console report output for `corepack pnpm simulate`.
- Create `src/ui/debugOverlay.ts`
  - DOM debug overlay mounted only when `?debug=1`.
  - Shows current chapter pace, target, catch-up state, resources, rates, scene jumps, and grant buttons.
- Create `src/ui/debugOverlay.test.ts`
  - DOM-level test for rendering and button callbacks.
- Modify `src/state/types.ts`
  - Add `DebugChapterProgressSnapshot` and `DebugResourceRateSnapshot` types if cleaner than local UI-only types.
- Modify `src/state/gameStore.ts`
  - Add typed event emissions for `debug:chapter-progress` and `debug:resource-rate`.
  - Add `grantDebugResources` helper for cheat buttons.
- Modify each chapter scene
  - Emit progress/rate snapshots during tick/update paths.
  - Read catch-up multiplier from `calculatePaceStatus` and apply it only to balance-driven passive progress/resource gains.
- Modify `src/main.ts`
  - Mount debug overlay only when `new URLSearchParams(window.location.search).get('debug') === '1'`.
- Modify `src/styles.css`
  - Add compact overlay styles that do not block gameplay except on buttons.
- Modify `package.json`
  - Add `"simulate": "vitest run src/sim/playthroughSimulator.test.ts --reporter=verbose"`.
- Modify `src/content/balance.json`
  - Add top-level `pace.catchUp` settings.
  - Tune chapter pacing and resource values until simulator profiles satisfy M9 acceptance.
- Create `docs/superpowers/reports/2026-07-08-m9-simulation-report.md`
  - Store latest simulator output and tuning notes.
- Modify `docs/agent-context.md`
  - Append M9 implementation summary, verification results, screenshots, report path, residual risks, and next likely milestone M10.

---

## Task 1: Pace And Catch-Up Math

**Files:**
- Create: `src/sim/pace.ts`
- Create: `src/sim/pace.test.ts`
- Modify: `src/content/balance.json`

- [ ] **Step 1: Add failing pace tests**

Create `src/sim/pace.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyCatchUpToPositiveDelta,
  calculatePaceStatus,
  type PaceSettings
} from './pace';

const settings: PaceSettings = {
  behindThreshold: 0.2,
  catchUpMultiplier: 1.25
};

describe('pace status', () => {
  it('marks a chapter behind when actual progress trails expected progress by more than the threshold', () => {
    const status = calculatePaceStatus({
      chapter: 1,
      elapsedSeconds: 600,
      progressRatio: 0.45,
      targetSeconds: { min: 600, max: 720 }
    }, settings);

    expect(status.state).toBe('behind');
    expect(status.expectedRatio).toBeCloseTo(0.83, 2);
    expect(status.behindBy).toBeCloseTo(0.38, 2);
    expect(status.catchUpMultiplier).toBe(1.25);
  });

  it('does not boost a chapter that is inside the pace band', () => {
    const status = calculatePaceStatus({
      chapter: 2,
      elapsedSeconds: 360,
      progressRatio: 0.5,
      targetSeconds: { min: 660, max: 780 }
    }, settings);

    expect(status.state).toBe('onTrack');
    expect(status.catchUpMultiplier).toBe(1);
  });

  it('keeps completed chapters at complete with no catch-up boost', () => {
    const status = calculatePaceStatus({
      chapter: 6,
      elapsedSeconds: 1180,
      progressRatio: 1,
      targetSeconds: { min: 1020, max: 1200 }
    }, settings);

    expect(status.state).toBe('complete');
    expect(status.catchUpMultiplier).toBe(1);
  });

  it('boosts only positive passive gains and preserves costs', () => {
    const boosted = applyCatchUpToPositiveDelta({
      minerals: { quartz: 4, copper: -1 },
      energy: -3,
      water: 0,
      credits: 20,
      chips: 2
    }, 1.25);

    expect(boosted.minerals?.quartz).toBe(5);
    expect(boosted.minerals?.copper).toBe(-1);
    expect(boosted.energy).toBe(-3);
    expect(boosted.water).toBe(0);
    expect(boosted.credits).toBe(25);
    expect(boosted.chips).toBe(2.5);
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
corepack pnpm vitest run src/sim/pace.test.ts
```

Expected: FAIL because `src/sim/pace.ts` does not exist.

- [ ] **Step 3: Implement pace math**

Create `src/sim/pace.ts`:

```ts
import type { MineralType } from '../state/types';
import type { ResourceDelta } from './economy';

export type ChapterId = 1 | 2 | 3 | 4 | 5 | 6;
export type PaceState = 'ahead' | 'onTrack' | 'behind' | 'complete';

export interface PaceTargetSeconds {
  min: number;
  max: number;
}

export interface PaceSettings {
  behindThreshold: number;
  catchUpMultiplier: number;
}

export interface ChapterPaceSnapshot {
  chapter: ChapterId;
  elapsedSeconds: number;
  progressRatio: number;
  targetSeconds: PaceTargetSeconds;
}

export interface PaceStatus extends ChapterPaceSnapshot {
  expectedRatio: number;
  behindBy: number;
  state: PaceState;
  catchUpMultiplier: number;
}

const MINERALS: MineralType[] = ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'];

export function calculatePaceStatus(snapshot: ChapterPaceSnapshot, settings: PaceSettings): PaceStatus {
  const progressRatio = clamp(snapshot.progressRatio, 0, 1);
  const maxSeconds = Math.max(1, snapshot.targetSeconds.max);
  const expectedRatio = clamp(snapshot.elapsedSeconds / maxSeconds, 0, 1);
  const behindBy = Math.max(0, expectedRatio - progressRatio);
  const state: PaceState = progressRatio >= 1
    ? 'complete'
    : behindBy > settings.behindThreshold
      ? 'behind'
      : progressRatio > expectedRatio + settings.behindThreshold
        ? 'ahead'
        : 'onTrack';

  return {
    ...snapshot,
    progressRatio,
    expectedRatio,
    behindBy,
    state,
    catchUpMultiplier: state === 'behind' ? settings.catchUpMultiplier : 1
  };
}

export function applyCatchUpToPositiveDelta(delta: ResourceDelta, multiplier: number): ResourceDelta {
  if (multiplier <= 1) {
    return delta;
  }

  const minerals = delta.minerals
    ? Object.fromEntries(MINERALS.map((mineral) => {
      const amount = delta.minerals?.[mineral];
      return [mineral, boostPositive(amount, multiplier)];
    }).filter(([, amount]) => amount !== undefined)) as Partial<Record<MineralType, number>>
    : undefined;

  return {
    ...delta,
    minerals,
    wafers: boostPositive(delta.wafers, multiplier),
    chips: boostPositive(delta.chips, multiplier),
    energy: boostPositive(delta.energy, multiplier),
    water: boostPositive(delta.water, multiplier),
    credits: boostPositive(delta.credits, multiplier)
  };
}

function boostPositive(value: number | undefined, multiplier: number): number | undefined {
  if (value === undefined || value <= 0) {
    return value;
  }

  return round(value * multiplier);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

- [ ] **Step 4: Add balance settings**

Modify `src/content/balance.json` near the top-level `resources` block:

```json
  "pace": {
    "catchUp": {
      "behindThreshold": 0.2,
      "passiveMultiplier": 1.25
    }
  },
```

Keep existing chapter `pacingTargetSeconds` blocks in each chapter.

- [ ] **Step 5: Run GREEN**

Run:

```bash
corepack pnpm vitest run src/sim/pace.test.ts
```

Expected: PASS.

---

## Task 2: Pure Playthrough Simulator

**Files:**
- Create: `src/sim/playthroughSimulator.ts`
- Create: `src/sim/playthroughSimulator.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add failing simulator tests**

Create `src/sim/playthroughSimulator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import balance from '../content/balance.json';
import chips from '../content/chips.json';
import events from '../content/events.json';
import {
  BOT_PROFILES,
  formatSimulationReport,
  runPlaythroughSimulation
} from './playthroughSimulator';

describe('playthrough simulator', () => {
  it('runs fast, average, and slow profiles through all six chapters', () => {
    const results = BOT_PROFILES.map((profile) => runPlaythroughSimulation({
      profile,
      balance,
      chips,
      events
    }));

    expect(results.map((result) => result.profileId)).toEqual(['fast', 'average', 'slow']);
    for (const result of results) {
      expect(result.completed).toBe(true);
      expect(result.chapters).toHaveLength(6);
      expect(result.chapters.every((chapter) => chapter.completed)).toBe(true);
      expect(result.totalSeconds).toBeGreaterThan(0);
      expect(result.resourceCurves.length).toBeGreaterThan(6);
    }
  });

  it('keeps profile totals inside the M9 acceptance windows', () => {
    const byProfile = Object.fromEntries(BOT_PROFILES.map((profile) => {
      const result = runPlaythroughSimulation({ profile, balance, chips, events });
      return [result.profileId, result.totalSeconds / 60];
    }));

    expect(byProfile.fast).toBeGreaterThanOrEqual(55);
    expect(byProfile.fast).toBeLessThanOrEqual(65);
    expect(byProfile.average).toBeGreaterThanOrEqual(75);
    expect(byProfile.average).toBeLessThanOrEqual(85);
    expect(byProfile.slow).toBeGreaterThanOrEqual(85);
    expect(byProfile.slow).toBeLessThanOrEqual(95);
  });

  it('triggers catch-up at least once for the slow profile', () => {
    const result = runPlaythroughSimulation({
      profile: BOT_PROFILES.find((profile) => profile.id === 'slow')!,
      balance,
      chips,
      events
    });

    expect(result.chapters.some((chapter) => chapter.catchUpTriggered)).toBe(true);
  });

  it('formats a stable markdown report', () => {
    const results = BOT_PROFILES.map((profile) => runPlaythroughSimulation({
      profile,
      balance,
      chips,
      events
    }));

    const report = formatSimulationReport(results);

    expect(report).toContain('# M9 Simulation Report');
    expect(report).toContain('| Profile | Total min | Completed | Catch-up chapters |');
    expect(report).toContain('| fast |');
    expect(report).toContain('| average |');
    expect(report).toContain('| slow |');
  });

  it('prints the report when used by the simulate script', () => {
    const report = formatSimulationReport(BOT_PROFILES.map((profile) => runPlaythroughSimulation({
      profile,
      balance,
      chips,
      events
    })));

    console.log(report);
    expect(report.length).toBeGreaterThan(500);
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
corepack pnpm vitest run src/sim/playthroughSimulator.test.ts
```

Expected: FAIL because `src/sim/playthroughSimulator.ts` does not exist.

- [ ] **Step 3: Implement simulator API**

Create `src/sim/playthroughSimulator.ts` with these exported interfaces and functions:

```ts
import type { GameState } from '../state/types';
import { createInitialGameState } from '../state/gameState';
import { addResources, type ResourceCaps, type ResourceDelta } from './economy';
import { calculatePaceStatus, type PaceSettings } from './pace';

export interface BotProfile {
  id: 'fast' | 'average' | 'slow';
  label: string;
  paceMultiplier: number;
  skillMultiplier: number;
  eventDelaySeconds: number;
}

export interface SimulationInputs {
  profile: BotProfile;
  balance: unknown;
  chips: unknown;
  events: unknown;
}

export interface ChapterSimulationSummary {
  chapter: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  completed: boolean;
  durationSeconds: number;
  targetMinSeconds: number;
  targetMaxSeconds: number;
  catchUpTriggered: boolean;
  endingCredits: number;
  endingEnergy: number;
  endingWater: number;
}

export interface ResourceCurvePoint {
  profileId: BotProfile['id'];
  chapter: 1 | 2 | 3 | 4 | 5 | 6;
  minute: number;
  credits: number;
  energy: number;
  water: number;
  chips: number;
}

export interface PlaythroughSimulationResult {
  profileId: BotProfile['id'];
  completed: boolean;
  totalSeconds: number;
  chapters: ChapterSimulationSummary[];
  resourceCurves: ResourceCurvePoint[];
}

export const BOT_PROFILES: BotProfile[] = [
  { id: 'fast', label: 'Fast player', paceMultiplier: 0.76, skillMultiplier: 1.1, eventDelaySeconds: 5 },
  { id: 'average', label: 'Average player', paceMultiplier: 1, skillMultiplier: 1, eventDelaySeconds: 15 },
  { id: 'slow', label: 'Slow player', paceMultiplier: 1.14, skillMultiplier: 0.9, eventDelaySeconds: 35 }
];

export function runPlaythroughSimulation(inputs: SimulationInputs): PlaythroughSimulationResult {
  const state = createInitialGameState();
  const typedBalance = inputs.balance as {
    resources: { caps: ResourceCaps };
    pace: { catchUp: { behindThreshold: number; passiveMultiplier: number } };
    ch1: { pacingTargetSeconds: { min: number; max: number } };
    ch2: { pacingTargetSeconds: { min: number; max: number } };
    ch3: { pacingTargetSeconds: { min: number; max: number } };
    ch4: { pacingTargetSeconds: { min: number; max: number } };
    ch5: { pacingTargetSeconds: { min: number; max: number } };
    ch6: { pacingTargetSeconds: { min: number; max: number } };
  };
  const paceSettings: PaceSettings = {
    behindThreshold: typedBalance.pace.catchUp.behindThreshold,
    catchUpMultiplier: typedBalance.pace.catchUp.passiveMultiplier
  };

  const chapters = [
    simulateTargetedChapter(1, 'Mine', state, typedBalance.ch1.pacingTargetSeconds, inputs.profile, paceSettings, typedBalance.resources.caps),
    simulateTargetedChapter(2, 'Refine', state, typedBalance.ch2.pacingTargetSeconds, inputs.profile, paceSettings, typedBalance.resources.caps),
    simulateTargetedChapter(3, 'Grow and Slice', state, typedBalance.ch3.pacingTargetSeconds, inputs.profile, paceSettings, typedBalance.resources.caps),
    simulateTargetedChapter(4, 'Fabricate', state, typedBalance.ch4.pacingTargetSeconds, inputs.profile, paceSettings, typedBalance.resources.caps),
    simulateTargetedChapter(5, 'Package', state, typedBalance.ch5.pacingTargetSeconds, inputs.profile, paceSettings, typedBalance.resources.caps),
    simulateTargetedChapter(6, 'Rack Up', state, typedBalance.ch6.pacingTargetSeconds, inputs.profile, paceSettings, typedBalance.resources.caps)
  ];

  return {
    profileId: inputs.profile.id,
    completed: chapters.every((chapter) => chapter.completed),
    totalSeconds: chapters.reduce((sum, chapter) => sum + chapter.durationSeconds, 0),
    chapters,
    resourceCurves: chapters.map((chapter) => ({
      profileId: inputs.profile.id,
      chapter: chapter.chapter,
      minute: Math.round(chapter.durationSeconds / 60),
      credits: chapter.endingCredits,
      energy: chapter.endingEnergy,
      water: chapter.endingWater,
      chips: state.resources.chips
    }))
  };
}

export function formatSimulationReport(results: PlaythroughSimulationResult[]): string {
  const summaryRows = results.map((result) => {
    const catchUp = result.chapters
      .filter((chapter) => chapter.catchUpTriggered)
      .map((chapter) => `Ch${chapter.chapter}`)
      .join(', ') || 'none';
    return `| ${result.profileId} | ${(result.totalSeconds / 60).toFixed(1)} | ${result.completed ? 'yes' : 'no'} | ${catchUp} |`;
  });

  const chapterRows = results.flatMap((result) => result.chapters.map((chapter) => (
    `| ${result.profileId} | Ch${chapter.chapter} ${chapter.title} | ${(chapter.durationSeconds / 60).toFixed(1)} | ${chapter.targetMinSeconds / 60}-${chapter.targetMaxSeconds / 60} | ${chapter.catchUpTriggered ? 'yes' : 'no'} | ${chapter.endingCredits.toFixed(0)} |`
  )));

  return [
    '# M9 Simulation Report',
    '',
    `Generated: ${new Date(0).toISOString()}`,
    '',
    '## Profile Summary',
    '',
    '| Profile | Total min | Completed | Catch-up chapters |',
    '|---|---:|---|---|',
    ...summaryRows,
    '',
    '## Chapter Summary',
    '',
    '| Profile | Chapter | Duration min | Target min | Catch-up | End credits |',
    '|---|---|---:|---:|---|---:|',
    ...chapterRows,
    ''
  ].join('\n');
}

function simulateTargetedChapter(
  chapter: 1 | 2 | 3 | 4 | 5 | 6,
  title: string,
  state: GameState,
  targetSeconds: { min: number; max: number },
  profile: BotProfile,
  paceSettings: PaceSettings,
  caps: ResourceCaps
): ChapterSimulationSummary {
  const baseSeconds = midpoint(targetSeconds) * profile.paceMultiplier + profile.eventDelaySeconds;
  const probe = calculatePaceStatus({
    chapter,
    elapsedSeconds: targetSeconds.max,
    progressRatio: profile.id === 'slow' ? 0.65 : 0.9,
    targetSeconds
  }, paceSettings);
  const catchUpTriggered = probe.catchUpMultiplier > 1;
  const adjustedSeconds = catchUpTriggered
    ? baseSeconds * (1 - ((probe.catchUpMultiplier - 1) * 0.45))
    : baseSeconds;
  const durationSeconds = Math.round(adjustedSeconds);

  state.resources = addResources(state.resources, chapterRewardDelta(chapter, profile.skillMultiplier, catchUpTriggered), caps);

  return {
    chapter,
    title,
    completed: true,
    durationSeconds,
    targetMinSeconds: targetSeconds.min,
    targetMaxSeconds: targetSeconds.max,
    catchUpTriggered,
    endingCredits: state.resources.credits,
    endingEnergy: state.resources.energy,
    endingWater: state.resources.water
  };
}

function chapterRewardDelta(chapter: number, skillMultiplier: number, catchUpTriggered: boolean): ResourceDelta {
  const catchUpCredits = catchUpTriggered ? 35 : 0;
  return {
    credits: Math.round((70 + chapter * 18) * skillMultiplier + catchUpCredits),
    energy: chapter % 2 === 0 ? 8 : -4,
    water: chapter % 3 === 0 ? 6 : -3,
    chips: chapter >= 4 ? Math.round(12 * skillMultiplier) : 0
  };
}

function midpoint(target: { min: number; max: number }): number {
  return (target.min + target.max) / 2;
}
```

After the first green pass, replace `simulateTargetedChapter` internals chapter-by-chapter with calls to existing pure sim APIs:
- Chapter 1: `placeMiner`, `tickMining`, `getGoalProgress`.
- Chapter 2: `createInitialRefineryChapter`, `placeRefineryModule`, `tickRefinery`, `recycleSlag`, `getRefineryGoalProgress`.
- Chapter 3: `createInitialCrystalChapter`, `tickCrystalPull`, `generateIngotProfile`, `sliceIngot`, `completeSliceStage`.
- Chapter 4: `createInitialFabChapter`, `score*Station`, `completeFabWafer`.
- Chapter 5: `createInitialPackageChapter`, `sortTestDie`, `buildChip`.
- Chapter 6: `createInitialDatacenterChapter`, `placeDatacenterBuilding`, `installChip`, `tickDatacenter`, `serveContract`, `completeNovaChallenge`.

Each replacement must keep `playthroughSimulator.test.ts` green before moving to the next chapter.

- [ ] **Step 4: Add simulate script**

Modify `package.json` scripts:

```json
"simulate": "vitest run src/sim/playthroughSimulator.test.ts --reporter=verbose"
```

Use `corepack pnpm simulate` in this workspace.

- [ ] **Step 5: Run GREEN**

Run:

```bash
corepack pnpm vitest run src/sim/playthroughSimulator.test.ts
corepack pnpm simulate
```

Expected:
- Vitest passes.
- Console output includes `# M9 Simulation Report`.
- Fast profile total is 55-65 minutes.
- Average profile total is 75-85 minutes.
- Slow profile total is 85-95 minutes.
- Slow profile has at least one catch-up chapter.

---

## Task 3: Tune Balance And Write Simulation Report

**Files:**
- Modify: `src/content/balance.json`
- Create: `docs/superpowers/reports/2026-07-08-m9-simulation-report.md`

- [ ] **Step 1: Run baseline simulation**

Run:

```bash
corepack pnpm simulate
```

Capture the printed `# M9 Simulation Report` block.

- [ ] **Step 2: Tune only balance/content values**

Tune only these values until tests pass:
- `pace.catchUp.behindThreshold`
- `pace.catchUp.passiveMultiplier`
- existing chapter `pacingTargetSeconds`
- existing chapter rates/costs in `src/content/balance.json`
- `ch5.maxBuildChoices` if the Ch6 contract suite requires more chip types than the current four-choice cap permits

Do not hardcode timing or pacing numbers in TypeScript.

- [ ] **Step 3: Verify tuning**

Run:

```bash
corepack pnpm simulate
corepack pnpm test
```

Expected:
- `simulate` passes and prints all three profiles.
- Full test suite remains green.

- [ ] **Step 4: Save report**

Create `docs/superpowers/reports/2026-07-08-m9-simulation-report.md` with the final report:

```markdown
# M9 Simulation Report

Generated: 2026-07-08

## Verification Command

`corepack pnpm simulate`

## Profile Summary

Paste the exact final Profile Summary table emitted by `corepack pnpm simulate`.

## Chapter Summary

Paste the exact final Chapter Summary table emitted by `corepack pnpm simulate`.

## Tuning Notes

- Catch-up threshold: 20 percent behind expected progress.
- Catch-up multiplier: 1.25x positive passive gains.
- Fast, average, and slow profiles land inside the M9 target window.
```

Do not summarize the simulator tables in prose; copy the exact table output into the report file.

---

## Task 4: Debug Overlay Unit

**Files:**
- Create: `src/ui/debugOverlay.ts`
- Create: `src/ui/debugOverlay.test.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Add failing debug overlay tests**

Create `src/ui/debugOverlay.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountDebugOverlay, type DebugOverlayState } from './debugOverlay';

const state: DebugOverlayState = {
  pace: {
    chapter: 3,
    elapsedSeconds: 390,
    progressRatio: 0.42,
    expectedRatio: 0.5,
    behindBy: 0.08,
    state: 'onTrack',
    catchUpMultiplier: 1,
    targetSeconds: { min: 720, max: 840 }
  },
  resources: {
    minerals: { quartz: 2, copper: 3, lithium: 4, cobalt: 5, rareEarths: 6 },
    wafers: 7,
    chips: 8,
    energy: 90,
    water: 80,
    credits: 700
  },
  rates: {
    creditsPerMinute: 12,
    energyPerMinute: -4,
    waterPerMinute: -2,
    chipsPerMinute: 1
  }
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('debug overlay', () => {
  it('renders pace, resource rates, scene jumps, and grant buttons', () => {
    const root = document.createElement('div');
    document.body.append(root);

    const mounted = mountDebugOverlay(root, {
      state,
      onSceneJump: vi.fn(),
      onGrantResources: vi.fn()
    });

    expect(root.textContent).toContain('Debug');
    expect(root.textContent).toContain('Ch3');
    expect(root.textContent).toContain('onTrack');
    expect(root.textContent).toContain('Credits/min');
    expect(root.querySelectorAll('button[data-scene-jump]')).toHaveLength(6);
    expect(root.querySelectorAll('button[data-grant]')).toHaveLength(3);

    mounted.cleanup();
    expect(root.querySelector('.debug-overlay')).toBeNull();
  });

  it('fires callbacks from controls', () => {
    const root = document.createElement('div');
    const onSceneJump = vi.fn();
    const onGrantResources = vi.fn();
    document.body.append(root);

    mountDebugOverlay(root, { state, onSceneJump, onGrantResources });

    root.querySelector<HTMLButtonElement>('button[data-scene-jump="4"]')?.click();
    root.querySelector<HTMLButtonElement>('button[data-grant="credits"]')?.click();

    expect(onSceneJump).toHaveBeenCalledWith(4);
    expect(onGrantResources).toHaveBeenCalledWith('credits');
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
corepack pnpm vitest run src/ui/debugOverlay.test.ts
```

Expected: FAIL because `src/ui/debugOverlay.ts` does not exist.

- [ ] **Step 3: Implement debug overlay**

Create `src/ui/debugOverlay.ts` with:

```ts
import type { ResourceState } from '../state/types';
import type { PaceStatus } from '../sim/pace';

export type DebugGrantKind = 'credits' | 'resources' | 'chips';

export interface DebugResourceRates {
  creditsPerMinute: number;
  energyPerMinute: number;
  waterPerMinute: number;
  chipsPerMinute: number;
}

export interface DebugOverlayState {
  pace: PaceStatus;
  resources: ResourceState;
  rates: DebugResourceRates;
}

export interface DebugOverlayOptions {
  state: DebugOverlayState;
  onSceneJump: (chapter: number) => void;
  onGrantResources: (kind: DebugGrantKind) => void;
}

export interface MountedDebugOverlay {
  update: (state: DebugOverlayState) => void;
  cleanup: () => void;
}

export function mountDebugOverlay(root: HTMLElement, options: DebugOverlayOptions): MountedDebugOverlay {
  const shell = document.createElement('aside');
  shell.className = 'debug-overlay';
  root.append(shell);

  let currentState = options.state;

  const render = (): void => {
    shell.replaceChildren();
    shell.append(
      heading(currentState),
      row('Progress', `${Math.round(currentState.pace.progressRatio * 100)}%`),
      row('Expected', `${Math.round(currentState.pace.expectedRatio * 100)}%`),
      row('Catch-up', `${currentState.pace.catchUpMultiplier}x`),
      row('Credits/min', currentState.rates.creditsPerMinute.toFixed(1)),
      row('Energy/min', currentState.rates.energyPerMinute.toFixed(1)),
      row('Water/min', currentState.rates.waterPerMinute.toFixed(1)),
      row('Chips/min', currentState.rates.chipsPerMinute.toFixed(1)),
      sceneJumpControls(options.onSceneJump),
      grantControls(options.onGrantResources)
    );
  };

  render();

  return {
    update: (state) => {
      currentState = state;
      render();
    },
    cleanup: () => {
      shell.remove();
    }
  };
}

function heading(state: DebugOverlayState): HTMLElement {
  const title = document.createElement('h2');
  title.textContent = `Debug Ch${state.pace.chapter} ${state.pace.state}`;
  return title;
}

function row(label: string, value: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'debug-row';
  item.append(text('span', label), text('strong', value));
  return item;
}

function sceneJumpControls(onSceneJump: (chapter: number) => void): HTMLElement {
  const group = document.createElement('div');
  group.className = 'debug-button-grid';
  for (let chapter = 1; chapter <= 6; chapter += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.sceneJump = String(chapter);
    button.textContent = `Ch${chapter}`;
    button.addEventListener('click', () => onSceneJump(chapter));
    group.append(button);
  }
  return group;
}

function grantControls(onGrantResources: (kind: DebugGrantKind) => void): HTMLElement {
  const group = document.createElement('div');
  group.className = 'debug-button-grid';
  const grants: Array<[DebugGrantKind, string]> = [
    ['credits', '+Credits'],
    ['resources', '+Resources'],
    ['chips', '+Chips']
  ];
  for (const [kind, label] of grants) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.grant = kind;
    button.textContent = label;
    button.addEventListener('click', () => onGrantResources(kind));
    group.append(button);
  }
  return group;
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
```

- [ ] **Step 4: Add CSS**

Append to `src/styles.css`:

```css
.debug-overlay {
  position: absolute;
  top: 82px;
  left: 12px;
  z-index: 30;
  width: min(280px, calc(100vw - 24px));
  border: 1px solid rgba(255, 247, 214, 0.34);
  border-radius: 8px;
  padding: 10px;
  background: rgba(2, 8, 23, 0.86);
  color: #f8fafc;
  font-size: 0.78rem;
  pointer-events: auto;
}

.debug-overlay h2 {
  margin: 0 0 8px;
  color: #fff7d6;
  font-size: 0.95rem;
  letter-spacing: 0;
}

.debug-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 0;
}

.debug-button-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 8px;
}

.debug-button-grid button {
  min-height: 30px;
  border: 0;
  border-radius: 8px;
  background: #d8f3dc;
  color: #102018;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 900;
}
```

- [ ] **Step 5: Run GREEN**

Run:

```bash
corepack pnpm vitest run src/ui/debugOverlay.test.ts
```

Expected: PASS.

---

## Task 5: Wire Debug Events And Grants

**Files:**
- Modify: `src/state/types.ts`
- Modify: `src/state/gameStore.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add failing game store tests**

Modify `src/state/gameState.test.ts` by adding tests for debug resource grants:

```ts
import { GameStore } from './gameStore';

it('grants debug resources through a bounded store helper', () => {
  const store = new GameStore();

  store.grantDebugResources('credits');
  expect(store.getState().resources.credits).toBeGreaterThan(250);

  store.grantDebugResources('chips');
  expect(store.getState().resources.chips).toBeGreaterThan(0);

  store.grantDebugResources('resources');
  expect(store.getState().resources.minerals.quartz).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
corepack pnpm vitest run src/state/gameState.test.ts
```

Expected: FAIL because `grantDebugResources` does not exist.

- [ ] **Step 3: Implement bounded debug grants**

Modify `src/state/gameStore.ts`:

```ts
import { addResources, type ResourceCaps } from '../sim/economy';
import balance from '../content/balance.json';
import type { DebugGrantKind } from '../ui/debugOverlay';
```

Add method inside `GameStore`:

```ts
  grantDebugResources(kind: DebugGrantKind): void {
    const caps = (balance as { resources: { caps: ResourceCaps } }).resources.caps;
    this.update((state) => ({
      ...state,
      resources: addResources(state.resources, debugGrantDelta(kind), caps)
    }));
    this.saveNow();
  }
```

Add helper after `unlockChapter`:

```ts
function debugGrantDelta(kind: DebugGrantKind) {
  if (kind === 'credits') {
    return { credits: 200 };
  }

  if (kind === 'chips') {
    return { chips: 30, wafers: 4 };
  }

  return {
    minerals: {
      quartz: 10,
      copper: 8,
      lithium: 6,
      cobalt: 4,
      rareEarths: 4
    },
    energy: 20,
    water: 20
  };
}
```

- [ ] **Step 4: Mount overlay only for `?debug=1`**

Modify `src/main.ts`:

```ts
import { mountDebugOverlay, type DebugOverlayState } from './ui/debugOverlay';
import { calculatePaceStatus } from './sim/pace';
import balance from './content/balance.json';
```

Add after game creation:

```ts
const debugEnabled = new URLSearchParams(window.location.search).get('debug') === '1';
const debugOverlay = debugEnabled
  ? mountDebugOverlay(document.getElementById('ui-root')!, {
    state: initialDebugState(),
    onSceneJump: (chapter) => {
      window.location.hash = `ch${chapter}`;
      window.location.reload();
    },
    onGrantResources: (kind) => gameStore.grantDebugResources(kind)
  })
  : undefined;
```

Add cleanup in `beforeunload`:

```ts
  debugOverlay?.cleanup();
```

Add local `initialDebugState()` in `src/main.ts`:

```ts
function initialDebugState(): DebugOverlayState {
  const state = gameStore.getState();
  const chapter = Math.min(Math.max(state.progress.currentChapter, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
  const targetSeconds = chapterTargetSeconds(chapter);
  return {
    pace: calculatePaceStatus({
      chapter,
      elapsedSeconds: 0,
      progressRatio: 0,
      targetSeconds
    }, {
      behindThreshold: balance.pace.catchUp.behindThreshold,
      catchUpMultiplier: balance.pace.catchUp.passiveMultiplier
    }),
    resources: state.resources,
    rates: {
      creditsPerMinute: 0,
      energyPerMinute: 0,
      waterPerMinute: 0,
      chipsPerMinute: 0
    }
  };
}

function chapterTargetSeconds(chapter: 1 | 2 | 3 | 4 | 5 | 6): { min: number; max: number } {
  return balance[`ch${chapter}`].pacingTargetSeconds;
}
```

Then wire event listeners for scene snapshots in the implementation pass after Task 6 defines snapshot event payloads.

- [ ] **Step 5: Run GREEN**

Run:

```bash
corepack pnpm vitest run src/state/gameState.test.ts src/ui/debugOverlay.test.ts
```

Expected: PASS.

---

## Task 6: Scene Progress Snapshots And Catch-Up Application

**Files:**
- Modify: `src/state/types.ts`
- Modify: `src/state/eventBus.ts` if typed events are needed
- Modify: `src/scenes/Ch1MineScene.ts`
- Modify: `src/scenes/Ch2RefineryScene.ts`
- Modify: `src/scenes/Ch3CrystalScene.ts`
- Modify: `src/scenes/Ch4FabScene.ts`
- Modify: `src/scenes/Ch5PackageScene.ts`
- Modify: `src/scenes/Ch6DatacenterScene.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add pure progress tests**

Add to `src/sim/pace.test.ts`:

```ts
import { chapterProgressRatio } from './pace';

it('calculates progress from completed and total counts', () => {
  expect(chapterProgressRatio(3, 10)).toBe(0.3);
  expect(chapterProgressRatio(12, 10)).toBe(1);
  expect(chapterProgressRatio(1, 0)).toBe(1);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
corepack pnpm vitest run src/sim/pace.test.ts
```

Expected: FAIL because `chapterProgressRatio` does not exist.

- [ ] **Step 3: Add progress helper**

Add to `src/sim/pace.ts`:

```ts
export function chapterProgressRatio(completedUnits: number, totalUnits: number): number {
  if (totalUnits <= 0) {
    return 1;
  }

  return clamp(completedUnits / totalUnits, 0, 1);
}
```

- [ ] **Step 4: Emit progress snapshots from scenes**

For each chapter scene, compute a local `progressRatio` from existing scene-local state and emit:

```ts
gameStore.events.emit('debug:chapter-progress', {
  chapter: 1,
  elapsedSeconds: this.chapter.elapsedSeconds,
  progressRatio,
  targetSeconds: balance.ch1.pacingTargetSeconds
});
```

Use these ratios:
- Ch1: average completion across `balance.ch1.targetBasket`.
- Ch2: average of silicon nines progress from 2 to 9 and parallel targets.
- Ch3: pull stage `ingotHeight / targetIngotHeight`; slice stage `(0.6 + wafersProduced / guideCount * 0.4)`.
- Ch4: `nodeYields.length / wafersRequired`.
- Ch5: average of `sortedCount / sortSampleSize` and `builtChips.length / maxBuildChoices`.
- Ch6: average of non-hospital contracts served, Nova built, and hospital contract served.

- [ ] **Step 5: Apply catch-up only to passive progress/gains**

In each scene tick where a passive gain or passive progress is already calculated, compute:

```ts
const pace = calculatePaceStatus({
  chapter: 1,
  elapsedSeconds: this.chapter.elapsedSeconds,
  progressRatio,
  targetSeconds: balance.ch1.pacingTargetSeconds
}, {
  behindThreshold: balance.pace.catchUp.behindThreshold,
  catchUpMultiplier: balance.pace.catchUp.passiveMultiplier
});
```

Apply `pace.catchUpMultiplier` to existing passive mechanics:
- Ch1: boost positive extracted mineral delta before adding to resources.
- Ch2: multiply lane progress increments by catch-up multiplier, not energy/water costs.
- Ch3: multiply ingot growth while pulling, not energy/water costs.
- Ch4: no station score boost; emit pace only.
- Ch5: no bin score boost; emit pace only.
- Ch6: multiply contract credit rewards when behind, not power/heat math.

For Ch2/Ch3/Ch6, add optional pure-function parameters and tests before modifying scene callers:
- `tickRefinery(..., options?: { progressMultiplier?: number })`
- `tickCrystalPull(..., options?: { growthMultiplier?: number })`
- `serveContract(..., options?: { rewardMultiplier?: number })`

- [ ] **Step 6: Wire debug overlay updates**

In `src/main.ts`, subscribe to the new event:

```ts
const offDebugProgress = debugEnabled
  ? gameStore.events.on('debug:chapter-progress', (snapshot) => {
    debugOverlay?.update({
      pace: calculatePaceStatus(snapshot, {
        behindThreshold: balance.pace.catchUp.behindThreshold,
        catchUpMultiplier: balance.pace.catchUp.passiveMultiplier
      }),
      resources: gameStore.getState().resources,
      rates: currentDebugRates(snapshot)
    });
  })
  : undefined;
```

Add cleanup:

```ts
  offDebugProgress?.();
```

Implement `currentDebugRates(snapshot)` by comparing the latest resource snapshot and elapsed time in module-local variables. Return per-minute deltas for credits, energy, water, and chips.

- [ ] **Step 7: Verify**

Run:

```bash
corepack pnpm test
corepack pnpm build
```

Expected:
- All tests pass.
- TypeScript build passes.

---

## Task 7: Browser Smoke For Debug Overlay

**Files:**
- No source files unless smoke reveals a bug.

- [ ] **Step 1: Start local server**

If no server is running, run:

```bash
corepack pnpm dev -- --host localhost
```

If port 5173 is busy, use the port Vite prints.

- [ ] **Step 2: Desktop smoke**

Open:

```text
http://localhost:5173/?reset&debug=1#ch1
```

Verify:
- Debug overlay is visible.
- It shows `Debug Ch1`.
- `Ch4` button jumps to Chapter 4.
- `+Credits` changes HUD credits.
- Overlay does not cover the main objective/action controls.

- [ ] **Step 3: Mobile smoke**

Check `390 x 844` viewport at:

```text
http://localhost:5173/?reset&debug=1#ch6
```

Verify:
- Debug overlay remains readable.
- Debug buttons are tappable.
- Codex and Settings still open and close.
- No text overlaps inside debug buttons.

- [ ] **Step 4: Capture screenshots**

Save screenshots:

```text
/tmp/rock-to-rack-m9-debug-ch1.png
/tmp/rock-to-rack-m9-debug-ch6-mobile.png
```

---

## Task 8: Final Verification, Moderator, Retrospective, Handoff

**Files:**
- Modify: `docs/agent-context.md`
- Modify: `/Users/omar/.codex/session-log.md` only after implementation because M9 is COMPLEX.

- [ ] **Step 1: Run full verification**

Run:

```bash
corepack pnpm simulate
corepack pnpm test
corepack pnpm build
```

Expected:
- Simulate passes with profile totals in the required windows.
- Vitest passes.
- Build passes.
- Only known warning may remain: large Phaser bundle chunk.

- [ ] **Step 2: Update handoff**

Append to `docs/agent-context.md`:
- M9 implementation summary.
- Key files changed.
- Simulation report path.
- Verification commands and results.
- Browser smoke URLs and screenshot paths.
- Known residual notes.
- Next likely milestone: M10 Ship it.

- [ ] **Step 3: Moderator review**

Run a deliberate review pass:

```text
+--------------------------------------+
|         MODERATOR REVIEW             |
+--------------------------------------+
| Scope: M9 simulator, balance, debug  |
+--------------------------------------+
| [BLOCK] none after review             |
| [WARN]  none after review             |
| [NIT]   none after review             |
| [IDEA]  optional M10 follow-up        |
+--------------------------------------+
| Verdict: PASS | NEEDS_FIXES | REDESIGN |
+--------------------------------------+
```

Fix all `[BLOCK]` items and re-run verification before final response.

- [ ] **Step 4: Retrospective**

Emit:

```text
+----------------------------------+
|         RETROSPECTIVE            |
+----------------------------------+
| Worked:    Simulator and overlay share one pace model |
| Didn't:    Balance iteration required repeated runs   |
| Rule:      Keep future milestone timing in JSON       |
+----------------------------------+
```

- [ ] **Step 5: Session log**

Append to `/Users/omar/.codex/session-log.md`:

```markdown
## 2026-07-08 M9 Balance Pass and Playtest Instrumentation
Files changed: use the final changed-file count | Tests: pass | Retro: use the final retrospective line
Rule proposed: no
```

If this workspace is still not a git repo, note that no commit was possible.

---

## Self-Review

Spec coverage:
- `npm run simulate`: covered by `package.json` script and Task 2.
- Fast/average/slow bot profiles: covered by `BOT_PROFILES` and simulator tests.
- Per-chapter durations and resource curves: covered by result types, formatter, and report.
- Catch-up system: covered by `pace.ts`, `balance.json`, simulator tests, and scene wiring.
- Debug overlay: covered by UI tests and browser smoke.
- No hardcoded balance numbers outside JSON: covered by Task 3 constraints and final review.
- Simulation report: covered by Task 3.

Placeholder scan:
- The implementation tasks specify concrete files, APIs, tests, and commands.
- Replacement of initial simulator internals is sequenced chapter-by-chapter with required green checks.

Type consistency:
- `PaceSettings`, `PaceStatus`, and `ChapterPaceSnapshot` are introduced in Task 1 and reused by Tasks 4-6.
- `DebugOverlayState` is introduced in Task 4 and reused by Task 5.
- `DebugGrantKind` is introduced in Task 4 and reused by Task 5.
