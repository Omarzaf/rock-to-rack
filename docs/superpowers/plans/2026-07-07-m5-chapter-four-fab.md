# M5 Chapter 4 Fab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Chapter 4 stub with a playable Fab chapter at `#ch4` where the player processes three wafers through coat, expose, etch, and dope stations, sees a die-yield map, answers the Field Check, and persists chip output into Chapter 5.

**Architecture:** Keep yield math, station scoring, node tolerances, event penalties, and die-map generation in pure `src/sim/fab.ts` functions with Vitest coverage. Keep `Ch4FabScene` responsible for Phaser drawing, pointer/keyboard input, timed station updates, and shared overlay mounting. Keep all balance values, event/quiz definitions, and player-facing text in JSON content files.

**Tech Stack:** Phaser 3.90, TypeScript strict, Vite, Vitest, DOM overlays, local binaries through `corepack pnpm ...` or `node_modules/.bin`.

---

## Classification

TYPE: `NEW_FEATURE`
COMPLEXITY: `COMPLEX`
SCOPE: `src/sim/`, `src/scenes/Ch4FabScene.ts`, `src/ui/`, `src/content/*.json`, `src/state/`, `src/fixtures/`, `src/styles.css`, tests, docs
RISK: `MEDIUM` because this adds the signature chapter and extends save state for Chapter 5.

Human checkpoint before implementation: required by AGENTS.md for COMPLEX tasks. Do not edit implementation files until Umar approves this plan.

## Current Baseline

- `#ch1`, `#ch2`, and `#ch3` are playable and verified.
- `#ch4` currently extends `ChapterStubScene`.
- `GameState.resources.wafers` exists and `chapters.ch3.waferQuality` carries the input quality for fabrication.
- There is no Chapter 4 progress state, die yield state, or chip output metadata yet.
- Existing shared systems to reuse:
  - `src/sim/economy.ts`
  - `src/sim/events.ts`
  - `src/ui/pipelineHud.ts`
  - `src/ui/dialogueOverlay.ts`
  - `src/ui/eventCardOverlay.ts`
  - `src/ui/factCard.ts`
  - `src/ui/chapterOneOverlay.ts` modal helpers

## Final Design

Chapter 4 is a four-station cleanroom minigame repeated across three wafers:

1. **Coat:** player click-drags across a wafer to spread photoresist. Score is coverage plus evenness.
2. **Expose:** player aligns a drifting mask over a target using drag or arrow keys, then clicks Flash UV. Score is inverse alignment error.
3. **Etch:** player holds the wafer in an acid bath and releases near a target dwell time. Score penalizes under-etch and over-etch.
4. **Dope:** player clicks implant zones in the requested color/order. Score rewards matches and penalizes misses.

The three wafers represent smaller nodes: `90nm`, `28nm`, and `7nm`. Each node has tighter tolerances and higher chip value. After each wafer, the scene shows a die grid where defective dies are red and good dies are bright. Chapter completion persists total chips, average yield, per-node yields, best node, and fact-card unlocks into `chapters.ch4`.

## Files

Create:

- `src/sim/fab.ts` — pure station scoring, yield calculation, die-map generation, wafer completion, and chapter goal scoring.
- `src/sim/fab.test.ts` — focused tests for station scoring, node difficulty ramp, yield math, die-map determinism, event penalties, and completion.
- `src/ui/chapterFourOverlay.ts` — DOM overlay for station, wafer/node, yield, station scores, instructions, controls, quiz bridge, and completion bridge.

Modify:

- `src/scenes/Ch4FabScene.ts` — replace stub with playable Phaser scene.
- `src/state/types.ts` — add `ChapterFourProgress`.
- `src/state/gameState.ts` — initialize and hydrate `chapters.ch4`.
- `src/state/gameState.test.ts` — cover initial Ch4 progress, old-save hydration, and `#ch5` fixture completion.
- `src/fixtures/chapterFixtures.ts` — `#ch4` fixture starts with Ch3 complete and wafers; `#ch5+` fixtures mark Ch4 complete and provide chips.
- `src/content/balance.json` — add `ch4` balance.
- `src/content/events.json` — add dust contamination and tool calibration events.
- `src/content/quiz.json` — add Ch4 Field Check.
- `src/content/strings.json` — add Ch4 labels, station text, intro, facts, messages, and completion.
- `src/content/SOURCES.md` — add M5 source note.
- `src/styles.css` — add Ch4 overlay and responsive styles.
- `docs/agent-context.md` — update handoff and verification evidence after implementation.

## State Model

Add:

```ts
export type FabNodeId = '90nm' | '28nm' | '7nm';

export interface FabNodeYield {
  node: FabNodeId;
  yieldPercent: number;
  goodDies: number;
  defectiveDies: number;
}

export interface ChapterFourProgress {
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
  wafersProcessed: number;
  averageYield: number;
  bestYield: number;
  chipsProduced: number;
  nodeYields: FabNodeYield[];
  firstFacts: string[];
}
```

`resources.chips` stores the global chip count used by Chapter 5. `chapters.ch4.nodeYields` stores the fab-specific quality and yield metadata.

## Task 1: Fab Simulation API

**Files:**
- Create: `src/sim/fab.test.ts`
- Create: `src/sim/fab.ts`

- [x] **Step 1: Write failing tests for station scoring and yield**

Create `src/sim/fab.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyFabEventPenalty,
  calculateWaferYield,
  completeFabWafer,
  createInitialFabChapter,
  generateDieMap,
  getFabGoalProgress,
  scoreCoatStation,
  scoreDopeStation,
  scoreEtchStation,
  scoreExposeStation,
  type FabBalance,
  type FabStationScores
} from './fab';

const balance: FabBalance = {
  tickSeconds: 0.25,
  wafersRequired: 3,
  dieGrid: { columns: 8, rows: 6 },
  chipsPerGoodDie: 1,
  baseWaferQuality: 80,
  stations: {
    coat: { targetCoverage: 0.92, evennessWeight: 0.35 },
    expose: { perfectDistance: 0, maxDistance: 90 },
    etch: { targetSeconds: 3.2, toleranceSeconds: 0.45, maxPenaltySeconds: 2.5 },
    dope: { zonesRequired: 4 }
  },
  nodes: [
    { id: '90nm', label: '90nm', toleranceMultiplier: 1, chipValue: 1 },
    { id: '28nm', label: '28nm', toleranceMultiplier: 0.82, chipValue: 1.4 },
    { id: '7nm', label: '7nm', toleranceMultiplier: 0.62, chipValue: 2.2 }
  ],
  eventPenalties: {
    dustYieldPenalty: 14,
    calibrationScorePenalty: 8
  },
  pacingTargetSeconds: { min: 840, max: 960 },
  eventTriggers: {
    dustAtWaferIndex: 1,
    calibrationAtWaferIndex: 2
  }
};

const strongScores: FabStationScores = {
  coat: 92,
  expose: 90,
  etch: 88,
  dope: 94
};

describe('fab simulation', () => {
  it('starts with the first wafer at coat station', () => {
    const chapter = createInitialFabChapter(balance, 80);

    expect(chapter.stage).toBe('coat');
    expect(chapter.currentWaferIndex).toBe(0);
    expect(chapter.waferQuality).toBe(80);
    expect(chapter.nodeYields).toEqual([]);
  });

  it('scores coat station from coverage and evenness', () => {
    expect(scoreCoatStation({ coverage: 0.92, evenness: 0.95 }, balance)).toBeGreaterThan(90);
    expect(scoreCoatStation({ coverage: 0.45, evenness: 0.5 }, balance)).toBeLessThan(60);
  });

  it('scores expose station from mask distance', () => {
    expect(scoreExposeStation({ distance: 4 }, balance, balance.nodes[0])).toBeGreaterThan(90);
    expect(scoreExposeStation({ distance: 70 }, balance, balance.nodes[2])).toBeLessThan(35);
  });

  it('scores etch station around target dwell time', () => {
    expect(scoreEtchStation({ heldSeconds: 3.2 }, balance)).toBe(100);
    expect(scoreEtchStation({ heldSeconds: 1.1 }, balance)).toBeLessThan(50);
  });

  it('scores dope station from color-zone matches', () => {
    expect(scoreDopeStation({ matches: 4, misses: 0 }, balance)).toBe(100);
    expect(scoreDopeStation({ matches: 1, misses: 2 }, balance)).toBeLessThan(40);
  });

  it('makes smaller nodes harder at the same station scores', () => {
    const easy = calculateWaferYield(80, strongScores, balance, balance.nodes[0]);
    const hard = calculateWaferYield(80, strongScores, balance, balance.nodes[2]);

    expect(easy).toBeGreaterThan(hard);
    expect(hard).toBeGreaterThan(0);
  });

  it('generates deterministic die maps from yield', () => {
    const map = generateDieMap(75, balance, '28nm');

    expect(map).toHaveLength(48);
    expect(map.filter((die) => die.good).length).toBe(36);
    expect(map.some((die) => !die.good)).toBe(true);
  });

  it('applies fab event penalties without dropping below zero', () => {
    const chapter = createInitialFabChapter(balance, 80);

    const penalized = applyFabEventPenalty(chapter, 'dust', balance);

    expect(penalized.eventYieldPenalty).toBe(14);
    expect(penalized.triggeredEvents).toContain('dust');
  });

  it('completes one wafer and adds chips from good dies', () => {
    const chapter = createInitialFabChapter(balance, 80);
    const result = completeFabWafer(chapter, strongScores, balance, balance.nodes[0]);

    expect(result.chapter.currentWaferIndex).toBe(1);
    expect(result.nodeYield.goodDies).toBeGreaterThan(0);
    expect(result.chipsProduced).toBe(result.nodeYield.goodDies);
  });

  it('reports goal complete after three wafers', () => {
    let chapter = createInitialFabChapter(balance, 80);
    for (const node of balance.nodes) {
      chapter = completeFabWafer(chapter, strongScores, balance, node).chapter;
    }

    expect(getFabGoalProgress(chapter, balance).complete).toBe(true);
    expect(chapter.stage).toBe('complete');
  });
});
```

- [x] **Step 2: Run tests and confirm RED**

Run:

```bash
corepack pnpm exec vitest run src/sim/fab.test.ts
```

Expected: fail because `src/sim/fab.ts` does not exist.

- [x] **Step 3: Implement pure fab simulation**

Create `src/sim/fab.ts` with the public API used by the tests:

```ts
export type FabStage = 'coat' | 'expose' | 'etch' | 'dope' | 'review' | 'complete';
export type FabNodeId = '90nm' | '28nm' | '7nm';
export type FabEventPenaltyType = 'dust' | 'calibration';

export interface FabNodeBalance {
  id: FabNodeId;
  label: string;
  toleranceMultiplier: number;
  chipValue: number;
}

export interface FabBalance {
  tickSeconds: number;
  wafersRequired: number;
  dieGrid: { columns: number; rows: number };
  chipsPerGoodDie: number;
  baseWaferQuality: number;
  stations: {
    coat: { targetCoverage: number; evennessWeight: number };
    expose: { perfectDistance: number; maxDistance: number };
    etch: { targetSeconds: number; toleranceSeconds: number; maxPenaltySeconds: number };
    dope: { zonesRequired: number };
  };
  nodes: FabNodeBalance[];
  eventPenalties: {
    dustYieldPenalty: number;
    calibrationScorePenalty: number;
  };
  pacingTargetSeconds: { min: number; max: number };
  eventTriggers?: {
    dustAtWaferIndex: number;
    calibrationAtWaferIndex: number;
  };
}

export interface FabStationScores {
  coat: number;
  expose: number;
  etch: number;
  dope: number;
}

export interface FabDie {
  id: string;
  x: number;
  y: number;
  good: boolean;
}

export interface FabNodeYield {
  node: FabNodeId;
  yieldPercent: number;
  goodDies: number;
  defectiveDies: number;
}

export interface FabChapterState {
  stage: FabStage;
  currentWaferIndex: number;
  waferQuality: number;
  stationScores: FabStationScores;
  nodeYields: FabNodeYield[];
  chipsProduced: number;
  elapsedSeconds: number;
  eventYieldPenalty: number;
  scorePenalty: number;
  triggeredEvents: string[];
  firstFacts: string[];
}

export function createInitialFabChapter(balance: FabBalance, waferQuality: number): FabChapterState {
  return {
    stage: 'coat',
    currentWaferIndex: 0,
    waferQuality: waferQuality > 0 ? waferQuality : balance.baseWaferQuality,
    stationScores: { coat: 0, expose: 0, etch: 0, dope: 0 },
    nodeYields: [],
    chipsProduced: 0,
    elapsedSeconds: 0,
    eventYieldPenalty: 0,
    scorePenalty: 0,
    triggeredEvents: [],
    firstFacts: []
  };
}

export function scoreCoatStation(input: { coverage: number; evenness: number }, balance: FabBalance): number {
  const coverageScore = 100 - Math.abs(input.coverage - balance.stations.coat.targetCoverage) * 120;
  const evennessScore = clamp(input.evenness * 100, 0, 100);
  return Math.round(clamp(coverageScore * (1 - balance.stations.coat.evennessWeight) + evennessScore * balance.stations.coat.evennessWeight, 0, 100));
}

export function scoreExposeStation(input: { distance: number }, balance: FabBalance, node: FabNodeBalance): number {
  const maxDistance = Math.max(1, balance.stations.expose.maxDistance * node.toleranceMultiplier);
  return Math.round(clamp(100 - (Math.abs(input.distance - balance.stations.expose.perfectDistance) / maxDistance) * 100, 0, 100));
}

export function scoreEtchStation(input: { heldSeconds: number }, balance: FabBalance): number {
  const error = Math.abs(input.heldSeconds - balance.stations.etch.targetSeconds);
  if (error <= balance.stations.etch.toleranceSeconds) {
    return 100;
  }
  return Math.round(clamp(100 - ((error - balance.stations.etch.toleranceSeconds) / balance.stations.etch.maxPenaltySeconds) * 100, 0, 100));
}

export function scoreDopeStation(input: { matches: number; misses: number }, balance: FabBalance): number {
  const matchScore = (input.matches / Math.max(1, balance.stations.dope.zonesRequired)) * 100;
  return Math.round(clamp(matchScore - input.misses * 18, 0, 100));
}

export function calculateWaferYield(
  waferQuality: number,
  scores: FabStationScores,
  balance: FabBalance,
  node: FabNodeBalance,
  extraPenalty = 0
): number {
  const stationAverage = (scores.coat + scores.expose + scores.etch + scores.dope) / 4;
  const nodeDifficultyPenalty = (1 - node.toleranceMultiplier) * 18;
  return Math.round(clamp((waferQuality * 0.42) + (stationAverage * 0.58) - nodeDifficultyPenalty - extraPenalty, 0, 100));
}

export function generateDieMap(yieldPercent: number, balance: FabBalance, node: FabNodeId): FabDie[] {
  const total = balance.dieGrid.columns * balance.dieGrid.rows;
  const goodCount = Math.round(total * clamp(yieldPercent, 0, 100) / 100);
  return Array.from({ length: total }, (_, index) => ({
    id: `${node}-die-${index}`,
    x: index % balance.dieGrid.columns,
    y: Math.floor(index / balance.dieGrid.columns),
    good: index < goodCount
  }));
}

export function applyFabEventPenalty(
  chapter: FabChapterState,
  penaltyType: FabEventPenaltyType,
  balance: FabBalance
): FabChapterState {
  if (chapter.triggeredEvents.includes(penaltyType)) {
    return chapter;
  }

  return penaltyType === 'dust'
    ? {
      ...chapter,
      eventYieldPenalty: clamp(chapter.eventYieldPenalty + balance.eventPenalties.dustYieldPenalty, 0, 100),
      triggeredEvents: [...chapter.triggeredEvents, penaltyType]
    }
    : {
      ...chapter,
      scorePenalty: clamp(chapter.scorePenalty + balance.eventPenalties.calibrationScorePenalty, 0, 100),
      triggeredEvents: [...chapter.triggeredEvents, penaltyType]
    };
}

export function completeFabWafer(
  chapter: FabChapterState,
  stationScores: FabStationScores,
  balance: FabBalance,
  node: FabNodeBalance
): { chapter: FabChapterState; nodeYield: FabNodeYield; chipsProduced: number; dieMap: FabDie[] } {
  const adjustedScores = {
    coat: clamp(stationScores.coat - chapter.scorePenalty, 0, 100),
    expose: clamp(stationScores.expose - chapter.scorePenalty, 0, 100),
    etch: clamp(stationScores.etch - chapter.scorePenalty, 0, 100),
    dope: clamp(stationScores.dope - chapter.scorePenalty, 0, 100)
  };
  const yieldPercent = calculateWaferYield(chapter.waferQuality, adjustedScores, balance, node, chapter.eventYieldPenalty);
  const dieMap = generateDieMap(yieldPercent, balance, node.id);
  const goodDies = dieMap.filter((die) => die.good).length;
  const nodeYield: FabNodeYield = {
    node: node.id,
    yieldPercent,
    goodDies,
    defectiveDies: dieMap.length - goodDies
  };
  const nextIndex = chapter.currentWaferIndex + 1;
  const chipsProduced = goodDies * balance.chipsPerGoodDie;

  return {
    nodeYield,
    chipsProduced,
    dieMap,
    chapter: {
      ...chapter,
      stage: nextIndex >= balance.wafersRequired ? 'complete' : 'coat',
      currentWaferIndex: nextIndex,
      stationScores: { coat: 0, expose: 0, etch: 0, dope: 0 },
      nodeYields: [...chapter.nodeYields, nodeYield],
      chipsProduced: chapter.chipsProduced + chipsProduced,
      eventYieldPenalty: 0,
      scorePenalty: 0
    }
  };
}

export function getFabGoalProgress(chapter: FabChapterState, balance: FabBalance): { complete: boolean; wafersProcessed: number; chipsProduced: number } {
  return {
    complete: chapter.stage === 'complete' && chapter.nodeYields.length >= balance.wafersRequired,
    wafersProcessed: chapter.nodeYields.length,
    chipsProduced: chapter.chipsProduced
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

- [x] **Step 4: Run focused fab tests and fix until GREEN**

Run:

```bash
corepack pnpm exec vitest run src/sim/fab.test.ts
```

Expected: 10/10 tests pass.

## Task 2: Chapter 4 State and Fixtures

**Files:**
- Modify: `src/state/types.ts`
- Modify: `src/state/gameState.ts`
- Modify: `src/state/gameState.test.ts`
- Modify: `src/fixtures/chapterFixtures.ts`

- [x] **Step 1: Add failing state tests**

Add tests to `src/state/gameState.test.ts`:

```ts
it('initializes Chapter 4 progress', () => {
  const state = createInitialGameState();

  expect(state.chapters.ch4).toEqual({
    completed: false,
    completedAtSeconds: null,
    quizCorrect: null,
    wafersProcessed: 0,
    averageYield: 0,
    bestYield: 0,
    chipsProduced: 0,
    nodeYields: [],
    firstFacts: []
  });
});

it('hydrates old saves without Chapter 4 progress', () => {
  const state = hydrateGameState(JSON.stringify({
    version: SAVE_VERSION,
    preferences: { textMode: 'kid', muted: true },
    progress: { currentChapter: 4, unlockedChapters: [1, 2, 3, 4], activeScene: 'Ch4FabScene' },
    resources: {
      minerals: { quartz: 75, copper: 36, lithium: 24, cobalt: 18, rareEarths: 12 },
      wafers: 8,
      chips: 0,
      energy: 100,
      water: 100,
      credits: 700
    },
    chapters: {
      ch1: {
        firstMined: ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'],
        completed: true,
        completedAtSeconds: 660,
        quizCorrect: true
      },
      ch2: {
        completed: true,
        completedAtSeconds: 720,
        quizCorrect: true,
        siliconPurityNines: 9,
        refinedOutputs: { copper: 6, lithium: 4, cobalt: 3 },
        slag: 4,
        storedSlag: 6,
        firstFacts: ['ch2-nine-nines']
      },
      ch3: {
        completed: true,
        completedAtSeconds: 780,
        quizCorrect: true,
        ingotQuality: 80,
        waferQuality: 80,
        wafersProduced: 8,
        retryUsed: false,
        firstFacts: ['ch3-czochralski']
      }
    },
    updatedAt: new Date(0).toISOString()
  }));

  expect(state.chapters.ch4.completed).toBe(false);
  expect(state.chapters.ch4.nodeYields).toEqual([]);
});

it('creates a chapter five fixture with chapter four marked complete', () => {
  const state = createFixtureStateForScene(SceneKey.Ch5Package);

  expect(state.chapters.ch4.completed).toBe(true);
  expect(state.chapters.ch4.chipsProduced).toBeGreaterThan(0);
  expect(state.chapters.ch4.nodeYields).toHaveLength(3);
  expect(state.resources.chips).toBeGreaterThan(0);
});
```

- [x] **Step 2: Run state tests and confirm RED**

Run:

```bash
corepack pnpm exec vitest run src/state/gameState.test.ts
```

Expected: fail because `chapters.ch4` does not exist.

- [x] **Step 3: Extend state types and hydration**

Modify `src/state/types.ts`:

```ts
export type FabNodeId = '90nm' | '28nm' | '7nm';

export interface FabNodeYield {
  node: FabNodeId;
  yieldPercent: number;
  goodDies: number;
  defectiveDies: number;
}

export interface ChapterFourProgress {
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
  wafersProcessed: number;
  averageYield: number;
  bestYield: number;
  chipsProduced: number;
  nodeYields: FabNodeYield[];
  firstFacts: string[];
}

export interface ChapterProgressState {
  ch1: ChapterOneProgress;
  ch2: ChapterTwoProgress;
  ch3: ChapterThreeProgress;
  ch4: ChapterFourProgress;
}
```

Modify `src/state/gameState.ts`:

- Add the `ch4` default in `createInitialGameState()`.
- In `chaptersOr`, read `const ch4 = isRecord(value.ch4) ? value.ch4 : {};`.
- Return a hydrated `ch4` object.
- Add a helper:

```ts
function nodeYieldsOr(value: unknown, fallback: GameState['chapters']['ch4']['nodeYields']): GameState['chapters']['ch4']['nodeYields'] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      node: isFabNodeId(item.node) ? item.node : '90nm',
      yieldPercent: numberOr(item.yieldPercent, 0),
      goodDies: numberOr(item.goodDies, 0),
      defectiveDies: numberOr(item.defectiveDies, 0)
    }));
}

function isFabNodeId(value: unknown): value is '90nm' | '28nm' | '7nm' {
  return value === '90nm' || value === '28nm' || value === '7nm';
}
```

- [x] **Step 4: Extend fixtures**

Modify `src/fixtures/chapterFixtures.ts`:

- For `chapter >= 5`, set `ch4.completed = true`.
- Set `ch4.nodeYields` to three nodes.
- Set `ch4.chipsProduced` and `resources.chips` to a positive count.

Use this fixture payload:

```ts
ch4: {
  ...state.chapters.ch4,
  completed: chapter >= 5,
  completedAtSeconds: chapter >= 5 ? 900 : null,
  quizCorrect: chapter >= 5 ? true : null,
  wafersProcessed: chapter >= 5 ? 3 : state.chapters.ch4.wafersProcessed,
  averageYield: chapter >= 5 ? 76 : state.chapters.ch4.averageYield,
  bestYield: chapter >= 5 ? 84 : state.chapters.ch4.bestYield,
  chipsProduced: chapter >= 5 ? 109 : state.chapters.ch4.chipsProduced,
  nodeYields: chapter >= 5
    ? [
      { node: '90nm', yieldPercent: 84, goodDies: 40, defectiveDies: 8 },
      { node: '28nm', yieldPercent: 77, goodDies: 37, defectiveDies: 11 },
      { node: '7nm', yieldPercent: 66, goodDies: 32, defectiveDies: 16 }
    ]
    : state.chapters.ch4.nodeYields,
  firstFacts: chapter >= 5 ? ['ch4-bunny-suits', 'ch4-dust-speck', 'ch4-euv-asml'] : state.chapters.ch4.firstFacts
}
```

- [x] **Step 5: Run state and full tests**

Run:

```bash
corepack pnpm exec vitest run src/state/gameState.test.ts
corepack pnpm test
```

Expected: all tests pass.

## Task 3: Content and Balance

**Files:**
- Modify: `src/content/balance.json`
- Modify: `src/content/events.json`
- Modify: `src/content/quiz.json`
- Modify: `src/content/strings.json`
- Modify: `src/content/SOURCES.md`

- [x] **Step 1: Add `ch4` balance**

Add to `src/content/balance.json`:

```json
"ch4": {
  "tickSeconds": 0.25,
  "wafersRequired": 3,
  "dieGrid": {
    "columns": 8,
    "rows": 6
  },
  "chipsPerGoodDie": 1,
  "baseWaferQuality": 75,
  "stations": {
    "coat": {
      "targetCoverage": 0.92,
      "evennessWeight": 0.35
    },
    "expose": {
      "perfectDistance": 0,
      "maxDistance": 90
    },
    "etch": {
      "targetSeconds": 3.2,
      "toleranceSeconds": 0.45,
      "maxPenaltySeconds": 2.5
    },
    "dope": {
      "zonesRequired": 4
    }
  },
  "nodes": [
    {
      "id": "90nm",
      "label": "90nm",
      "toleranceMultiplier": 1,
      "chipValue": 1
    },
    {
      "id": "28nm",
      "label": "28nm",
      "toleranceMultiplier": 0.82,
      "chipValue": 1.4
    },
    {
      "id": "7nm",
      "label": "7nm",
      "toleranceMultiplier": 0.62,
      "chipValue": 2.2
    }
  ],
  "eventPenalties": {
    "dustYieldPenalty": 14,
    "calibrationScorePenalty": 8
  },
  "pacingTargetSeconds": {
    "min": 840,
    "max": 960
  },
  "eventTriggers": {
    "dustAtWaferIndex": 1,
    "calibrationAtWaferIndex": 2
  }
}
```

- [x] **Step 2: Add event and quiz content**

Add to `src/content/events.json`:

```json
"ch4DustContamination": {
  "id": "ch4-dust-contamination",
  "title": {
    "kid": "Dust Speck!",
    "nerd": "Cleanroom Particle Excursion"
  },
  "scenario": {
    "kid": "A tiny dust speck lands near the wafer. Rework the wafer, or keep going and risk bad dies.",
    "nerd": "Particles can ruin microscopic circuit patterns. Rework protects yield at schedule and resource cost."
  },
  "choices": [
    {
      "id": "rework-wafer",
      "label": {
        "kid": "Rework it",
        "nerd": "Run particle rework"
      },
      "timePenaltySeconds": 35,
      "effects": {
        "energy": -4,
        "water": -3,
        "credits": -35
      }
    },
    {
      "id": "risk-the-run",
      "label": {
        "kid": "Risk it",
        "nerd": "Continue with yield risk"
      },
      "effects": {
        "credits": 15
      }
    }
  ]
},
"ch4ToolCalibration": {
  "id": "ch4-tool-calibration",
  "title": {
    "kid": "Tool Drift",
    "nerd": "Lithography Calibration Drift"
  },
  "scenario": {
    "kid": "The pattern tool drifts a little. Stop to calibrate, or accept harder station scoring.",
    "nerd": "Mask alignment and process control drift can reduce yield, especially at smaller nodes."
  },
  "choices": [
    {
      "id": "calibrate-now",
      "label": {
        "kid": "Calibrate",
        "nerd": "Calibrate tool"
      },
      "timePenaltySeconds": 30,
      "effects": {
        "credits": -45,
        "energy": -2
      }
    },
    {
      "id": "push-through",
      "label": {
        "kid": "Push through",
        "nerd": "Accept score penalty"
      },
      "effects": {
        "credits": 20
      }
    }
  ]
}
```

Add to `src/content/quiz.json`:

```json
"ch4FieldCheck": {
  "id": "ch4-field-check",
  "question": {
    "kid": "Why do chipmakers throw away some chips from every wafer?",
    "nerd": "Why are some dies discarded from every fabricated wafer?"
  },
  "answers": [
    {
      "id": "some-dies-defective",
      "label": {
        "kid": "Some tiny circuits come out broken",
        "nerd": "Some dies fail electrical or pattern tests"
      },
      "correct": true,
      "explanation": {
        "kid": "Yes. The patterns are so tiny that a few chips on a wafer can have defects.",
        "nerd": "Correct. Yield is the share of dies that meet spec after process variation, particles, and patterning errors."
      }
    },
    {
      "id": "too-round",
      "label": {
        "kid": "The wafer is too round",
        "nerd": "Circular wafers cannot make rectangular chips"
      },
      "correct": false,
      "explanation": {
        "kid": "No. Round wafers still hold many rectangular chip patterns.",
        "nerd": "The round edge reduces usable area, but most discarded dies fail because of defects or process variation."
      }
    },
    {
      "id": "chips-expire",
      "label": {
        "kid": "Chips expire right away",
        "nerd": "Freshly etched dies expire immediately"
      },
      "correct": false,
      "explanation": {
        "kid": "No. Good chips do not expire right away. Bad ones fail tests.",
        "nerd": "Die discard is about yield and test results, not immediate expiration."
      }
    }
  ]
}
```

- [x] **Step 3: Add Ch4 strings**

Add `ch4` to `src/content/strings.json` with:

- Labels: stage, wafer, node, yield, coat, expose, etch, dope, flash, nextStation, nextWafer, quizTitle, stats, nextChapter, menu, toggleMode.
- Stage names for `coat`, `expose`, `etch`, `dope`, `review`, `complete`.
- Messages for station instructions and event outcomes.
- Intro dialogue with Sam and Dr. Vega explaining cleanrooms and wafer yield.
- Fact cards:
  - `bunnySuits`: why cleanroom suits protect wafers.
  - `dustSpeck`: dust speck versus transistor size.
  - `euvAsml`: EUV machines and ASML.
- Completion title/body: `Fab Complete`, `You printed circuits onto wafers and kept the good dies. Next, you will package and test chips.`

Use the existing `ch3` structure as the exact shape reference and keep every displayed string dual-register `{ "kid": "...", "nerd": "..." }`.

- [x] **Step 4: Add source note**

Append to `src/content/SOURCES.md`:

```md
## M5 Chapter 4 Fab

- Cleanroom suits and particle control are represented at a high level to teach that microscopic contamination can affect yield.
- EUV/ASML copy is simplified for gameplay; verify exact public cost/stat wording before using in public educational material.
- Yield is modeled as an instructional score, not a fabrication-process simulator.
```

- [x] **Step 5: Validate JSON**

Run:

```bash
node -e "for (const file of ['src/content/balance.json','src/content/events.json','src/content/quiz.json','src/content/strings.json']) { JSON.parse(require('fs').readFileSync(file, 'utf8')); console.log(file + ' OK'); }"
```

Expected: all files print `OK`.

## Task 4: Chapter 4 DOM Overlay

**Files:**
- Create: `src/ui/chapterFourOverlay.ts`
- Modify: `src/styles.css`

- [x] **Step 1: Create overlay component**

Create `src/ui/chapterFourOverlay.ts` modeled after `chapterThreeOverlay.ts`.

Required exports:

```ts
export interface ChapterFourLabels { /* labels from strings ch4 */ }
export interface ChapterFourOverlayOptions { /* chapter, balance, labels, textMode, message, station controls */ }
export interface MountedChapterFourOverlay {
  update: (options: ChapterFourOverlayOptions) => void;
  cleanup: () => void;
}
export function mountChapterFourOverlay(root: HTMLElement, options: ChapterFourOverlayOptions): MountedChapterFourOverlay;
export function mountChapterFourQuiz(...): MountedModal;
export function mountChapterFourComplete(...): MountedModal;
```

Overlay layout:

- Top/upper status strip with wafer count, node, stage, current yield estimate.
- Compact station panel on the right for current instruction and primary action.
- Bottom action tray with `Flash UV`, `Next station`, `Next wafer`, `Nerd Mode`, `Menu`.
- Reuse `mountQuizOverlay` from `chapterOneOverlay.ts`.
- Completion stats should show elapsed seconds, chips produced, average yield, and best yield.

- [x] **Step 2: Add CSS**

Add styles to `src/styles.css`:

- `.ch4-overlay`
- `.ch4-status-panel`
- `.ch4-station-panel`
- `.ch4-action-panel`
- `.ch4-score-bar`
- `.ch4-die-map-key`

Constraints:

- Do not cover the center wafer/die-map playfield.
- Desktop persistent UI should stay on edges.
- Mobile should stack HUD, compact status, canvas, station panel, action tray without overflow.
- Keep cards at existing radius scale; do not introduce a dashboard look.

- [x] **Step 3: Typecheck**

Run:

```bash
corepack pnpm exec tsc --noEmit
```

Expected: TypeScript passes after imports are wired.

## Task 5: Replace `Ch4FabScene`

**Files:**
- Modify: `src/scenes/Ch4FabScene.ts`

- [x] **Step 1: Replace stub scene**

Replace `ChapterStubScene` inheritance with a real `Phaser.Scene`.

Scene responsibilities:

- `gameStore.enterScene(SceneKey.Ch4Fab, 4)`.
- Mount pipeline HUD and `mountChapterFourOverlay`.
- Draw a cleanroom cross-section: wafer stage, coat arm, mask aligner, etch bath, implant rings, and die-map review.
- Use pointer drag for coat coverage and expose alignment.
- Use arrow keys plus pointer drag for expose alignment.
- Use pointerdown/up timing for etch dwell.
- Use click/tap zones for dope color matching.
- Queue and show fact cards.
- Trigger dust and calibration event cards once each.
- Show quiz and completion after three wafers.
- Persist `resources.chips` and `chapters.ch4`.

- [x] **Step 2: Add scene helper methods**

Implement these private methods:

```ts
private mountDom(): void;
private drawBackdrop(): void;
private redrawFab(): void;
private drawCoatStage(graphics: Phaser.GameObjects.Graphics): void;
private drawExposeStage(graphics: Phaser.GameObjects.Graphics): void;
private drawEtchStage(graphics: Phaser.GameObjects.Graphics): void;
private drawDopeStage(graphics: Phaser.GameObjects.Graphics): void;
private drawReviewStage(graphics: Phaser.GameObjects.Graphics): void;
private handlePointerDown(pointer: Phaser.Input.Pointer): void;
private handlePointerMove(pointer: Phaser.Input.Pointer): void;
private handlePointerUp(pointer: Phaser.Input.Pointer): void;
private advanceStation(): void;
private completeCurrentWafer(): void;
private persistChapterProgress(completed: boolean, quizCorrect?: boolean | null): void;
private showQuiz(): void;
private showCompletion(): void;
private cleanup(): void;
```

Use the same stale modal cleanup pattern as Chapter 3 if wrong-answer retry can overlap with completion.

- [x] **Step 3: Typecheck**

Run:

```bash
corepack pnpm exec tsc --noEmit
```

Expected: TypeScript passes.

## Task 6: Verification and Playtest

**Files:**
- Modify: `docs/agent-context.md`
- Modify: `docs/superpowers/plans/2026-07-07-m5-chapter-four-fab.md`

- [x] **Step 1: Run full local verification**

Run:

```bash
corepack pnpm test
corepack pnpm build
node -e "for (const file of ['src/content/balance.json','src/content/events.json','src/content/quiz.json','src/content/strings.json']) { JSON.parse(require('fs').readFileSync(file, 'utf8')); console.log(file + ' OK'); }"
```

Expected:

- Vitest passes.
- TypeScript passes through build.
- Vite production build passes.
- Existing Phaser chunk-size warning may remain.
- JSON parse passes.

- [x] **Step 2: Run browser smoke**

Use Playwright or an equivalent browser script:

- Open `http://127.0.0.1:5174/?reset#ch4`.
- Dismiss intro.
- Exercise coat drag.
- Exercise expose drag and arrow-key alignment.
- Exercise etch hold/release.
- Exercise dope color clicks.
- Confirm review die map appears.
- Complete three wafers; state-resume acceleration is acceptable after each station surface has been exercised.
- Answer Field Check correctly.
- Click `Next: Package Chips`.
- Verify URL is `#ch5`.
- Verify local storage:
  - `progress.currentChapter = 5`
  - `progress.activeScene = Ch5PackageScene`
  - `unlockedChapters` includes `5`
  - `resources.chips > 0`
  - `chapters.ch4.completed = true`
  - `chapters.ch4.quizCorrect = true`
  - `chapters.ch4.nodeYields.length = 3`

- [x] **Step 3: Capture screenshots**

Capture:

- `/tmp/rock-to-rack-m5-ch4-coat.png`
- `/tmp/rock-to-rack-m5-ch4-expose.png`
- `/tmp/rock-to-rack-m5-ch4-die-map.png`
- `/tmp/rock-to-rack-m5-ch4-mobile.png`

Inspect screenshots with `view_image`. Fix overlap, unclear die maps, or over-heavy HUD before completion.

- [x] **Step 4: Update handoff docs**

Update `docs/agent-context.md`:

- Add M5 implementation summary.
- Add key files.
- Add verification commands/results.
- Add screenshot paths.
- Change likely next step to M6: Chapter 5, Package, Bin & Meet the Chips.

- [x] **Step 5: Moderator review**

Use:

```text
╔══════════════════════════════════════╗
║         MODERATOR REVIEW             ║
╠══════════════════════════════════════╣
║ Scope: M5 Ch4 sim, scene, UI, state, content, docs, smoke evidence ║
╠══════════════════════════════════════╣
║ [BLOCK] <critical issue or None>      ║
║ [WARN]  <important issue or None>     ║
║ [NIT]   <minor issue or None>         ║
║ [IDEA]  <optional enhancement or None>║
╠══════════════════════════════════════╣
║ Verdict: PASS | NEEDS_FIXES | REDESIGN║
╚══════════════════════════════════════╝
```

Fix any `[BLOCK]` items and re-run verification before final response.

- [x] **Step 6: Retrospective and session log**

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

Append to `/Users/omar/.codex/session-log.md` because M5 is COMPLEX.

## Self-Review

- Spec coverage: the plan covers all M5 requirements: four stations, three-node difficulty ramp, pure yield math, die-map visual, facts, two events, Field Check, persistence, browser smoke, screenshots.
- Placeholder scan: no banned placeholder phrases remain in task steps. The overlay label interface references label keys listed in Task 3.
- Type consistency: `FabNodeId`, `FabNodeYield`, `FabStationScores`, `FabBalance`, and `ChapterFourProgress` names match across sim, state, fixtures, and scene tasks.
- Boundary check: the plan does not implement Chapter 5 gameplay; it only persists enough chip output for `#ch5` fixtures.
- Git check: this workspace is not a git repo, so commit steps are intentionally omitted.
