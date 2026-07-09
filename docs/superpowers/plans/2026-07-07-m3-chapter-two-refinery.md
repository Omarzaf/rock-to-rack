# M3 Chapter Two Refinery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Chapter 2 stub with a playable refinery routing puzzle at `#ch2` where the player builds processing chains, reaches 9N silicon purity, manages energy/water/slag, answers the Field Check, and persists progress into Chapter 3.

**Architecture:** Keep refinery rules in pure `src/sim/refinery.ts` functions with Vitest coverage. Keep `Ch2RefineryScene` responsible for Phaser drawing, grid input, tick timing, and shared overlay mounting. Keep all balance values, events, quiz, and player-facing text in JSON content files.

**Tech Stack:** Phaser 3.90, TypeScript strict, Vite, Vitest, DOM overlays, local project binaries under `node_modules/.bin`.

---

## Classification

TYPE: `NEW_FEATURE`
COMPLEXITY: `COMPLEX`
SCOPE: `src/sim/`, `src/scenes/Ch2RefineryScene.ts`, `src/ui/`, `src/content/*.json`, `src/state/`, `src/fixtures/`, `src/styles.css`, tests
RISK: `MEDIUM` because this adds a second playable chapter and extends save state.

Human checkpoint before implementation: required. Do not edit implementation files until Umar approves this plan.

## Current Baseline

- `#ch1` is playable and visually polished.
- `#ch2` currently uses `ChapterStubScene`.
- `ChapterProgressState` currently contains only `ch1`.
- `ResourceState` has minerals, wafers, chips, energy, water, credits. It does not have purity or slag.
- Existing shared systems to reuse:
  - `src/sim/economy.ts`
  - `src/sim/events.ts`
  - `src/ui/pipelineHud.ts`
  - `src/ui/dialogueOverlay.ts`
  - `src/ui/factCard.ts`
  - `src/ui/eventCardOverlay.ts`
  - `src/ui/chapterOneOverlay.ts` patterns for quiz/completion mounting
- This directory is not a git repo. Any plan step that says "commit" must be treated as "not possible here; report changed files instead."

## M3 Design

Chapter 2 is a refinery routing puzzle, not a factory sim with arbitrary graph search. The grid is small and readable.

- Left side: raw silos showing Ch1 minerals.
- Center: a fixed processing grid with four lanes:
  - Silicon lane from quartz: Crusher -> Furnace -> Chemical Bath -> Zone Refiner.
  - Copper lane: Crusher -> Furnace.
  - Lithium lane: Crusher -> Chemical Bath.
  - Cobalt lane: Crusher -> Furnace -> Chemical Bath.
- Right side: targets.
  - Silicon target: 9N purity.
  - Parallel mineral targets: refined copper, lithium, cobalt.
- Player places modules from a palette onto grid cells.
- Conveyor lines auto-connect horizontally adjacent modules in each lane.
- A lane runs only when its placed modules match the required order from left to right.
- Each tick consumes energy/water, consumes small raw minerals, increases progress, and produces slag.
- Slag can be recycled for credits or stored. The inspection event rewards low/stored slag and penalizes unmanaged slag.
- The chapter ends when silicon reaches 9N and parallel refined targets are complete.

## File Structure

- Create `src/sim/refinery.ts`: pure refinery placement, lane validation, ticking, slag handling, goal progress, duration estimate.
- Create `src/sim/refinery.test.ts`: TDD coverage for placement, chain order, ticking, constraints, slag, and completion.
- Create `src/ui/chapterTwoOverlay.ts`: DOM overlay for purity meter, module palette, lane targets, selected cell, slag actions, quiz, and completion.
- Replace `src/scenes/Ch2RefineryScene.ts`: Phaser grid, modules, conveyors, silos, targets, intro/fact/event/quiz/completion flow.
- Modify `src/state/types.ts`: add `ChapterTwoProgress`.
- Modify `src/state/gameState.ts`: initialize and hydrate `chapters.ch2` safely.
- Modify `src/state/gameState.test.ts`: add Ch2 state and old-save hydration coverage.
- Modify `src/fixtures/chapterFixtures.ts`: `#ch2` fixture starts from Ch1-complete inventory; `#ch3+` fixtures mark Ch2 complete.
- Modify `src/content/balance.json`: add Ch2 modules, lane definitions, costs, rates, targets, event triggers, pacing.
- Modify `src/content/strings.json`: add Ch2 labels, intro dialogue, fact cards, completion copy.
- Modify `src/content/events.json`: add energy price spike and environmental inspection.
- Modify `src/content/quiz.json`: add Ch2 Field Check.
- Modify `src/styles.css`: add refinery overlay styles, module palette, purity meter, responsive layout.
- Modify `docs/agent-context.md`: append M3 status after implementation and verification.

## Task 1: Refinery Simulation API

**Files:**
- Create: `src/sim/refinery.ts`
- Create: `src/sim/refinery.test.ts`

- [ ] **Step 1: Write the failing placement tests**

Add `src/sim/refinery.test.ts` with the first test block:

```ts
import { describe, expect, it } from 'vitest';
import type { ResourceState } from '../state/types';
import {
  createInitialRefineryChapter,
  placeRefineryModule,
  type RefineryBalance,
  type RefineryModuleType
} from './refinery';

const resources: ResourceState = {
  minerals: {
    quartz: 40,
    copper: 20,
    lithium: 12,
    cobalt: 8,
    rareEarths: 4
  },
  wafers: 0,
  chips: 0,
  energy: 100,
  water: 100,
  credits: 500
};

const balance: RefineryBalance = {
  grid: { columns: 5, rows: 4 },
  moduleCost: { credits: 25 },
  tickSeconds: 1,
  slagCap: 30,
  recycleSlag: { slag: 4, credits: 18 },
  storeSlag: { slag: 6, credits: -10 },
  eventTriggers: {
    energySpikeAtSeconds: 10,
    inspectionAtSlag: 8
  },
  lanes: [
    {
      id: 'silicon',
      mineral: 'quartz',
      row: 0,
      requiredModules: ['crusher', 'furnace', 'chemicalBath', 'zoneRefiner'],
      mineralInputPerSecond: 0.02,
      energyPerSecond: 0.08,
      waterPerSecond: 0.05,
      slagPerSecond: 0.03,
      progressPerSecond: 0.018,
      target: 9
    }
  ],
  parallelTargets: {}
};

describe('refinery simulation', () => {
  it('places a module on an empty grid cell and spends credits', () => {
    const chapter = createInitialRefineryChapter(balance);

    const result = placeRefineryModule(chapter, resources, {
      laneId: 'silicon',
      column: 0,
      moduleType: 'crusher'
    }, balance);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resources.credits).toBe(475);
    expect(result.chapter.modules).toEqual([
      { id: 'module-silicon-0', laneId: 'silicon', column: 0, moduleType: 'crusher' }
    ]);
  });

  it('fails atomically when a cell is already occupied', () => {
    const chapter = createInitialRefineryChapter(balance);
    const first = placeRefineryModule(chapter, resources, {
      laneId: 'silicon',
      column: 0,
      moduleType: 'crusher'
    }, balance);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = placeRefineryModule(first.chapter, first.resources, {
      laneId: 'silicon',
      column: 0,
      moduleType: 'furnace'
    }, balance);

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe('cell-occupied');
    expect(second.resources).toEqual(first.resources);
    expect(second.chapter).toEqual(first.chapter);
  });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
node_modules/.bin/vitest run src/sim/refinery.test.ts
```

Expected: fail because `src/sim/refinery.ts` does not exist.

- [ ] **Step 3: Implement minimal placement API**

Create `src/sim/refinery.ts`:

```ts
import type { MineralType, ResourceState } from '../state/types';
import { addResources, spendResources, type ResourceCaps, type ResourceDelta } from './economy';

export type RefineryModuleType = 'crusher' | 'furnace' | 'chemicalBath' | 'zoneRefiner';
export type RefineryLaneId = 'silicon' | 'copper' | 'lithium' | 'cobalt';

export interface RefineryGrid {
  columns: number;
  rows: number;
}

export interface RefineryLaneBalance {
  id: RefineryLaneId;
  mineral: MineralType;
  row: number;
  requiredModules: RefineryModuleType[];
  mineralInputPerSecond: number;
  energyPerSecond: number;
  waterPerSecond: number;
  slagPerSecond: number;
  progressPerSecond: number;
  target: number;
}

export interface RefineryBalance {
  grid: RefineryGrid;
  moduleCost: ResourceDelta;
  tickSeconds: number;
  slagCap: number;
  recycleSlag: {
    slag: number;
    credits: number;
  };
  storeSlag: {
    slag: number;
    credits: number;
  };
  eventTriggers: {
    energySpikeAtSeconds: number;
    inspectionAtSlag: number;
  };
  lanes: RefineryLaneBalance[];
  parallelTargets: Partial<Record<Exclude<RefineryLaneId, 'silicon'>, number>>;
}

export interface PlacedRefineryModule {
  id: string;
  laneId: RefineryLaneId;
  column: number;
  moduleType: RefineryModuleType;
}

export interface RefineryChapterState {
  modules: PlacedRefineryModule[];
  laneProgress: Record<RefineryLaneId, number>;
  siliconPurityNines: number;
  refinedOutputs: Partial<Record<Exclude<RefineryLaneId, 'silicon'>, number>>;
  slag: number;
  storedSlag: number;
  elapsedSeconds: number;
  triggeredEvents: string[];
  firstFacts: string[];
}

export type PlaceRefineryModuleResult =
  | { ok: true; chapter: RefineryChapterState; resources: ResourceState; module: PlacedRefineryModule }
  | {
    ok: false;
    reason: 'lane-not-found' | 'column-out-of-bounds' | 'cell-occupied' | 'insufficient-resources';
    chapter: RefineryChapterState;
    resources: ResourceState;
  };

export function createInitialRefineryChapter(balance: RefineryBalance): RefineryChapterState {
  return {
    modules: [],
    laneProgress: Object.fromEntries(balance.lanes.map((lane) => [lane.id, 0])) as Record<RefineryLaneId, number>,
    siliconPurityNines: 2,
    refinedOutputs: {},
    slag: 0,
    storedSlag: 0,
    elapsedSeconds: 0,
    triggeredEvents: [],
    firstFacts: []
  };
}

export function placeRefineryModule(
  chapter: RefineryChapterState,
  resources: ResourceState,
  placement: { laneId: RefineryLaneId; column: number; moduleType: RefineryModuleType },
  balance: RefineryBalance
): PlaceRefineryModuleResult {
  const lane = balance.lanes.find((candidate) => candidate.id === placement.laneId);
  if (!lane) {
    return { ok: false, reason: 'lane-not-found', chapter, resources };
  }

  if (placement.column < 0 || placement.column >= balance.grid.columns) {
    return { ok: false, reason: 'column-out-of-bounds', chapter, resources };
  }

  if (chapter.modules.some((module) => module.laneId === placement.laneId && module.column === placement.column)) {
    return { ok: false, reason: 'cell-occupied', chapter, resources };
  }

  const spent = spendResources(resources, balance.moduleCost);
  if (!spent.ok) {
    return { ok: false, reason: 'insufficient-resources', chapter, resources };
  }

  const module: PlacedRefineryModule = {
    id: `module-${placement.laneId}-${placement.column}`,
    laneId: placement.laneId,
    column: placement.column,
    moduleType: placement.moduleType
  };

  return {
    ok: true,
    chapter: {
      ...chapter,
      modules: [...chapter.modules, module]
    },
    resources: spent.resources,
    module
  };
}

export function addRefineryResources(resources: ResourceState, delta: ResourceDelta, caps: ResourceCaps): ResourceState {
  return addResources(resources, delta, caps);
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node_modules/.bin/vitest run src/sim/refinery.test.ts
```

Expected: placement tests pass.

## Task 2: Refinery Tick, Chains, Slag, and Completion

**Files:**
- Modify: `src/sim/refinery.ts`
- Modify: `src/sim/refinery.test.ts`

- [ ] **Step 1: Add failing tests for chain order and ticking**

Extend the existing `./refinery` import in `src/sim/refinery.test.ts` so it includes:

```ts
getActiveLaneModules,
getRefineryGoalProgress,
recycleSlag,
storeSlag,
tickRefinery
```

Then append these tests:

```ts
it('treats only correctly ordered adjacent modules as an active chain', () => {
  let chapter = createInitialRefineryChapter(balance);
  const placements = [
    { laneId: 'silicon' as const, column: 0, moduleType: 'crusher' as const },
    { laneId: 'silicon' as const, column: 1, moduleType: 'furnace' as const },
    { laneId: 'silicon' as const, column: 2, moduleType: 'zoneRefiner' as const }
  ];

  for (const placement of placements) {
    const result = placeRefineryModule(chapter, resources, placement, balance);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    chapter = result.chapter;
  }

  expect(getActiveLaneModules(chapter, 'silicon', balance).map((module) => module.moduleType)).toEqual([
    'crusher',
    'furnace'
  ]);
});

it('ticks active lanes, consumes resources, raises purity progress, and produces slag', () => {
  let chapter = createInitialRefineryChapter(balance);
  let nextResources = resources;
  for (const [column, moduleType] of ['crusher', 'furnace', 'chemicalBath', 'zoneRefiner'].entries()) {
    const result = placeRefineryModule(chapter, nextResources, {
      laneId: 'silicon',
      column,
      moduleType: moduleType as RefineryModuleType
    }, balance);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    chapter = result.chapter;
    nextResources = result.resources;
  }

  const result = tickRefinery(chapter, nextResources, 60, balance, {
    minerals: { quartz: 80, copper: 60, lithium: 45, cobalt: 36, rareEarths: 30 },
    wafers: 24,
    chips: 40,
    energy: 100,
    water: 100,
    credits: 1000
  });

  expect(result.resources.energy).toBeLessThan(nextResources.energy);
  expect(result.resources.water).toBeLessThan(nextResources.water);
  expect(result.resources.minerals.quartz).toBeLessThan(nextResources.minerals.quartz);
  expect(result.chapter.siliconPurityNines).toBeGreaterThan(2);
  expect(result.chapter.slag).toBeGreaterThan(0);
});

it('does not tick when energy or water is insufficient', () => {
  const chapter = {
    ...createInitialRefineryChapter(balance),
    modules: [
      { id: 'module-silicon-0', laneId: 'silicon' as const, column: 0, moduleType: 'crusher' as const }
    ]
  };
  const poorResources = { ...resources, energy: 0 };

  const result = tickRefinery(chapter, poorResources, 60, balance, {
    minerals: { quartz: 80, copper: 60, lithium: 45, cobalt: 36, rareEarths: 30 },
    wafers: 24,
    chips: 40,
    energy: 100,
    water: 100,
    credits: 1000
  });

  expect(result.blockedReason).toBe('insufficient-energy-water');
  expect(result.chapter).toEqual(chapter);
  expect(result.resources).toEqual(poorResources);
});

it('recycles and stores slag through explicit actions', () => {
  const chapter = { ...createInitialRefineryChapter(balance), slag: 10 };

  const recycled = recycleSlag(chapter, resources, balance, {
    minerals: { quartz: 80, copper: 60, lithium: 45, cobalt: 36, rareEarths: 30 },
    wafers: 24,
    chips: 40,
    energy: 100,
    water: 100,
    credits: 1000
  });
  expect(recycled.chapter.slag).toBe(6);
  expect(recycled.resources.credits).toBe(518);

  const stored = storeSlag(chapter, resources, balance, {
    minerals: { quartz: 80, copper: 60, lithium: 45, cobalt: 36, rareEarths: 30 },
    wafers: 24,
    chips: 40,
    energy: 100,
    water: 100,
    credits: 1000
  });
  expect(stored.chapter.slag).toBe(4);
  expect(stored.chapter.storedSlag).toBe(6);
  expect(stored.resources.credits).toBe(490);
});

it('reports completion when silicon reaches 9N and parallel targets are met', () => {
  const chapter = {
    ...createInitialRefineryChapter({
      ...balance,
      parallelTargets: { copper: 2, lithium: 1 }
    }),
    siliconPurityNines: 9,
    refinedOutputs: { copper: 2, lithium: 1 }
  };

  expect(getRefineryGoalProgress(chapter, {
    ...balance,
    parallelTargets: { copper: 2, lithium: 1 }
  }).complete).toBe(true);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node_modules/.bin/vitest run src/sim/refinery.test.ts
```

Expected: fail for missing tick/slag/progress exports.

- [ ] **Step 3: Implement refinery tick API**

Extend `src/sim/refinery.ts` with:

```ts
export type RefineryBlockedReason = 'insufficient-energy-water' | 'insufficient-minerals' | 'slag-capacity';

export interface TickRefineryResult {
  chapter: RefineryChapterState;
  resources: ResourceState;
  blockedReason: RefineryBlockedReason | null;
}

export interface RefineryGoalProgress {
  siliconComplete: boolean;
  parallelComplete: boolean;
  complete: boolean;
}

export function getActiveLaneModules(
  chapter: RefineryChapterState,
  laneId: RefineryLaneId,
  balance: RefineryBalance
): PlacedRefineryModule[] {
  const lane = balance.lanes.find((candidate) => candidate.id === laneId);
  if (!lane) {
    return [];
  }

  const byColumn = chapter.modules
    .filter((module) => module.laneId === laneId)
    .sort((a, b) => a.column - b.column);

  const active: PlacedRefineryModule[] = [];
  for (let index = 0; index < lane.requiredModules.length; index += 1) {
    const module = byColumn.find((candidate) => candidate.column === index);
    if (!module || module.moduleType !== lane.requiredModules[index]) {
      break;
    }
    active.push(module);
  }

  return active;
}

export function tickRefinery(
  chapter: RefineryChapterState,
  resources: ResourceState,
  elapsedSeconds: number,
  balance: RefineryBalance,
  caps: ResourceCaps
): TickRefineryResult {
  if (elapsedSeconds <= 0) {
    return { chapter, resources, blockedReason: null };
  }

  let mineralCost: Partial<Record<MineralType, number>> = {};
  let energyCost = 0;
  let waterCost = 0;
  let slagProduced = 0;
  const laneIncrements: Partial<Record<RefineryLaneId, number>> = {};

  for (const lane of balance.lanes) {
    const activeModules = getActiveLaneModules(chapter, lane.id, balance);
    if (activeModules.length !== lane.requiredModules.length) {
      continue;
    }

    mineralCost = {
      ...mineralCost,
      [lane.mineral]: (mineralCost[lane.mineral] ?? 0) + lane.mineralInputPerSecond * elapsedSeconds
    };
    energyCost += lane.energyPerSecond * elapsedSeconds;
    waterCost += lane.waterPerSecond * elapsedSeconds;
    slagProduced += lane.slagPerSecond * elapsedSeconds;
    laneIncrements[lane.id] = lane.progressPerSecond * elapsedSeconds;
  }

  if (Object.keys(laneIncrements).length === 0) {
    return {
      chapter: {
        ...chapter,
        elapsedSeconds: round(chapter.elapsedSeconds + elapsedSeconds)
      },
      resources,
      blockedReason: null
    };
  }

  if (resources.energy < energyCost || resources.water < waterCost) {
    return { chapter, resources, blockedReason: 'insufficient-energy-water' };
  }

  if (Object.entries(mineralCost).some(([mineral, amount]) => resources.minerals[mineral as MineralType] < amount)) {
    return { chapter, resources, blockedReason: 'insufficient-minerals' };
  }

  if (chapter.slag + slagProduced > balance.slagCap) {
    return { chapter, resources, blockedReason: 'slag-capacity' };
  }

  const nextResources = addResources(resources, {
    minerals: Object.fromEntries(Object.entries(mineralCost).map(([mineral, amount]) => [mineral, -round(amount)])),
    energy: -round(energyCost),
    water: -round(waterCost)
  }, caps);

  let siliconPurityNines = chapter.siliconPurityNines;
  const refinedOutputs = { ...chapter.refinedOutputs };
  const laneProgress = { ...chapter.laneProgress };

  for (const [laneId, increment] of Object.entries(laneIncrements) as Array<[RefineryLaneId, number]>) {
    const lane = balance.lanes.find((candidate) => candidate.id === laneId);
    if (!lane) continue;

    laneProgress[laneId] = round((laneProgress[laneId] ?? 0) + increment);
    while (laneProgress[laneId] >= 1) {
      laneProgress[laneId] = round(laneProgress[laneId] - 1);
      if (laneId === 'silicon') {
        siliconPurityNines = Math.min(lane.target, siliconPurityNines + 1);
      } else {
        refinedOutputs[laneId as Exclude<RefineryLaneId, 'silicon'>] = round(
          (refinedOutputs[laneId as Exclude<RefineryLaneId, 'silicon'>] ?? 0) + 1
        );
      }
    }
  }

  return {
    chapter: {
      ...chapter,
      laneProgress,
      siliconPurityNines,
      refinedOutputs,
      slag: round(chapter.slag + slagProduced),
      elapsedSeconds: round(chapter.elapsedSeconds + elapsedSeconds)
    },
    resources: nextResources,
    blockedReason: null
  };
}

export function recycleSlag(
  chapter: RefineryChapterState,
  resources: ResourceState,
  balance: RefineryBalance,
  caps: ResourceCaps
): { chapter: RefineryChapterState; resources: ResourceState } {
  const slag = Math.min(chapter.slag, balance.recycleSlag.slag);
  return {
    chapter: { ...chapter, slag: round(chapter.slag - slag) },
    resources: addResources(resources, { credits: balance.recycleSlag.credits }, caps)
  };
}

export function storeSlag(
  chapter: RefineryChapterState,
  resources: ResourceState,
  balance: RefineryBalance,
  caps: ResourceCaps
): { chapter: RefineryChapterState; resources: ResourceState } {
  const slag = Math.min(chapter.slag, balance.storeSlag.slag);
  return {
    chapter: {
      ...chapter,
      slag: round(chapter.slag - slag),
      storedSlag: round(chapter.storedSlag + slag)
    },
    resources: addResources(resources, { credits: balance.storeSlag.credits }, caps)
  };
}

export function getRefineryGoalProgress(chapter: RefineryChapterState, balance: RefineryBalance): RefineryGoalProgress {
  const siliconComplete = chapter.siliconPurityNines >= 9;
  const parallelComplete = Object.entries(balance.parallelTargets).every(([laneId, target]) => {
    return (chapter.refinedOutputs[laneId as Exclude<RefineryLaneId, 'silicon'>] ?? 0) >= (target ?? 0);
  });

  return {
    siliconComplete,
    parallelComplete,
    complete: siliconComplete && parallelComplete
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node_modules/.bin/vitest run src/sim/refinery.test.ts
node_modules/.bin/vitest run
```

Expected: all tests pass.

## Task 3: Save State and Fixtures

**Files:**
- Modify: `src/state/types.ts`
- Modify: `src/state/gameState.ts`
- Modify: `src/state/gameState.test.ts`
- Modify: `src/fixtures/chapterFixtures.ts`

- [ ] **Step 1: Add failing state tests**

In `src/state/gameState.test.ts`, add:

```ts
it('initializes Chapter 2 progress', () => {
  const state = createInitialGameState();
  expect(state.chapters.ch2).toEqual({
    completed: false,
    completedAtSeconds: null,
    quizCorrect: null,
    siliconPurityNines: 2,
    refinedOutputs: {},
    slag: 0,
    storedSlag: 0,
    firstFacts: []
  });
});

it('hydrates old saves without Chapter 2 progress', () => {
  const state = hydrateGameState(JSON.stringify({
    version: SAVE_VERSION,
    preferences: { textMode: 'kid', muted: true },
    progress: { currentChapter: 2, unlockedChapters: [1, 2], activeScene: 'Ch2RefineryScene' },
    resources: {
      minerals: { quartz: 20, copper: 12, lithium: 8, cobalt: 6, rareEarths: 4 },
      wafers: 0,
      chips: 0,
      energy: 100,
      water: 100,
      credits: 400
    },
    chapters: {
      ch1: {
        firstMined: ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'],
        completed: true,
        completedAtSeconds: 660,
        quizCorrect: true
      }
    },
    updatedAt: new Date(0).toISOString()
  }));

  expect(state.chapters.ch2.completed).toBe(false);
  expect(state.chapters.ch2.siliconPurityNines).toBe(2);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
node_modules/.bin/vitest run src/state/gameState.test.ts
```

Expected: fail because `ch2` is not in `ChapterProgressState`.

- [ ] **Step 3: Add Ch2 types and hydration**

Modify `src/state/types.ts`:

```ts
export interface ChapterTwoProgress {
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
  siliconPurityNines: number;
  refinedOutputs: Partial<Record<'copper' | 'lithium' | 'cobalt', number>>;
  slag: number;
  storedSlag: number;
  firstFacts: string[];
}

export interface ChapterProgressState {
  ch1: ChapterOneProgress;
  ch2: ChapterTwoProgress;
}
```

Modify `createInitialGameState()` in `src/state/gameState.ts` so `chapters` includes:

```ts
ch2: {
  completed: false,
  completedAtSeconds: null,
  quizCorrect: null,
  siliconPurityNines: 2,
  refinedOutputs: {},
  slag: 0,
  storedSlag: 0,
  firstFacts: []
}
```

Extend `chaptersOr()` with `ch2` hydration using local helpers:

```ts
const ch2 = isRecord(value.ch2) ? value.ch2 : {};
return {
  ch1: { ...existingCh1Hydration },
  ch2: {
    completed: typeof ch2.completed === 'boolean' ? ch2.completed : fallback.ch2.completed,
    completedAtSeconds: nullableNumberOr(ch2.completedAtSeconds, fallback.ch2.completedAtSeconds),
    quizCorrect: nullableBooleanOr(ch2.quizCorrect, fallback.ch2.quizCorrect),
    siliconPurityNines: numberOr(ch2.siliconPurityNines, fallback.ch2.siliconPurityNines),
    refinedOutputs: refinedOutputsOr(ch2.refinedOutputs, fallback.ch2.refinedOutputs),
    slag: numberOr(ch2.slag, fallback.ch2.slag),
    storedSlag: numberOr(ch2.storedSlag, fallback.ch2.storedSlag),
    firstFacts: stringListOr(ch2.firstFacts, fallback.ch2.firstFacts)
  }
};
```

Add helpers:

```ts
function refinedOutputsOr(value: unknown, fallback: Partial<Record<'copper' | 'lithium' | 'cobalt', number>>) {
  if (!isRecord(value)) return fallback;
  return {
    copper: numberOr(value.copper, fallback.copper ?? 0),
    lithium: numberOr(value.lithium, fallback.lithium ?? 0),
    cobalt: numberOr(value.cobalt, fallback.cobalt ?? 0)
  };
}

function stringListOr(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === 'string');
}
```

- [ ] **Step 4: Update fixtures**

Modify `src/fixtures/chapterFixtures.ts`:

- `#ch2` should keep `ch2.completed = false`, `siliconPurityNines = 2`.
- `#ch3+` should set `ch2.completed = true`, `siliconPurityNines = 9`, `refinedOutputs = { copper: 6, lithium: 4, cobalt: 3 }`, `completedAtSeconds = 720`, `quizCorrect = true`.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
node_modules/.bin/vitest run src/state/gameState.test.ts
node_modules/.bin/vitest run
```

Expected: all tests pass.

## Task 4: M3 Content

**Files:**
- Modify: `src/content/balance.json`
- Modify: `src/content/strings.json`
- Modify: `src/content/events.json`
- Modify: `src/content/quiz.json`
- Modify: `src/content/SOURCES.md`

- [ ] **Step 1: Add Ch2 balance**

Add `ch2` to `src/content/balance.json`:

```json
"ch2": {
  "grid": { "columns": 5, "rows": 4 },
  "moduleCost": { "credits": 25 },
  "tickSeconds": 1,
  "slagCap": 30,
  "recycleSlag": { "slag": 4, "credits": 18 },
  "storeSlag": { "slag": 6, "credits": -10 },
  "pacingTargetSeconds": { "min": 660, "max": 780 },
  "eventTriggers": {
    "energySpikeAtSeconds": 14,
    "inspectionAtSlag": 8
  },
  "parallelTargets": {
    "copper": 6,
    "lithium": 4,
    "cobalt": 3
  },
  "lanes": [
    {
      "id": "silicon",
      "mineral": "quartz",
      "row": 0,
      "requiredModules": ["crusher", "furnace", "chemicalBath", "zoneRefiner"],
      "mineralInputPerSecond": 0.018,
      "energyPerSecond": 0.045,
      "waterPerSecond": 0.035,
      "slagPerSecond": 0.018,
      "progressPerSecond": 0.0105,
      "target": 9
    },
    {
      "id": "copper",
      "mineral": "copper",
      "row": 1,
      "requiredModules": ["crusher", "furnace"],
      "mineralInputPerSecond": 0.012,
      "energyPerSecond": 0.025,
      "waterPerSecond": 0.012,
      "slagPerSecond": 0.01,
      "progressPerSecond": 0.014,
      "target": 6
    },
    {
      "id": "lithium",
      "mineral": "lithium",
      "row": 2,
      "requiredModules": ["crusher", "chemicalBath"],
      "mineralInputPerSecond": 0.01,
      "energyPerSecond": 0.018,
      "waterPerSecond": 0.028,
      "slagPerSecond": 0.012,
      "progressPerSecond": 0.012,
      "target": 4
    },
    {
      "id": "cobalt",
      "mineral": "cobalt",
      "row": 3,
      "requiredModules": ["crusher", "furnace", "chemicalBath"],
      "mineralInputPerSecond": 0.008,
      "energyPerSecond": 0.024,
      "waterPerSecond": 0.018,
      "slagPerSecond": 0.014,
      "progressPerSecond": 0.011,
      "target": 3
    }
  ]
}
```

- [ ] **Step 2: Add events**

Add `ch2EnergySpike` and `ch2Inspection` to `src/content/events.json`:

```json
"ch2EnergySpike": {
  "id": "ch2-energy-spike",
  "title": {
    "kid": "Energy Price Spike",
    "nerd": "Refining Power Cost Shock"
  },
  "scenario": {
    "kid": "Electricity gets expensive right when the furnaces are hot. Slow down or buy cleaner power.",
    "nerd": "Refining is energy intensive, so electricity price and grid reliability shape where purification capacity is built."
  },
  "choices": [
    {
      "id": "buy-clean-power",
      "label": { "kid": "Buy cleaner power", "nerd": "Procure low-carbon power" },
      "effects": { "credits": -70, "energy": 20 }
    },
    {
      "id": "slow-the-line",
      "label": { "kid": "Slow the line", "nerd": "Throttle refinery throughput" },
      "timePenaltySeconds": 40,
      "effects": { "energy": 8 }
    }
  ]
},
"ch2Inspection": {
  "id": "ch2-environmental-inspection",
  "title": {
    "kid": "Inspection Day",
    "nerd": "Waste Handling Audit"
  },
  "scenario": {
    "kid": "Inspectors check the slag pile. Recycle it or pay to store it safely.",
    "nerd": "Processing waste must be managed. Recycling recovers value, while storage reduces immediate risk at a budget cost."
  },
  "choices": [
    {
      "id": "recycle-slag",
      "label": { "kid": "Recycle slag", "nerd": "Recover value from waste" },
      "effects": { "credits": 45 }
    },
    {
      "id": "store-safely",
      "label": { "kid": "Store safely", "nerd": "Pay for compliant storage" },
      "effects": { "credits": -35, "water": 8 }
    }
  ]
}
```

- [ ] **Step 3: Add quiz**

Add `ch2FieldCheck` to `src/content/quiz.json`:

```json
"ch2FieldCheck": {
  "id": "ch2-field-check",
  "question": {
    "kid": "Why does chip silicon need to be SO pure?",
    "nerd": "Why do semiconductor wafers require extremely high-purity silicon?"
  },
  "answers": [
    {
      "id": "tiny-circuits-break",
      "label": {
        "kid": "Tiny dirt can break tiny circuits",
        "nerd": "Trace impurities can disrupt transistor behavior"
      },
      "correct": true,
      "explanation": {
        "kid": "Yes. Chip parts are so tiny that a small bit of the wrong stuff can cause problems.",
        "nerd": "Correct. Semiconductor devices depend on controlled electrical behavior, so uncontrolled impurities can create defects and leakage."
      }
    },
    {
      "id": "make-it-shiny",
      "label": { "kid": "To make it shiny", "nerd": "To improve reflectivity" },
      "correct": false,
      "explanation": {
        "kid": "Shiny is fun, but purity is about making circuits work.",
        "nerd": "Reflectivity is not the core reason. The key issue is electrical control at microscopic scales."
      }
    },
    {
      "id": "make-it-heavier",
      "label": { "kid": "To make it heavier", "nerd": "To increase material density" },
      "correct": false,
      "explanation": {
        "kid": "No. The goal is not weight. The goal is clean material for tiny circuits.",
        "nerd": "Density is not the design target. High purity reduces unwanted electrical behavior."
      }
    }
  ]
}
```

- [ ] **Step 4: Add strings**

Add `ch2` to `src/content/strings.json` with:

- title/subtitle.
- labels: purity, nines, module palette, raw silos, targets, slag, recycle, store, selected module, build module, completion, next chapter.
- intro: four short lines from Sam and Dr. Vega.
- facts:
  - `ch2-nine-nines`
  - `ch2-energy-hungry`
  - `ch2-recycling-ewaste`
- completion body that previews Chapter 3 ingot growth.

Use kid text at roughly 4th-5th grade reading level and nerd text with adult technical detail. Keep all strings as `{ "kid": "...", "nerd": "..." }`.

- [ ] **Step 5: Add source notes**

Append to `src/content/SOURCES.md`:

```md
## Chapter 2 Refinery

- Silicon purification and polysilicon context: USGS Mineral Commodity Summaries 2026, Silicon.
- Refining energy/water framing: use source-backed public summaries when final copy is polished.
- Recycling/waste framing: use source-backed public summaries when final copy is polished.
```

- [ ] **Step 6: Verify JSON parses**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('src/content/balance.json','utf8')); JSON.parse(require('fs').readFileSync('src/content/events.json','utf8')); JSON.parse(require('fs').readFileSync('src/content/quiz.json','utf8')); JSON.parse(require('fs').readFileSync('src/content/strings.json','utf8')); console.log('json ok')"
```

Expected: `json ok`.

## Task 5: Chapter 2 DOM Overlay

**Files:**
- Create: `src/ui/chapterTwoOverlay.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Create overlay API**

Create `src/ui/chapterTwoOverlay.ts` with:

```ts
import type { ResourceState, TextMode } from '../state/types';
import type {
  RefineryBalance,
  RefineryChapterState,
  RefineryLaneId,
  RefineryModuleType
} from '../sim/refinery';
import type { ChapterOneLabels, MountedModal, QuizDefinition } from './chapterOneOverlay';
import { mountChapterCompleteOverlay, mountQuizOverlay } from './chapterOneOverlay';
import type { TextModeText } from './text';
import { textForMode } from './text';

export interface ChapterTwoLabels {
  purity: TextModeText;
  nines: TextModeText;
  modulePalette: TextModeText;
  rawSilos: TextModeText;
  targets: TextModeText;
  slag: TextModeText;
  recycleSlag: TextModeText;
  storeSlag: TextModeText;
  selectedModule: TextModeText;
  buildModule: TextModeText;
  menu: TextModeText;
  toggleMode: TextModeText;
  quizTitle: TextModeText;
  nextChapter: TextModeText;
  stats: TextModeText;
}

export interface ChapterTwoOverlayOptions {
  resources: ResourceState;
  chapter: RefineryChapterState;
  balance: RefineryBalance;
  labels: ChapterTwoLabels;
  moduleNames: Record<RefineryModuleType, TextModeText>;
  laneNames: Record<RefineryLaneId, TextModeText>;
  selectedModule: RefineryModuleType;
  textMode: TextMode;
  message: TextModeText | null;
  onSelectModule: (moduleType: RefineryModuleType) => void;
  onRecycleSlag: () => void;
  onStoreSlag: () => void;
  onToggleMode: () => void;
  onMenu: () => void;
}

export interface MountedChapterTwoOverlay {
  update: (options: ChapterTwoOverlayOptions) => void;
  cleanup: () => void;
}

export function mountChapterTwoOverlay(root: HTMLElement, options: ChapterTwoOverlayOptions): MountedChapterTwoOverlay {
  const shell = document.createElement('section');
  shell.className = 'ch2-overlay';
  root.append(shell);

  const render = (nextOptions: ChapterTwoOverlayOptions): void => {
    shell.replaceChildren(
      purityPanel(nextOptions),
      palettePanel(nextOptions),
      slagPanel(nextOptions),
      actionPanel(nextOptions)
    );
  };

  render(options);

  return {
    update: render,
    cleanup: () => shell.remove()
  };
}

export function mountChapterTwoQuiz(root: HTMLElement, options: {
  quiz: QuizDefinition;
  labels: ChapterTwoLabels;
  textMode: TextMode;
  onAnswer: Parameters<typeof mountQuizOverlay>[1]['onAnswer'];
}): MountedModal {
  const labels: ChapterOneLabels = {
    targetBasket: options.labels.targets,
    minerSlots: options.labels.modulePalette,
    selectedDeposit: options.labels.selectedModule,
    noDeposit: options.labels.selectedModule,
    placeMiner: options.labels.buildModule,
    removeMiner: options.labels.buildModule,
    depleted: options.labels.slag,
    producing: options.labels.purity,
    depth: options.labels.purity,
    remaining: options.labels.targets,
    cost: options.labels.slag,
    quizTitle: options.labels.quizTitle,
    correct: options.labels.quizTitle,
    tryAgain: options.labels.quizTitle,
    chapterComplete: options.labels.purity,
    nextChapter: options.labels.nextChapter,
    stats: options.labels.stats,
    menu: options.labels.menu,
    toggleMode: options.labels.toggleMode
  };
  return mountQuizOverlay(root, {
    quiz: options.quiz,
    labels,
    textMode: options.textMode,
    onAnswer: options.onAnswer
  });
}

export function mountChapterTwoComplete(root: HTMLElement, options: Parameters<typeof mountChapterCompleteOverlay>[1]): MountedModal {
  return mountChapterCompleteOverlay(root, options);
}
```

Then implement local helper functions in the same file:

- `purityPanel(options)` renders `2N` through `9N` and target progress.
- `palettePanel(options)` renders four module buttons.
- `slagPanel(options)` renders slag/stored slag and recycle/store buttons.
- `actionPanel(options)` renders text mode toggle and menu.

- [ ] **Step 2: Add CSS**

In `src/styles.css`, add `.ch2-overlay`, `.ch2-purity-panel`, `.ch2-palette-panel`, `.ch2-slag-panel`, `.ch2-action-panel`, `.ch2-module-button`, `.ch2-purity-rail`, `.ch2-purity-dot`, `.ch2-purity-dot.active`, and mobile styles. Follow the lighter Chapter 1 polish style: translucent panels, 8px radius, playfield protected.

- [ ] **Step 3: Verify TypeScript**

Run:

```bash
node_modules/.bin/tsc --noEmit
```

Expected: pass after helper functions are complete.

## Task 6: Chapter 2 Scene

**Files:**
- Replace: `src/scenes/Ch2RefineryScene.ts`

- [ ] **Step 1: Replace stub with scene skeleton**

Replace `src/scenes/Ch2RefineryScene.ts` with a Phaser scene that:

- Imports `balance.json`, `strings.json`, `events.json`, `quiz.json`.
- Creates `this.chapter = createInitialRefineryChapter(BALANCE.ch2)`.
- Mounts `mountPipelineHud()` and `mountChapterTwoOverlay()`.
- Draws backdrop, silos, grid, targets.
- Shows intro dialogue.
- Adds a timed tick using `this.time.addEvent({ delay: BALANCE.ch2.tickSeconds * 1000, loop: true, callback: ... })`.
- Cleans overlays on shutdown.

- [ ] **Step 2: Implement grid input**

In the scene:

- Track `selectedModuleType`, default `crusher`.
- Create invisible zones for each grid cell.
- On cell click, call `placeRefineryModule()`.
- On success, update chapter/resources, draw module shape, refresh overlay.
- On failure, show a local message from `strings.ch2.messages`.

Module visual language:

- Crusher: block with jaws.
- Furnace: orange glowing box.
- Chemical Bath: teal vat.
- Zone Refiner: violet column.

- [ ] **Step 3: Implement tick flow**

On each tick:

- Skip when dialogue/fact/event/quiz/completion is active.
- Call `tickRefinery()`.
- Update HUD and overlay.
- Redraw purity meter and lane status.
- Queue fact cards:
  - first silicon purity increase: `ch2-nine-nines`
  - first energy/water constrained tick: `ch2-energy-hungry`
  - first slag production or slag action: `ch2-recycling-ewaste`
- Trigger events:
  - energy spike at elapsed seconds.
  - environmental inspection at slag threshold.
- If complete, show quiz.

- [ ] **Step 4: Implement events and slag actions**

- Event cards use existing `mountEventCard()` and `applyEventChoice()`.
- `ch2Inspection` choice should also call `recycleSlag()` or `storeSlag()` when matching choice ids.
- Overlay buttons call `recycleSlag()` and `storeSlag()` directly.

- [ ] **Step 5: Implement quiz/completion**

- Quiz uses `ch2FieldCheck`.
- Emit `analytics:event` with `name: 'quiz_answer'`, `questionId`, `answerId`, `correct`, `scene: SceneKey.Ch2Refinery`.
- Wrong answer shows explanation and retries.
- Correct answer persists `chapters.ch2.completed = true`, `quizCorrect = true`, `completedAtSeconds`, `siliconPurityNines`, `refinedOutputs`, `slag`, `storedSlag`, then shows completion.
- Completion button sets `window.location.hash = 'ch3'`, calls `gameStore.enterScene(SceneKey.Ch3Crystal, 3)`, and starts `SceneKey.Ch3Crystal`.

## Task 7: Browser Verification Script

**Files:**
- No committed test file required unless useful.

- [ ] **Step 1: Run full automated smoke manually with Playwright**

Use a `node --input-type=module` Playwright script that:

- Opens `http://127.0.0.1:5174/?reset#ch2`.
- Dismisses intro.
- Selects and places all modules in valid lane order.
- Waits for first fact cards and both event cards.
- Uses exact Vite-loaded `gameStore.ts` URL from `performance.getEntriesByType('resource')` before runtime state injection.
- Accelerates completion by setting `chapters.ch2.siliconPurityNines = 9` and `refinedOutputs = { copper: 6, lithium: 4, cobalt: 3 }` if needed after validating normal tick behavior.
- Answers quiz wrong then correct.
- Verifies `quiz_answer` analytics include both wrong and correct answers.
- Clicks `Next` and verifies `#ch3`, `currentChapter = 3`, `unlockedChapters` includes 3, `ch2.completed = true`.
- Captures:
  - `/tmp/rock-to-rack-m3-ch2-grid.png`
  - `/tmp/rock-to-rack-m3-ch2-complete.png`
  - `/tmp/rock-to-rack-m3-ch2-mobile.png`

- [ ] **Step 2: Inspect screenshots**

Use `functions.view_image` for the three screenshots. Fix overlap, unreadable text, or playfield obstruction before final.

## Task 8: Final Verification and Handoff

**Files:**
- Modify: `docs/agent-context.md`

- [ ] **Step 1: Run final checks**

Run:

```bash
node_modules/.bin/vitest run
node_modules/.bin/tsc --noEmit
node_modules/.bin/vite build
```

Expected:

- All tests pass.
- TypeScript passes.
- Vite build passes.
- Existing Phaser chunk-size warning is acceptable.

- [ ] **Step 2: Update context handoff**

Append to `docs/agent-context.md`:

- M3 implemented.
- Files changed.
- Verification evidence.
- Screenshot paths.
- Known warnings.
- Next likely step is M4, pending user approval.

- [ ] **Step 3: Moderator review**

Use the standard review template:

```text
╔══════════════════════════════════════╗
║         MODERATOR REVIEW             ║
╠══════════════════════════════════════╣
║ Scope: Ch2 refinery scene, sim, state, content, overlay, tests |
╠══════════════════════════════════════╣
║ [BLOCK] ...                          ║
║ [WARN]  ...                          ║
║ [NIT]   ...                          ║
║ [IDEA]  ...                          ║
╠══════════════════════════════════════╣
║ Verdict: PASS | NEEDS_FIXES | REDESIGN
╚══════════════════════════════════════╝
```

- [ ] **Step 4: Retrospective**

Emit:

```text
╔══════════════════════════════════╗
║         RETROSPECTIVE            ║
╠══════════════════════════════════╣
║ ✓ Worked:    <one line>          ║
║ ✗ Didn't:    <one line>          ║
║ → Rule:      <concrete proposal> ║
╚══════════════════════════════════╝
```

## Approval Gate

Do not implement this plan until Umar approves it.
