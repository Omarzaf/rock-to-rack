# Chapter 5 Package and Bin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Chapter 5 stub with a playable packaging, binning, and chip-roster chapter at `#ch5`, then persist the chosen chip lineup into Chapter 6.

**Architecture:** Keep the existing chapter pattern: pure package/binning mechanics in `src/sim/package.ts`, Phaser drawing and input in `src/scenes/Ch5PackageScene.ts`, DOM controls in `src/ui/chapterFiveOverlay.ts`, and all balance/text/quiz/roster content in JSON. Chapter 5 consumes `chapters.ch4.nodeYields` plus `resources.chips`, produces binned die counts, reveals chip roster cards from `chips.json`, and persists `chapters.ch5` for `#ch6`.

**Tech Stack:** Phaser 3.90, TypeScript strict, Vite 6, Vitest, DOM overlays, existing `gameStore`, `pipelineHud`, `dialogueOverlay`, `factCard`, `eventCard`, and Chapter 1 quiz modal helpers.

---

## Classification

TYPE: `NEW_FEATURE`
COMPLEXITY: `COMPLEX`
SCOPE: `src/sim/package.ts`, `src/scenes/Ch5PackageScene.ts`, `src/ui/chapterFiveOverlay.ts`, `src/state/types.ts`, `src/state/gameState.ts`, `src/fixtures/chapterFixtures.ts`, `src/content/balance.json`, `src/content/chips.json`, `src/content/quiz.json`, `src/content/events.json`, `src/content/strings.json`, `src/content/SOURCES.md`, `src/styles.css`
RISK: `MEDIUM` because this extends save state and creates the Chapter 6 chip-lineup contract.

Subagents for execution:
- `@data`: pure sim and state hydration tests.
- `@frontend`: Phaser scene, DOM overlay, and responsive visual QA.

Human checkpoint before step: implementation starts only after this plan is approved.

Estimated token cost to implement: 45k-70k.

## Current Contract

- `#ch5` currently loads `src/scenes/Ch5PackageScene.ts`, which extends `ChapterStubScene`.
- `src/content/chips.json` is currently `{}`.
- `GameState.chapters` currently stops at `ch4`; Chapter 5 must add `ch5` without breaking old saves.
- `createFixtureStateForScene(SceneKey.Ch5Package)` already marks Chapter 4 complete and provides `resources.chips = 109`.
- `createFixtureStateForScene(SceneKey.Ch6Datacenter)` currently reaches the Chapter 6 stub but has no Chapter 5 progress to carry forward.
- This directory is not a git repo, so commit steps from the generic workflow cannot be satisfied unless the project is moved into or initialized as a repo.

## File Structure

- Create: `src/sim/package.ts`
  - Pure types and functions for deterministic test dies, sorting, bin totals, chip build costs, lineup selection, Nova lock state, and chapter goal progress.
- Create: `src/sim/package.test.ts`
  - Vitest coverage for initial state, bin mapping, correct/incorrect sorting, chip affordability, selection limits, Nova lock, and completion.
- Create: `src/ui/chapterFiveOverlay.ts`
  - DOM status/action/roster overlay plus quiz and completion wrappers.
- Modify: `src/scenes/Ch5PackageScene.ts`
  - Replace stub with a playable Phaser scene.
- Modify: `src/state/types.ts`
  - Add chip/bin types and `ChapterFiveProgress`.
- Modify: `src/state/gameState.ts`
  - Initialize and hydrate `chapters.ch5`.
- Modify: `src/state/gameState.test.ts`
  - Lock default and old-save hydration behavior.
- Modify: `src/fixtures/chapterFixtures.ts`
  - Make `#ch5` start from completed Ch4; make `#ch6` start from completed Ch5 with a default lineup.
- Modify: `src/content/balance.json`
  - Add `ch5` balance values.
- Modify: `src/content/chips.json`
  - Add CPU, GPU, DRAM, NAND, NIC, PMIC, and locked Nova definitions.
- Modify: `src/content/strings.json`
  - Add Chapter 5 labels, messages, intro, facts, and completion copy.
- Modify: `src/content/quiz.json`
  - Add `ch5FieldCheck`.
- Modify: `src/content/events.json`
  - Add two testing/packaging event cards.
- Modify: `src/content/SOURCES.md`
  - Add packaging/binning source notes.
- Modify: `src/styles.css`
  - Add `.ch5-*` responsive overlay/card styles.

## Chapter Design

Stage A, Dicing:
- Show a wafer/die grid from Chapter 4 outputs.
- Animate cut lines, then release test dies into the sorting chute.
- First fact card: packaging protects the tiny die and connects it to the outside world.

Stage A, Binning:
- Test dies fall one at a time.
- Each die has a visible meter and a node badge.
- Player sorts into `Perfect`, `Good`, or `Salvage`.
- Correct sort adds full die credit to that bin.
- Wrong sort downgrades one level: `Perfect -> Good`, `Good -> Salvage`, `Salvage -> Salvage`.
- This teaches that slower chips can still be sold instead of discarded.

Stage B, Chip Roster:
- Player spends binned dies to build chip cards from `chips.json`.
- Buildable roster: CPU, GPU, DRAM, NAND, NIC, PMIC.
- Player can build up to four chip types.
- Surface hints show likely Chapter 6 consequences.
- Nova is shown locked and requires one `7nm` perfect die plus Chapter 6 finale unlock.
- Card reveal animation uses code-drawn rounded-square chip faces, not image assets.

Completion:
- Field Check asks: "Which chip would a video game need most?"
- Correct answer: GPU / The Swarm.
- Completion persists `selectedChipIds`, `builtChips`, `bins`, `perfect7nmDies`, and `firstFacts`, then transitions to `#ch6`.

## Task 1: Pure Package Simulation

**Files:**
- Create: `src/sim/package.ts`
- Create: `src/sim/package.test.ts`

- [ ] **Step 1: Write failing package simulation tests**

Create `src/sim/package.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildChip,
  createInitialPackageChapter,
  getPackageGoalProgress,
  sortTestDie,
  type ChipDefinition,
  type PackageBalance
} from './package';
import type { FabNodeYield } from '../state/types';

const balance: PackageBalance = {
  tickSeconds: 0.25,
  sortSampleSize: 18,
  maxBuildChoices: 4,
  binThresholds: {
    perfect: 88,
    good: 58
  },
  testScoreByNode: {
    '90nm': { base: 72, step: 7 },
    '28nm': { base: 78, step: 6 },
    '7nm': { base: 84, step: 5 }
  },
  wrongSortDowngrade: true,
  pacingTargetSeconds: { min: 720, max: 840 },
  eventTriggers: {
    probeDriftAtSortedCount: 6,
    substrateShortageAtBuiltCount: 2
  }
};

const yields: FabNodeYield[] = [
  { node: '90nm', yieldPercent: 84, goodDies: 40, defectiveDies: 8 },
  { node: '28nm', yieldPercent: 77, goodDies: 37, defectiveDies: 11 },
  { node: '7nm', yieldPercent: 66, goodDies: 32, defectiveDies: 16 }
];

const chips: ChipDefinition[] = [
  {
    id: 'cpu',
    name: { kid: 'CPU', nerd: 'CPU' },
    nickname: { kid: 'The Captain', nerd: 'The Captain' },
    persona: { kid: 'Calm all-rounder', nerd: 'General-purpose control processor' },
    cost: { perfect: 1, good: 4, salvage: 0 },
    requiresPerfect7nm: false,
    locked: false,
    effectKey: 'generalBoost',
    cardColor: '#38bdf8',
    superpower: { kid: 'Helps every building work better.', nerd: 'Improves general-purpose coordination across systems.' },
    lesson: { kid: 'A CPU is the computer captain.', nerd: 'CPUs handle flexible control flow and general-purpose tasks.' },
    ch6Hint: { kid: 'Good for almost any rack.', nerd: 'Broadly useful for baseline data-center services.' }
  },
  {
    id: 'gpu',
    name: { kid: 'GPU', nerd: 'GPU' },
    nickname: { kid: 'The Swarm', nerd: 'The Swarm' },
    persona: { kid: 'Thousands of tiny workers', nerd: 'Massively parallel processor' },
    cost: { perfect: 3, good: 5, salvage: 0 },
    requiresPerfect7nm: false,
    locked: false,
    effectKey: 'aiContracts',
    cardColor: '#a78bfa',
    superpower: { kid: 'Unlocks big AI jobs.', nerd: 'Accelerates parallel math workloads.' },
    lesson: { kid: 'AI uses lots of workers at once.', nerd: 'GPUs are valuable because many cores run parallel operations efficiently.' },
    ch6Hint: { kid: 'AI contracts need this.', nerd: 'Required for AI-heavy contracts in Chapter 6.' }
  }
];

describe('package simulation', () => {
  it('creates a deterministic test lot from Chapter 4 yields', () => {
    const chapter = createInitialPackageChapter(balance, yields, 109);

    expect(chapter.stage).toBe('dice');
    expect(chapter.testDies).toHaveLength(18);
    expect(chapter.testDies.some((die) => die.node === '7nm')).toBe(true);
    expect(chapter.bins).toEqual({ perfect: 0, good: 0, salvage: 0 });
  });

  it('maps test scores into expected bins', () => {
    const chapter = createInitialPackageChapter(balance, yields, 109);
    const perfectDie = chapter.testDies.find((die) => die.expectedBin === 'perfect');

    expect(perfectDie?.testScore).toBeGreaterThanOrEqual(88);
  });

  it('credits the intended bin when sorted correctly', () => {
    const chapter = createInitialPackageChapter(balance, yields, 109);
    const die = chapter.testDies[0];
    const result = sortTestDie(chapter, die.id, die.expectedBin, balance);

    expect(result.sortedDie?.actualBin).toBe(die.expectedBin);
    expect(result.chapter.sortedCount).toBe(1);
    expect(result.chapter.bins[die.expectedBin]).toBe(1);
  });

  it('downgrades one bin on an incorrect sort', () => {
    const chapter = createInitialPackageChapter(balance, yields, 109);
    const die = chapter.testDies.find((candidate) => candidate.expectedBin === 'perfect');
    expect(die).toBeDefined();

    const result = sortTestDie(chapter, die!.id, 'salvage', balance);

    expect(result.sortedDie?.actualBin).toBe('good');
    expect(result.chapter.bins.good).toBe(1);
  });

  it('spends bins to build chips and enforces max choices', () => {
    let chapter = createInitialPackageChapter(balance, yields, 109);
    chapter = {
      ...chapter,
      stage: 'roster',
      bins: { perfect: 10, good: 16, salvage: 6 }
    };

    chapter = buildChip(chapter, chips[0]).chapter;
    chapter = buildChip(chapter, chips[1]).chapter;

    expect(chapter.selectedChipIds).toEqual(['cpu', 'gpu']);
    expect(chapter.builtChips).toHaveLength(2);
    expect(chapter.bins.perfect).toBe(6);
  });

  it('reports complete after the roster stage has at least one chip', () => {
    let chapter = createInitialPackageChapter(balance, yields, 109);
    chapter = {
      ...chapter,
      stage: 'complete',
      selectedChipIds: ['cpu'],
      builtChips: [{ chipId: 'cpu', builtAtSeconds: 100 }]
    };

    expect(getPackageGoalProgress(chapter, balance).complete).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
corepack pnpm vitest run src/sim/package.test.ts
```

Expected: FAIL because `src/sim/package.ts` does not exist.

- [ ] **Step 3: Implement the pure sim**

Create `src/sim/package.ts` with these exported contracts:

```ts
import type { ChipTypeId, DieBinId, FabNodeId, FabNodeYield } from '../state/types';

export type PackageStage = 'dice' | 'sort' | 'roster' | 'complete';

export interface PackageText {
  kid: string;
  nerd: string;
}

export interface PackageBalance {
  tickSeconds: number;
  sortSampleSize: number;
  maxBuildChoices: number;
  binThresholds: {
    perfect: number;
    good: number;
  };
  testScoreByNode: Record<FabNodeId, { base: number; step: number }>;
  wrongSortDowngrade: boolean;
  pacingTargetSeconds: {
    min: number;
    max: number;
  };
  eventTriggers?: {
    probeDriftAtSortedCount: number;
    substrateShortageAtBuiltCount: number;
  };
}

export interface ChipDefinition {
  id: ChipTypeId;
  name: PackageText;
  nickname: PackageText;
  persona: PackageText;
  cost: Record<DieBinId, number>;
  requiresPerfect7nm: boolean;
  locked: boolean;
  effectKey: string;
  cardColor: string;
  superpower: PackageText;
  lesson: PackageText;
  ch6Hint: PackageText;
}

export interface TestDie {
  id: string;
  node: FabNodeId;
  sourceYieldPercent: number;
  testScore: number;
  expectedBin: DieBinId;
  actualBin: DieBinId | null;
  sorted: boolean;
}

export interface BuiltChip {
  chipId: ChipTypeId;
  builtAtSeconds: number;
}

export interface PackageChapterState {
  stage: PackageStage;
  elapsedSeconds: number;
  inputChips: number;
  testDies: TestDie[];
  activeDieIndex: number;
  sortedCount: number;
  bins: Record<DieBinId, number>;
  selectedChipIds: ChipTypeId[];
  builtChips: BuiltChip[];
  revealedChipIds: ChipTypeId[];
  perfect7nmDies: number;
  triggeredEvents: string[];
  firstFacts: string[];
}
```

Implement:
- `createInitialPackageChapter(balance, nodeYields, inputChips): PackageChapterState`
- `expectedBinForScore(score, balance): DieBinId`
- `sortTestDie(chapter, dieId, targetBin, balance): { chapter; sortedDie }`
- `canBuildChip(chapter, chip): boolean`
- `buildChip(chapter, chip): { ok; chapter; reason? }`
- `applyPackageEvent(chapter, 'probeDrift' | 'substrateShortage'): PackageChapterState`
- `getPackageGoalProgress(chapter, balance): { complete; sortedCount; builtCount }`

Rules:
- Generate exactly `balance.sortSampleSize` test dies.
- Distribute dies across `nodeYields` in proportion to `goodDies`, with at least one die from every node that has `goodDies > 0`.
- Use deterministic scores: `score = clamp(nodeScore.base + ((index % 5) - 1) * nodeScore.step + Math.round(sourceYieldPercent * 0.1), 30, 100)`.
- `expectedBinForScore`: `>= perfect` is `perfect`, `>= good` is `good`, otherwise `salvage`.
- Wrong sorting downgrades one level from the die's expected bin.
- `perfect7nmDies` is the count of sorted dies where `node === '7nm'` and `actualBin === 'perfect'`.
- Nova remains unbuildable when `chip.locked === true`; its lock reason should be visible in the overlay.

- [ ] **Step 4: Run sim tests**

Run:

```bash
corepack pnpm vitest run src/sim/package.test.ts
```

Expected: PASS.

## Task 2: Save State and Fixtures

**Files:**
- Modify: `src/state/types.ts`
- Modify: `src/state/gameState.ts`
- Modify: `src/state/gameState.test.ts`
- Modify: `src/fixtures/chapterFixtures.ts`

- [ ] **Step 1: Extend state types**

In `src/state/types.ts`, export:

```ts
export type DieBinId = 'perfect' | 'good' | 'salvage';
export type ChipTypeId = 'cpu' | 'gpu' | 'dram' | 'nand' | 'nic' | 'pmic' | 'nova';

export interface ChapterFiveProgress {
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
  sortedDies: number;
  bins: Record<DieBinId, number>;
  selectedChipIds: ChipTypeId[];
  builtChips: Array<{
    chipId: ChipTypeId;
    builtAtSeconds: number;
  }>;
  perfect7nmDies: number;
  firstFacts: string[];
}
```

Add `ch5: ChapterFiveProgress` to `ChapterProgressState`.

- [ ] **Step 2: Write failing state tests**

Append tests to `src/state/gameState.test.ts`:

```ts
it('initializes Chapter 5 progress', () => {
  const state = createInitialGameState();

  expect(state.chapters.ch5).toEqual({
    completed: false,
    completedAtSeconds: null,
    quizCorrect: null,
    sortedDies: 0,
    bins: { perfect: 0, good: 0, salvage: 0 },
    selectedChipIds: [],
    builtChips: [],
    perfect7nmDies: 0,
    firstFacts: []
  });
});

it('hydrates old saves without Chapter 5 progress', () => {
  const state = hydrateGameState(JSON.stringify({
    version: SAVE_VERSION,
    preferences: { textMode: 'kid', muted: true },
    progress: { currentChapter: 5, unlockedChapters: [1, 2, 3, 4, 5], activeScene: 'Ch5PackageScene' },
    resources: {
      minerals: { quartz: 100, copper: 60, lithium: 40, cobalt: 30, rareEarths: 20 },
      wafers: 8,
      chips: 109,
      energy: 100,
      water: 100,
      credits: 1000
    },
    chapters: {
      ch4: {
        completed: true,
        completedAtSeconds: 900,
        quizCorrect: true,
        wafersProcessed: 3,
        averageYield: 76,
        bestYield: 84,
        chipsProduced: 109,
        nodeYields: [{ node: '7nm', yieldPercent: 66, goodDies: 32, defectiveDies: 16 }],
        firstFacts: []
      }
    },
    updatedAt: new Date(0).toISOString()
  }));

  expect(state.chapters.ch5.completed).toBe(false);
  expect(state.chapters.ch5.bins).toEqual({ perfect: 0, good: 0, salvage: 0 });
});

it('creates a chapter six fixture with chapter five marked complete', () => {
  const state = createFixtureStateForScene(SceneKey.Ch6Datacenter);

  expect(state.chapters.ch5.completed).toBe(true);
  expect(state.chapters.ch5.selectedChipIds.length).toBeGreaterThan(0);
  expect(state.chapters.ch5.builtChips.length).toBe(state.chapters.ch5.selectedChipIds.length);
});
```

- [ ] **Step 3: Run state tests to verify failure**

Run:

```bash
corepack pnpm vitest run src/state/gameState.test.ts
```

Expected: FAIL because `ch5` does not exist.

- [ ] **Step 4: Implement state initialization and hydration**

In `createInitialGameState()`, add:

```ts
ch5: {
  completed: false,
  completedAtSeconds: null,
  quizCorrect: null,
  sortedDies: 0,
  bins: { perfect: 0, good: 0, salvage: 0 },
  selectedChipIds: [],
  builtChips: [],
  perfect7nmDies: 0,
  firstFacts: []
}
```

In `chaptersOr`, read `const ch5 = isRecord(value.ch5) ? value.ch5 : {};` and hydrate:

```ts
ch5: {
  completed: typeof ch5.completed === 'boolean' ? ch5.completed : fallback.ch5.completed,
  completedAtSeconds: nullableNumberOr(ch5.completedAtSeconds, fallback.ch5.completedAtSeconds),
  quizCorrect: nullableBooleanOr(ch5.quizCorrect, fallback.ch5.quizCorrect),
  sortedDies: numberOr(ch5.sortedDies, fallback.ch5.sortedDies),
  bins: binsOr(ch5.bins, fallback.ch5.bins),
  selectedChipIds: chipTypeListOr(ch5.selectedChipIds, fallback.ch5.selectedChipIds),
  builtChips: builtChipsOr(ch5.builtChips, fallback.ch5.builtChips),
  perfect7nmDies: numberOr(ch5.perfect7nmDies, fallback.ch5.perfect7nmDies),
  firstFacts: stringListOr(ch5.firstFacts, fallback.ch5.firstFacts)
}
```

Add helpers:

```ts
function binsOr(value: unknown, fallback: GameState['chapters']['ch5']['bins']): GameState['chapters']['ch5']['bins'] {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    perfect: numberOr(value.perfect, fallback.perfect),
    good: numberOr(value.good, fallback.good),
    salvage: numberOr(value.salvage, fallback.salvage)
  };
}

function chipTypeListOr(value: unknown, fallback: GameState['chapters']['ch5']['selectedChipIds']): GameState['chapters']['ch5']['selectedChipIds'] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return [...new Set(value.filter((chip): chip is GameState['chapters']['ch5']['selectedChipIds'][number] => isChipTypeId(chip)))];
}

function builtChipsOr(value: unknown, fallback: GameState['chapters']['ch5']['builtChips']): GameState['chapters']['ch5']['builtChips'] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .filter((item) => isChipTypeId(item.chipId))
    .map((item) => ({
      chipId: item.chipId as GameState['chapters']['ch5']['selectedChipIds'][number],
      builtAtSeconds: numberOr(item.builtAtSeconds, 0)
    }));
}

function isChipTypeId(value: unknown): value is GameState['chapters']['ch5']['selectedChipIds'][number] {
  return value === 'cpu' || value === 'gpu' || value === 'dram' || value === 'nand' || value === 'nic' || value === 'pmic' || value === 'nova';
}
```

- [ ] **Step 5: Update fixtures**

In `src/fixtures/chapterFixtures.ts`, add `ch5` fixture progress for `chapter >= 6`:

```ts
ch5: {
  ...state.chapters.ch5,
  completed: chapter >= 6,
  completedAtSeconds: chapter >= 6 ? 780 : null,
  quizCorrect: chapter >= 6 ? true : null,
  sortedDies: chapter >= 6 ? 18 : state.chapters.ch5.sortedDies,
  bins: chapter >= 6 ? { perfect: 2, good: 4, salvage: 2 } : state.chapters.ch5.bins,
  selectedChipIds: chapter >= 6 ? ['cpu', 'gpu', 'dram', 'pmic'] : state.chapters.ch5.selectedChipIds,
  builtChips: chapter >= 6
    ? [
      { chipId: 'cpu', builtAtSeconds: 610 },
      { chipId: 'gpu', builtAtSeconds: 640 },
      { chipId: 'dram', builtAtSeconds: 670 },
      { chipId: 'pmic', builtAtSeconds: 700 }
    ]
    : state.chapters.ch5.builtChips,
  perfect7nmDies: chapter >= 6 ? 1 : state.chapters.ch5.perfect7nmDies,
  firstFacts: chapter >= 6 ? ['ch5-packaging', 'ch5-binning', 'ch5-chip-roster'] : state.chapters.ch5.firstFacts
}
```

- [ ] **Step 6: Run state tests**

Run:

```bash
corepack pnpm vitest run src/state/gameState.test.ts
```

Expected: PASS.

## Task 3: Chapter 5 Content

**Files:**
- Modify: `src/content/balance.json`
- Modify: `src/content/chips.json`
- Modify: `src/content/strings.json`
- Modify: `src/content/quiz.json`
- Modify: `src/content/events.json`
- Modify: `src/content/SOURCES.md`

- [ ] **Step 1: Add balance**

Add this top-level `ch5` object to `src/content/balance.json`:

```json
"ch5": {
  "tickSeconds": 0.25,
  "sortSampleSize": 18,
  "maxBuildChoices": 4,
  "binThresholds": {
    "perfect": 88,
    "good": 58
  },
  "testScoreByNode": {
    "90nm": { "base": 72, "step": 7 },
    "28nm": { "base": 78, "step": 6 },
    "7nm": { "base": 84, "step": 5 }
  },
  "wrongSortDowngrade": true,
  "pacingTargetSeconds": {
    "min": 720,
    "max": 840
  },
  "eventTriggers": {
    "probeDriftAtSortedCount": 6,
    "substrateShortageAtBuiltCount": 2
  }
}
```

- [ ] **Step 2: Replace `chips.json` with roster definitions**

Use IDs exactly: `cpu`, `gpu`, `dram`, `nand`, `nic`, `pmic`, `nova`.

Costs:
- CPU: `{ "perfect": 1, "good": 4, "salvage": 0 }`
- GPU: `{ "perfect": 3, "good": 5, "salvage": 0 }`
- DRAM: `{ "perfect": 1, "good": 3, "salvage": 1 }`
- NAND: `{ "perfect": 0, "good": 4, "salvage": 3 }`
- NIC: `{ "perfect": 2, "good": 3, "salvage": 1 }`
- PMIC: `{ "perfect": 1, "good": 2, "salvage": 3 }`
- Nova: `{ "perfect": 1, "good": 0, "salvage": 0 }`, `locked: true`, `requiresPerfect7nm: true`

Each chip must include: `id`, `name`, `nickname`, `persona`, `cost`, `requiresPerfect7nm`, `locked`, `effectKey`, `cardColor`, `superpower`, `lesson`, `ch6Hint`.

- [ ] **Step 3: Add strings**

Add top-level `ch5` content to `src/content/strings.json`:
- `title`, `subtitle`
- `labels`: `stage`, `sorted`, `activeDie`, `perfect`, `good`, `salvage`, `score`, `node`, `cutWafer`, `startSort`, `sortPerfect`, `sortGood`, `sortSalvage`, `buildChip`, `nextChapter`, `quizTitle`, `stats`, `menu`, `toggleMode`
- `stageNames`: `dice`, `sort`, `roster`, `complete`
- `messages`: `diceHint`, `sortHint`, `correctSort`, `wrongSort`, `rosterHint`, `maxChoices`, `cantAfford`, `novaLocked`, `probePenalty`, `substratePenalty`
- `intro`: three lines with Sam and Dr. Vega
- `facts`: `packaging`, `binning`, `chipRoster`
- `completion`: title/body

Keep all user-facing strings as `{ "kid": "...", "nerd": "..." }`.

- [ ] **Step 4: Add quiz**

Add `ch5FieldCheck` to `src/content/quiz.json`:
- Correct answer ID: `gpu-parallel`
- Kid label: `GPU / The Swarm`
- Nerd label: `GPU, because parallel processors are well suited to graphics and AI math`
- Two incorrect answers: `nand-storage` and `pmic-power`

- [ ] **Step 5: Add event cards**

Add to `src/content/events.json`:
- `ch5ProbeDrift`: testing probe misreads some dies; choices `recalibrate-probe` and `sort-through-noise`.
- `ch5SubstrateShortage`: package substrates run short; choices `buy-substrates` and `use-salvage-package`.

Use existing event-card schema: `id`, `title`, `scenario`, `choices`, `effects`, optional `timePenaltySeconds`.

- [ ] **Step 6: Add sources**

Append concise source notes to `src/content/SOURCES.md` for:
- Semiconductor packaging connects the die to the package and board.
- Testing/binning separates chips by performance and power characteristics.
- GPUs are parallel processors used for graphics and AI workloads.

- [ ] **Step 7: Verify JSON**

Run:

```bash
node -e "for (const file of ['src/content/balance.json','src/content/chips.json','src/content/events.json','src/content/quiz.json','src/content/strings.json']) { JSON.parse(require('fs').readFileSync(file, 'utf8')); console.log(file + ' OK'); }"
```

Expected: all five files print `OK`.

## Task 4: Chapter 5 Overlay

**Files:**
- Create: `src/ui/chapterFiveOverlay.ts`

- [ ] **Step 1: Implement overlay contracts**

Create `src/ui/chapterFiveOverlay.ts` with:

```ts
import type { TextMode } from '../state/types';
import type { ChipDefinition, DieBinId, PackageBalance, PackageChapterState, PackageStage } from '../sim/package';
import {
  mountQuizOverlay,
  type ChapterOneLabels,
  type MountedModal,
  type QuizAnswerDefinition,
  type QuizDefinition
} from './chapterOneOverlay';
import type { TextModeText } from './text';
import { textForMode } from './text';

export interface ChapterFiveLabels {
  stage: TextModeText;
  sorted: TextModeText;
  activeDie: TextModeText;
  perfect: TextModeText;
  good: TextModeText;
  salvage: TextModeText;
  score: TextModeText;
  node: TextModeText;
  cutWafer: TextModeText;
  startSort: TextModeText;
  sortPerfect: TextModeText;
  sortGood: TextModeText;
  sortSalvage: TextModeText;
  buildChip: TextModeText;
  nextChapter: TextModeText;
  quizTitle: TextModeText;
  stats: TextModeText;
  menu: TextModeText;
  toggleMode: TextModeText;
}

export interface ChapterFiveOverlayOptions {
  chapter: PackageChapterState;
  balance: PackageBalance;
  chips: ChipDefinition[];
  labels: ChapterFiveLabels;
  stageNames: Record<PackageStage, TextModeText>;
  textMode: TextMode;
  message: TextModeText | null;
  selectedChipId: string | null;
  canCut: boolean;
  canStartSort: boolean;
  canBuildSelected: boolean;
  onCutWafer: () => void;
  onStartSort: () => void;
  onSort: (bin: DieBinId) => void;
  onSelectChip: (chipId: string) => void;
  onBuildChip: () => void;
  onToggleMode: () => void;
  onMenu: () => void;
}
```

Export:
- `mountChapterFiveOverlay(root, options)`
- `mountChapterFiveQuiz(root, options)`
- `mountChapterFiveComplete(root, options)`

- [ ] **Step 2: Render status, action, and roster panels**

The overlay should render:
- Status panel: stage, sorted count, active die score/node, three bin counts.
- Action panel: cut wafer, start sorting, three bin buttons, build selected chip, mode toggle, menu.
- Roster panel: six buildable cards plus locked Nova.
- Card affordability state: add class `is-affordable`, `is-built`, or `is-locked`.

- [ ] **Step 3: Bridge quiz labels**

Mirror the `chapterOneLabelBridge` pattern from `chapterFourOverlay.ts` so the shared quiz modal works with Chapter 5 labels.

## Task 5: Chapter 5 Scene

**Files:**
- Modify: `src/scenes/Ch5PackageScene.ts`

- [ ] **Step 1: Replace the stub imports and class**

Remove `ChapterStubScene` usage. Import:
- `balance.json`, `chips.json`, `events.json`, `quiz.json`, `strings.json`
- `applyEventChoice`
- package sim functions
- `addResources` if event effects touch resources
- `gameStore`
- `mountChapterFiveOverlay`, `mountChapterFiveQuiz`, `mountChapterFiveComplete`
- shared HUD/dialogue/fact/event overlays
- `SceneKey`

- [ ] **Step 2: Add scene state**

Use fields parallel to `Ch4FabScene`:

```ts
private chapter = createInitialPackageChapterState();
private cleanupCallbacks: Array<() => void> = [];
private hud: MountedPipelineHud | undefined;
private overlay: MountedChapterFiveOverlay | undefined;
private dialogue: MountedDialogue | undefined;
private factCard: MountedFactCard | undefined;
private eventCard: MountedEventCard | undefined;
private quiz: MountedModal | undefined;
private completion: MountedModal | undefined;
private worldGraphics: Phaser.GameObjects.Graphics | undefined;
private pausedForOverlay = false;
private selectedChipId: ChipTypeId | null = null;
private lastMessage: TextModeText | null = STRINGS.ch5.messages.diceHint;
private pendingFactIds: string[] = [];
private fallingDieY = 0;
```

- [ ] **Step 3: Draw the chapter**

Implement `redrawPackage()` with:
- `drawDicingStage(graphics)`: wafer circle, die grid, animated saw/cut lines.
- `drawSortStage(graphics)`: chute, active die meter, three labeled bins.
- `drawRosterStage(graphics)`: large selected chip reveal card plus small chip silhouettes in the background.

Use code-drawn shapes only.

- [ ] **Step 4: Implement stage transitions**

Actions:
- `cutWafer()`: stage `dice -> sort`, queue packaging fact.
- `startSort()`: no-op unless stage is `dice`; sets stage to `sort`.
- `sortActiveDie(bin)`: calls `sortTestDie`; advances `activeDieIndex`; queues binning fact; moves to `roster` when all sample dies are sorted.
- `selectChip(chipId)`: updates `selectedChipId`.
- `buildSelectedChip()`: calls `buildChip`; queues roster fact; when player has at least one chip, allow Field Check. Do not require exactly four chips because a poor sort should not block completion.

- [ ] **Step 5: Trigger events**

Use existing event overlay:
- At sorted count 6, show `ch5ProbeDrift`.
- At built count 2, show `ch5SubstrateShortage`.
- Apply resource effects through `applyEventChoice`.
- If the player chooses the risky option, call `applyPackageEvent(...)` and show the corresponding message.

- [ ] **Step 6: Persist progress**

Implement:

```ts
private persistChapterProgress(completed: boolean, quizCorrect: boolean | null = null): void {
  gameStore.update((state) => ({
    ...state,
    chapters: {
      ...state.chapters,
      ch5: {
        completed: completed || state.chapters.ch5.completed,
        completedAtSeconds: completed ? Math.round(this.chapter.elapsedSeconds) : state.chapters.ch5.completedAtSeconds,
        quizCorrect: completed ? quizCorrect : state.chapters.ch5.quizCorrect,
        sortedDies: this.chapter.sortedCount,
        bins: this.chapter.bins,
        selectedChipIds: this.chapter.selectedChipIds,
        builtChips: this.chapter.builtChips,
        perfect7nmDies: this.chapter.perfect7nmDies,
        firstFacts: this.chapter.firstFacts
      }
    }
  }));
  gameStore.saveNow();
}
```

On completion, transition:

```ts
window.location.hash = 'ch6';
gameStore.enterScene(SceneKey.Ch6Datacenter, 6);
this.scene.start(SceneKey.Ch6Datacenter);
```

- [ ] **Step 7: Hydrate from existing progress**

Create `createInitialPackageChapterState()`:
- Build from `BALANCE.ch5`, `state.chapters.ch4.nodeYields`, and `state.resources.chips`.
- If `state.chapters.ch5.completed`, return stage `complete` with saved bins and built chips.
- If `sortedDies > 0`, restore `bins`, `selectedChipIds`, `builtChips`, `perfect7nmDies`, `firstFacts`, set `stage` to `roster`.
- Otherwise start at `dice`.

- [ ] **Step 8: Quiz and completion**

Use `QUIZ.ch5FieldCheck`.
Emit `quiz_answer` analytics with `scene: SceneKey.Ch5Package`.
Wrong answers show explanation and reopen quiz after a short delay, matching Chapter 4.
Completion modal stats should include elapsed seconds, sorted dies, built chip count, and selected chip IDs.

## Task 6: CSS and Responsive Layout

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add desktop styles**

Add `.ch5-overlay` using the Chapter 4 layout pattern:
- left status panel,
- center/right roster panel,
- bottom/right action panel,
- stable card sizes to avoid layout shifts.

Include:
- `.ch5-status-panel`
- `.ch5-action-panel`
- `.ch5-roster-panel`
- `.ch5-chip-card`
- `.ch5-chip-card.is-built`
- `.ch5-chip-card.is-locked`
- `.ch5-bin-row`
- `.ch5-meter`

- [ ] **Step 2: Add mobile styles**

In the existing mobile media query:
- stack status/action/roster into non-overlapping bands,
- keep all buttons within viewport width,
- shrink chip cards without hiding bin costs,
- keep the Phaser chute/wafer visible behind the DOM overlay.

## Task 7: Verification

**Files:**
- Modify: `docs/agent-context.md` after implementation is verified.

- [ ] **Step 1: Run unit tests**

Run:

```bash
corepack pnpm test
```

Expected: all existing tests plus new package/state tests pass.

- [ ] **Step 2: Run production build**

Run:

```bash
corepack pnpm build
```

Expected: TypeScript and Vite build pass. The known Phaser chunk-size warning may remain.

- [ ] **Step 3: Parse content JSON**

Run:

```bash
node -e "for (const file of ['src/content/balance.json','src/content/chips.json','src/content/events.json','src/content/quiz.json','src/content/strings.json']) { JSON.parse(require('fs').readFileSync(file, 'utf8')); console.log(file + ' OK'); }"
```

Expected: all files print `OK`.

- [ ] **Step 4: Browser smoke**

Start dev server if needed:

```bash
corepack pnpm dev -- --host 127.0.0.1
```

Smoke at:

```text
http://127.0.0.1:5174/?reset#ch5
```

Verify:
- `#ch5` loads from fixture state with Chapter 4 complete.
- Intro can be dismissed.
- Dicing stage appears.
- Sorting three bin buttons accept input.
- Probe event appears around sorted count 6.
- Roster cards appear after the sorting sample is complete.
- At least one chip can be built.
- Nova appears locked with a 7nm perfect requirement.
- Field Check accepts `GPU / The Swarm`.
- Completion modal appears.
- `Next` moves to `#ch6`.
- Live state contains `currentChapter = 6`, `activeScene = Ch6DatacenterScene`, `chapters.ch5.completed = true`, `chapters.ch5.quizCorrect = true`, and `chapters.ch5.selectedChipIds.length > 0`.
- Desktop and mobile screenshots show no panel overlap.

Suggested screenshot paths:
- `/tmp/rock-to-rack-m6-ch5-dice.png`
- `/tmp/rock-to-rack-m6-ch5-sort.png`
- `/tmp/rock-to-rack-m6-ch5-roster.png`
- `/tmp/rock-to-rack-m6-ch5-mobile.png`

- [ ] **Step 5: Update handoff**

Update `docs/agent-context.md` with:
- M6 implementation summary.
- Key files.
- Fresh test/build/JSON parse results.
- Browser smoke evidence and screenshot paths.
- Latest next step: M7 Chapter 6, Rack to Riches.

## Moderator Review Checklist

Before claiming M6 done:
- [ ] `src/sim/package.ts` contains no DOM, Phaser, localStorage, or JSON imports other than type imports.
- [ ] Chapter 5 user-facing text lives in JSON content files.
- [ ] `chips.json` is the only roster source.
- [ ] Old saves without `ch5` hydrate safely.
- [ ] `#ch5` and `#ch6` fixtures are deterministic.
- [ ] Chapter 5 completion does not require perfect play.
- [ ] Nova is visible but locked.
- [ ] Browser screenshots prove desktop and mobile layout quality.

## Retrospective Prompt

After implementation and verification:

```text
Worked: <one line>
Didn't: <one line>
Rule: <one concrete future-process improvement>
```

Only propose an `AGENTS.md` amendment if the same failure has appeared in two sessions.
