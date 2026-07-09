# M11 Wide Playability Cut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cold-start Crisis Run that gets a player into meaningful input within 10 seconds, records a replayable local score, and reduces dialogue friction without disturbing the existing six-chapter campaign.

**Architecture:** Keep the campaign intact and add a parallel `#crisis` mode. Put score math in a pure `src/sim/crisisRun.ts` module, persist best-run metadata in `GameState.meta`, expose mode choice from the existing menu overlay, implement the playable slice as a compact Phaser scene that reuses Chapter 6 datacenter sim primitives, and verify through Vitest plus a Playwright smoke script.

**Tech Stack:** TypeScript strict, Phaser 3.90, Vite 6, Vitest, Playwright, existing DOM overlay helpers, existing `GameStore` event bus.

---

## Intake Classification

TYPE: NEW_FEATURE  
COMPLEXITY: COMPLEX  
SCOPE: `src/sim/`, `src/state/`, `src/scenes/`, `src/ui/`, `src/content/`, `src/styles.css`, `tools/`, `package.json`, `docs/agent-context.md`  
RISK: MEDIUM. The change adds a new player route and save schema, but does not remove campaign content, external data, or production infrastructure.

Subagents after approval:

- `@architect`: pure scoring/state schema and migration review.
- `@frontend`: Crisis Run scene, menu UI, responsive smoke, and screenshot review.

Human checkpoint before step: implementation begins only after approval of this plan. No deploy or production promotion is part of M11.

Estimated token cost: 45k-70k depending on browser smoke and layout fixes.

## Current Ground Truth

- The active workspace is `/Users/omar/Downloads/Game`.
- This workspace is not a git repo; commit steps are skipped unless the project is initialized before execution.
- Use `corepack pnpm ...`; direct `pnpm` is not guaranteed on PATH.
- Current verified commands before this plan:
  - `corepack pnpm simulate`: pass, 5/5.
  - `corepack pnpm test`: pass, 150/150.
  - `corepack pnpm verify:static`: pass, 7/7.
  - `corepack pnpm build`: pass with the existing large Phaser bundle warning.
- Preview server has been running at `http://127.0.0.1:4173/`.
- The wide-playability audit is `docs/audits/2026-07-08-wide-playability-audit/report.md`.

## File Structure

Create:

- `src/sim/crisisRun.ts`: pure score calculation, grade assignment, best-run comparison, and run-result factory.
- `src/sim/crisisRun.test.ts`: score, grade, best-run, and deterministic result tests.
- `src/ui/crisisRunOverlay.ts`: DOM overlay for objective, timer, selected build type, resources, city lights, and result card.
- `src/ui/crisisRunOverlay.test.ts`: DOM tests for menu actions, result render, and callback wiring.
- `src/scenes/CrisisRunScene.ts`: compact playable datacenter crisis scene at `#crisis`.
- `tools/m11-browser-smoke.mjs`: Playwright smoke for menu-to-crisis, first input, result card, and mobile render.

Modify:

- `src/state/types.ts`: add `CrisisRunResult` and `MetaProgressState`.
- `src/state/gameState.ts`: bump save version, initialize `meta`, hydrate older saves safely.
- `src/state/gameState.test.ts`: cover fresh meta state, version 2 hydration into version 3, and best-run persistence.
- `src/state/gameStore.ts`: add `recordCrisisRunResult`.
- `src/scenes/sceneKeys.ts`: add `SceneKey.CrisisRun`.
- `src/scenes/sceneRouting.ts`: route `#crisis`.
- `src/scenes/sceneRouting.test.ts`: cover the new hash.
- `src/scenes/index.ts`: register `CrisisRunScene`.
- `src/scenes/MenuScene.ts`: pass campaign and crisis callbacks into the menu overlay.
- `src/ui/menuOverlay.ts`: show two primary actions, best run, and a clearer mission line.
- `src/content/strings.json`: add menu crisis copy and add a shared dialogue skip label.
- `src/ui/dialogueOverlay.ts`: add optional skip action for existing chapter dialogue.
- `src/ui/dialogueOverlay.test.ts`: cover dialogue skip behavior using the existing fake-DOM test style.
- `src/styles.css`: style crisis scene UI, result card, and menu mode split with mobile constraints.
- `package.json`: add `"smoke:m11": "node tools/m11-browser-smoke.mjs"`.
- `docs/agent-context.md`: append M11 summary, files changed, verification, screenshot paths, and residual risks after implementation.

---

## Task 1: Pure Crisis Run Score Contract

**Files:**
- Create: `src/sim/crisisRun.ts`
- Create: `src/sim/crisisRun.test.ts`

- [ ] **Step 1: Write the failing scoring tests**

Create `src/sim/crisisRun.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  bestCrisisRun,
  calculateCrisisRunScore,
  createCrisisRunResult,
  gradeForScore
} from './crisisRun';
import type { CrisisRunResult } from '../state/types';

describe('crisis run scoring', () => {
  it('rewards city lights, contracts, efficiency, and speed', () => {
    const score = calculateCrisisRunScore({
      elapsedSeconds: 420,
      cityLights: 100,
      servedContracts: 4,
      powerEfficiency: 0.9,
      heatPeak: 42,
      mistakes: 0
    });

    expect(score).toBeGreaterThanOrEqual(850);
    expect(score).toBeLessThanOrEqual(1000);
  });

  it('penalizes overheated and incomplete runs', () => {
    const score = calculateCrisisRunScore({
      elapsedSeconds: 900,
      cityLights: 55,
      servedContracts: 1,
      powerEfficiency: 0.35,
      heatPeak: 96,
      mistakes: 5
    });

    expect(score).toBeLessThan(430);
  });

  it('assigns stable grades', () => {
    expect(gradeForScore(930)).toBe('S');
    expect(gradeForScore(810)).toBe('A');
    expect(gradeForScore(670)).toBe('B');
    expect(gradeForScore(510)).toBe('C');
    expect(gradeForScore(320)).toBe('D');
  });

  it('creates a deterministic result with a share line', () => {
    const result = createCrisisRunResult({
      runId: 'run-001',
      completedAt: '2026-07-08T12:00:00.000Z',
      elapsedSeconds: 510,
      cityLights: 88,
      servedContracts: 3,
      powerEfficiency: 0.74,
      heatPeak: 63,
      mistakes: 1
    });

    expect(result.mode).toBe('crisis');
    expect(result.score).toBeGreaterThan(650);
    expect(result.shareLine).toContain('Rock to Rack');
    expect(result.shareLine).toContain(String(result.score));
  });

  it('keeps the higher score and uses faster time as a tie breaker', () => {
    const slower: CrisisRunResult = createCrisisRunResult({
      runId: 'slow',
      completedAt: '2026-07-08T12:00:00.000Z',
      elapsedSeconds: 600,
      cityLights: 100,
      servedContracts: 4,
      powerEfficiency: 0.8,
      heatPeak: 50,
      mistakes: 1
    });
    const faster: CrisisRunResult = {
      ...slower,
      runId: 'fast',
      elapsedSeconds: 450
    };
    const weaker: CrisisRunResult = {
      ...slower,
      runId: 'weak',
      score: slower.score - 50
    };

    expect(bestCrisisRun(null, slower)).toBe(slower);
    expect(bestCrisisRun(slower, weaker)).toBe(slower);
    expect(bestCrisisRun(slower, faster)).toBe(faster);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
corepack pnpm vitest run src/sim/crisisRun.test.ts
```

Expected: FAIL because `src/sim/crisisRun.ts` does not exist.

- [ ] **Step 3: Add state-facing result types**

Modify `src/state/types.ts` by inserting these types before `GameState`:

```ts
export type CrisisRunGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface CrisisRunResult {
  runId: string;
  mode: 'crisis';
  completedAt: string;
  elapsedSeconds: number;
  cityLights: number;
  servedContracts: number;
  powerEfficiency: number;
  heatPeak: number;
  mistakes: number;
  score: number;
  grade: CrisisRunGrade;
  shareLine: string;
}

export interface MetaProgressState {
  crisisRuns: CrisisRunResult[];
  bestCrisisRun: CrisisRunResult | null;
}
```

Then add `meta` to `GameState`:

```ts
export interface GameState {
  version: number;
  preferences: Preferences;
  progress: ProgressState;
  resources: ResourceState;
  chapters: ChapterProgressState;
  meta: MetaProgressState;
  updatedAt: string;
}
```

- [ ] **Step 4: Implement pure scoring**

Create `src/sim/crisisRun.ts`:

```ts
import type { CrisisRunGrade, CrisisRunResult } from '../state/types';

export interface CrisisRunScoreInput {
  elapsedSeconds: number;
  cityLights: number;
  servedContracts: number;
  powerEfficiency: number;
  heatPeak: number;
  mistakes: number;
}

export interface CrisisRunResultInput extends CrisisRunScoreInput {
  runId: string;
  completedAt: string;
}

export const CRISIS_RUN_TARGET_SECONDS = 600;
export const CRISIS_RUN_HISTORY_LIMIT = 12;

export function calculateCrisisRunScore(input: CrisisRunScoreInput): number {
  const cityScore = clamp(input.cityLights, 0, 100) * 4;
  const contractScore = clamp(input.servedContracts, 0, 4) * 80;
  const speedRatio = clamp((CRISIS_RUN_TARGET_SECONDS - input.elapsedSeconds) / CRISIS_RUN_TARGET_SECONDS, -0.8, 0.6);
  const speedScore = 120 + speedRatio * 160;
  const efficiencyScore = clamp(input.powerEfficiency, 0, 1) * 120;
  const heatPenalty = Math.max(0, input.heatPeak - 70) * 4;
  const mistakePenalty = Math.max(0, input.mistakes) * 35;
  return Math.round(clamp(cityScore + contractScore + speedScore + efficiencyScore - heatPenalty - mistakePenalty, 0, 1000));
}

export function gradeForScore(score: number): CrisisRunGrade {
  if (score >= 900) {
    return 'S';
  }
  if (score >= 780) {
    return 'A';
  }
  if (score >= 640) {
    return 'B';
  }
  if (score >= 480) {
    return 'C';
  }
  return 'D';
}

export function createCrisisRunResult(input: CrisisRunResultInput): CrisisRunResult {
  const score = calculateCrisisRunScore(input);
  const grade = gradeForScore(score);
  return {
    ...input,
    mode: 'crisis',
    score,
    grade,
    shareLine: `Rock to Rack Crisis Run: ${score} points, grade ${grade}, ${Math.round(input.cityLights)}% city lights online.`
  };
}

export function bestCrisisRun(current: CrisisRunResult | null, candidate: CrisisRunResult): CrisisRunResult {
  if (!current) {
    return candidate;
  }
  if (candidate.score > current.score) {
    return candidate;
  }
  if (candidate.score === current.score && candidate.elapsedSeconds < current.elapsedSeconds) {
    return candidate;
  }
  return current;
}

export function appendCrisisRunHistory(history: CrisisRunResult[], result: CrisisRunResult): CrisisRunResult[] {
  return [result, ...history].slice(0, CRISIS_RUN_HISTORY_LIMIT);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

- [ ] **Step 5: Run the scoring test**

Run:

```bash
corepack pnpm vitest run src/sim/crisisRun.test.ts
```

Expected: PASS.

---

## Task 2: Save Schema And Store Support

**Files:**
- Modify: `src/state/gameState.ts`
- Modify: `src/state/gameState.test.ts`
- Modify: `src/state/gameStore.ts`

- [ ] **Step 1: Write failing state tests**

Append to `src/state/gameState.test.ts`:

```ts
it('initializes crisis run meta progress', () => {
  const state = createInitialGameState();

  expect(state.meta).toEqual({
    crisisRuns: [],
    bestCrisisRun: null
  });
});

it('hydrates version 2 saves into version 3 crisis meta defaults', () => {
  const state = hydrateGameState(JSON.stringify({
    version: 2,
    preferences: { textMode: 'kid', muted: true, textSize: 'normal' },
    progress: { currentChapter: 6, unlockedChapters: [1, 2, 3, 4, 5, 6], activeScene: 'Ch6DatacenterScene' },
    resources: {
      minerals: { quartz: 1, copper: 1, lithium: 1, cobalt: 1, rareEarths: 1 },
      wafers: 1,
      chips: 1,
      energy: 100,
      water: 100,
      credits: 250
    },
    chapters: {},
    updatedAt: '2026-07-08T00:00:00.000Z'
  }));

  expect(state.version).toBe(SAVE_VERSION);
  expect(state.progress.currentChapter).toBe(6);
  expect(state.meta.crisisRuns).toEqual([]);
  expect(state.meta.bestCrisisRun).toBeNull();
});
```

Append to the `GameStore` describe block, or create one if the file structure requires it:

```ts
it('records crisis results and keeps the best run', () => {
  const store = new GameStore();
  const weaker = {
    runId: 'weaker',
    mode: 'crisis' as const,
    completedAt: '2026-07-08T12:00:00.000Z',
    elapsedSeconds: 620,
    cityLights: 70,
    servedContracts: 2,
    powerEfficiency: 0.6,
    heatPeak: 80,
    mistakes: 2,
    score: 500,
    grade: 'C' as const,
    shareLine: 'Rock to Rack Crisis Run: 500 points, grade C, 70% city lights online.'
  };
  const stronger = {
    ...weaker,
    runId: 'stronger',
    elapsedSeconds: 500,
    cityLights: 100,
    servedContracts: 4,
    score: 880,
    grade: 'A' as const,
    shareLine: 'Rock to Rack Crisis Run: 880 points, grade A, 100% city lights online.'
  };

  store.recordCrisisRunResult(weaker);
  store.recordCrisisRunResult(stronger);

  expect(store.getState().meta.crisisRuns.map((run) => run.runId)).toEqual(['stronger', 'weaker']);
  expect(store.getState().meta.bestCrisisRun?.runId).toBe('stronger');
});
```

- [ ] **Step 2: Run the state test to verify it fails**

Run:

```bash
corepack pnpm vitest run src/state/gameState.test.ts
```

Expected: FAIL because `meta` and `recordCrisisRunResult` are missing.

- [ ] **Step 3: Implement save migration**

Modify `src/state/gameState.ts`:

```ts
import type {
  CrisisRunResult,
  DatacenterBuildingType,
  DatacenterContractId,
  DatacenterStage,
  GameState,
  MetaProgressState,
  MineralType,
  TextMode,
  TextSize
} from './types';

export const SAVE_VERSION = 3;
```

Add `meta` in `createInitialGameState()` before `updatedAt`:

```ts
    meta: {
      crisisRuns: [],
      bestCrisisRun: null
    },
```

Inside `hydrateGameState`, after `const chapters = ...`, add:

```ts
    const meta = isRecord(parsed.meta) ? parsed.meta : {};
```

Add `meta` to the returned state:

```ts
      meta: metaOr(meta, base.meta),
```

Add these helpers near the existing hydration helpers:

```ts
function metaOr(value: unknown, fallback: MetaProgressState): MetaProgressState {
  if (!isRecord(value)) {
    return fallback;
  }

  const crisisRuns = crisisRunListOr(value.crisisRuns, fallback.crisisRuns);
  const bestRun = crisisRunOr(value.bestCrisisRun, fallback.bestCrisisRun);
  return {
    crisisRuns,
    bestCrisisRun: bestRun
  };
}

function crisisRunListOr(value: unknown, fallback: CrisisRunResult[]): CrisisRunResult[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((item) => crisisRunOr(item, null))
    .filter((item): item is CrisisRunResult => item !== null)
    .slice(0, 12);
}

function crisisRunOr(value: unknown, fallback: CrisisRunResult | null): CrisisRunResult | null {
  if (!isRecord(value)) {
    return fallback;
  }

  const grade = value.grade;
  if (value.mode !== 'crisis' || !isCrisisRunGrade(grade)) {
    return fallback;
  }

  return {
    runId: stringOr(value.runId, 'unknown-run'),
    mode: 'crisis',
    completedAt: stringOr(value.completedAt, new Date(0).toISOString()),
    elapsedSeconds: numberOr(value.elapsedSeconds, 0),
    cityLights: numberOr(value.cityLights, 0),
    servedContracts: numberOr(value.servedContracts, 0),
    powerEfficiency: numberOr(value.powerEfficiency, 0),
    heatPeak: numberOr(value.heatPeak, 0),
    mistakes: numberOr(value.mistakes, 0),
    score: numberOr(value.score, 0),
    grade,
    shareLine: stringOr(value.shareLine, 'Rock to Rack Crisis Run')
  };
}

function isCrisisRunGrade(value: unknown): value is CrisisRunResult['grade'] {
  return value === 'S' || value === 'A' || value === 'B' || value === 'C' || value === 'D';
}
```

- [ ] **Step 4: Implement store result recording**

Modify `src/state/gameStore.ts`:

```ts
import { appendCrisisRunHistory, bestCrisisRun } from '../sim/crisisRun';
import type { CrisisRunResult, GameState, TextMode, TextSize } from './types';
```

Add this method before `startAutosave()`:

```ts
  recordCrisisRunResult(result: CrisisRunResult): void {
    this.update((state) => ({
      ...state,
      meta: {
        crisisRuns: appendCrisisRunHistory(state.meta.crisisRuns, result),
        bestCrisisRun: bestCrisisRun(state.meta.bestCrisisRun, result)
      }
    }));
    this.events.emit('analytics:event', {
      name: 'crisis_run_complete',
      payload: {
        score: result.score,
        grade: result.grade,
        elapsedSeconds: result.elapsedSeconds,
        cityLights: result.cityLights,
        servedContracts: result.servedContracts
      }
    });
    this.saveNow();
  }
```

- [ ] **Step 5: Run state tests**

Run:

```bash
corepack pnpm vitest run src/state/gameState.test.ts src/sim/crisisRun.test.ts
```

Expected: PASS.

---

## Task 3: Menu Route And Mode Split

**Files:**
- Modify: `src/scenes/sceneKeys.ts`
- Modify: `src/scenes/sceneRouting.ts`
- Modify: `src/scenes/sceneRouting.test.ts`
- Modify: `src/scenes/index.ts`
- Modify: `src/scenes/MenuScene.ts`
- Modify: `src/ui/menuOverlay.ts`
- Modify: `src/content/strings.json`

- [ ] **Step 1: Write failing routing test**

Modify `src/scenes/sceneRouting.test.ts`:

```ts
  it('routes the crisis run hash to the crisis scene', () => {
    expect(sceneKeyFromHash('#crisis')).toBe(SceneKey.CrisisRun);
  });
```

Run:

```bash
corepack pnpm vitest run src/scenes/sceneRouting.test.ts
```

Expected: FAIL because `SceneKey.CrisisRun` is not defined.

- [ ] **Step 2: Add scene key and hash route**

Modify `src/scenes/sceneKeys.ts`:

```ts
export enum SceneKey {
  Boot = 'BootScene',
  Menu = 'MenuScene',
  Sandbox = 'SandboxScene',
  CrisisRun = 'CrisisRunScene',
  Ch1Mine = 'Ch1MineScene',
  Ch2Refinery = 'Ch2RefineryScene',
  Ch3Crystal = 'Ch3CrystalScene',
  Ch4Fab = 'Ch4FabScene',
  Ch5Package = 'Ch5PackageScene',
  Ch6Datacenter = 'Ch6DatacenterScene'
}
```

Modify `src/scenes/sceneRouting.ts`:

```ts
  ['#crisis', SceneKey.CrisisRun],
```

- [ ] **Step 3: Add temporary scene registration**

Create a minimal `src/scenes/CrisisRunScene.ts` so registration can compile before the full scene task:

```ts
import Phaser from 'phaser';
import { gameStore } from '../state/gameStore';
import { SceneKey } from './sceneKeys';

export class CrisisRunScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.CrisisRun);
  }

  create(): void {
    gameStore.enterScene(SceneKey.CrisisRun);
    this.add.rectangle(640, 360, 1280, 720, 0x06111d);
    this.add.text(400, 340, 'Crisis Run loading', {
      color: '#fff7d6',
      fontFamily: 'Nunito, system-ui',
      fontSize: '32px',
      fontStyle: '900'
    });
  }
}
```

Modify `src/scenes/index.ts` to import and register `CrisisRunScene` before chapter scenes:

```ts
import { CrisisRunScene } from './CrisisRunScene';
```

Add it to `GAME_SCENES`:

```ts
  CrisisRunScene,
```

- [ ] **Step 4: Split menu actions**

Modify `src/ui/menuOverlay.ts` options:

```ts
interface MenuOverlayOptions {
  state: GameState;
  onPlayCampaign: () => void;
  onPlayCrisis: () => void;
  onTextModeToggle: () => void;
  onMuteToggle: () => void;
  onOpenCodex: () => void;
  onOpenSettings: () => void;
  onOpenFeedback?: () => void;
}
```

Replace the existing single play action:

```ts
  actions.append(button('Play', 'primary-action menu-play', options.onPlay));
```

with:

```ts
  const bestRun = options.state.meta.bestCrisisRun;
  actions.append(
    button('Crisis Run', 'primary-action menu-play', options.onPlayCrisis),
    button('Learn Mode', 'secondary-action menu-learn', options.onPlayCampaign)
  );

  if (bestRun) {
    const best = document.createElement('p');
    best.className = 'menu-best-run';
    best.textContent = `Best Crisis Run: ${bestRun.score} points, grade ${bestRun.grade}`;
    actions.append(best);
  }
```

Modify `src/scenes/MenuScene.ts` `overlayOptions()`:

```ts
      onPlayCampaign: () => {
        window.location.hash = 'ch1';
        gameStore.enterScene(SceneKey.Ch1Mine, 1);
        this.scene.start(SceneKey.Ch1Mine);
      },
      onPlayCrisis: () => {
        window.location.hash = 'crisis';
        gameStore.enterScene(SceneKey.CrisisRun);
        this.scene.start(SceneKey.CrisisRun);
      },
```

- [ ] **Step 5: Run route and type checks**

Run:

```bash
corepack pnpm vitest run src/scenes/sceneRouting.test.ts
corepack pnpm build
```

Expected: route test passes and build passes. The scene is still a temporary loading screen until Task 5.

---

## Task 4: Dialogue Skip Foundation

**Files:**
- Modify: `src/ui/dialogueOverlay.ts`
- Create: `src/ui/dialogueOverlay.test.ts`
- Modify: `src/content/strings.json`

- [ ] **Step 1: Write failing dialogue overlay tests**

Create `src/ui/dialogueOverlay.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDialogue } from './dialogueOverlay';

const labels = {
  next: { kid: 'Next', nerd: 'Advance' },
  done: { kid: 'Done', nerd: 'Close dialogue' },
  skip: { kid: 'Skip', nerd: 'Skip briefing' }
};

const lines = [
  {
    id: 'one',
    speakerName: { kid: 'Sam', nerd: 'Sam' },
    portraitColor: '#f8d45c',
    text: { kid: 'First line', nerd: 'First line' }
  },
  {
    id: 'two',
    speakerName: { kid: 'Dr. Vega', nerd: 'Dr. Vega' },
    portraitColor: '#60d394',
    text: { kid: 'Second line', nerd: 'Second line' }
  }
];

beforeEach(() => {
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mountDialogue', () => {
  it('calls onComplete when skip is pressed', () => {
    const root = document.createElement('div');
    let completed = 0;

    mountDialogue(root, {
      lines,
      textMode: 'kid',
      labels,
      onComplete: () => {
        completed += 1;
      }
    });

    root.querySelector<HTMLButtonElement>('.dialogue-skip')?.click();

    expect(completed).toBe(1);
    expect(root.querySelector('.dialogue-shell')).toBeNull();
  });

  it('does not render skip when the label is absent', () => {
    const root = document.createElement('div');

    mountDialogue(root, {
      lines,
      textMode: 'kid',
      labels: {
        next: labels.next,
        done: labels.done
      },
      onComplete: () => undefined
    });

    expect(root.querySelector('.dialogue-skip')).toBeNull();
  });
});

class FakeDocument {
  createElement(tagName: string): HTMLElement {
    return new FakeElement(tagName) as unknown as HTMLElement;
  }
}

class FakeElement {
  className = '';
  type = '';
  private children: FakeElement[] = [];
  private ownText = '';
  private parent: FakeElement | undefined;
  private readonly listeners = new Map<string, Array<(event: { stopPropagation: () => void }) => void>>();

  constructor(private readonly tagName: string) {}

  get textContent(): string {
    return `${this.ownText}${this.children.map((child) => child.textContent).join('')}`;
  }

  set textContent(value: string | null) {
    this.ownText = value ?? '';
    this.children = [];
  }

  append(...nodes: Array<FakeElement | HTMLElement>): void {
    for (const node of nodes) {
      const child = node as unknown as FakeElement;
      child.parent = this;
      this.children.push(child);
    }
  }

  replaceChildren(...nodes: Array<FakeElement | HTMLElement>): void {
    this.children = [];
    this.ownText = '';
    this.append(...nodes);
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  addEventListener(type: string, listener: (event: { stopPropagation: () => void }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) {
      listener({ stopPropagation: vi.fn() });
    }
  }

  querySelector<T extends HTMLElement>(selector: string): T | null {
    return (this.querySelectorAll(selector)[0] ?? null) as T | null;
  }

  querySelectorAll(selector: string): HTMLElement[] {
    const matches: FakeElement[] = [];
    this.walk((element) => {
      if (element.matches(selector)) {
        matches.push(element);
      }
    });
    return matches as unknown as HTMLElement[];
  }

  private removeChild(child: FakeElement): void {
    this.children = this.children.filter((candidate) => candidate !== child);
    child.parent = undefined;
  }

  private walk(visitor: (element: FakeElement) => void): void {
    for (const child of this.children) {
      visitor(child);
      child.walk(visitor);
    }
  }

  private matches(selector: string): boolean {
    if (selector.startsWith('.')) {
      return this.className.split(' ').includes(selector.slice(1));
    }
    return false;
  }
}
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
corepack pnpm vitest run src/ui/dialogueOverlay.test.ts
```

Expected: FAIL because `DialogueLabels.skip` and `.dialogue-skip` are not implemented.

- [ ] **Step 3: Implement skip support**

Modify `src/ui/dialogueOverlay.ts`:

```ts
export interface DialogueLabels {
  next: TextModeText;
  done: TextModeText;
  skip?: TextModeText;
}
```

Add this helper inside `mountDialogue`, near `advance`:

```ts
  const complete = (): void => {
    options.onComplete();
    shell.remove();
  };
```

Change `advance` to call `complete()`:

```ts
  const advance = (): void => {
    if (index >= options.lines.length - 1) {
      complete();
      return;
    }

    index += 1;
    render();
  };
```

Inside `render`, after creating `action`, add:

```ts
    const actions = document.createElement('div');
    actions.className = 'dialogue-actions';
    actions.append(action);

    if (options.labels.skip && index < options.lines.length - 1) {
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'dialogue-skip';
      skip.textContent = textForMode(options.labels.skip, textMode);
      skip.addEventListener('click', (event) => {
        event.stopPropagation();
        complete();
      });
      actions.append(skip);
    }
```

Replace:

```ts
    body.append(name, text, action);
```

with:

```ts
    body.append(name, text, actions);
```

- [ ] **Step 4: Add shared skip copy**

Modify `src/content/strings.json` under `sandbox.dialogueLabels`:

```json
      "skip": {
        "kid": "Skip",
        "nerd": "Skip briefing"
      }
```

- [ ] **Step 5: Add dialogue button styles**

Modify `src/styles.css` near existing dialogue styles:

```css
.dialogue-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dialogue-skip {
  min-height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff7d6;
  font: inherit;
  font-weight: 800;
  padding: 0 14px;
}
```

- [ ] **Step 6: Run dialogue tests**

Run:

```bash
corepack pnpm vitest run src/ui/dialogueOverlay.test.ts
```

Expected: PASS.

---

## Task 5: Crisis Run UI And Scene

**Files:**
- Create: `src/ui/crisisRunOverlay.ts`
- Create: `src/ui/crisisRunOverlay.test.ts`
- Replace temporary implementation in: `src/scenes/CrisisRunScene.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Write overlay tests**

Create `src/ui/crisisRunOverlay.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountCrisisRunOverlay, mountCrisisRunResult } from './crisisRunOverlay';
import type { CrisisRunResult } from '../state/types';

beforeEach(() => {
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('crisis run overlay', () => {
  it('renders the primary objective and build buttons', () => {
    const root = document.createElement('div');
    const selected: string[] = [];

    const overlay = mountCrisisRunOverlay(root, {
      elapsedSeconds: 12,
      cityLights: 25,
      heat: 18,
      powerLoad: 20,
      powerCapacity: 80,
      selectedBuildType: 'rack',
      canComplete: false,
      message: 'Place one rack, power, cooling, and network.',
      onSelectBuildType: (type) => selected.push(type),
      onComplete: () => undefined,
      onMenu: () => undefined
    });

    expect(root.textContent).toContain('Crisis Run');
    expect(root.textContent).toContain('25%');
    root.querySelector<HTMLButtonElement>('[data-build-type="power"]')?.click();
    expect(selected).toEqual(['power']);
    overlay.cleanup();
    expect(root.querySelector('.crisis-overlay')).toBeNull();
  });

  it('renders result score and actions', () => {
    const root = document.createElement('div');
    const actions: string[] = [];
    const result: CrisisRunResult = {
      runId: 'run-1',
      mode: 'crisis',
      completedAt: '2026-07-08T12:00:00.000Z',
      elapsedSeconds: 510,
      cityLights: 100,
      servedContracts: 4,
      powerEfficiency: 0.82,
      heatPeak: 55,
      mistakes: 0,
      score: 910,
      grade: 'S',
      shareLine: 'Rock to Rack Crisis Run: 910 points, grade S, 100% city lights online.'
    };

    const modal = mountCrisisRunResult(root, {
      result,
      isBest: true,
      onReplay: () => actions.push('replay'),
      onMenu: () => actions.push('menu')
    });

    expect(root.textContent).toContain('910');
    expect(root.textContent).toContain('New best');
    root.querySelector<HTMLButtonElement>('.crisis-replay')?.click();
    expect(actions).toEqual(['replay']);
    modal.cleanup();
    expect(root.querySelector('.crisis-result-backdrop')).toBeNull();
  });
});

class FakeDocument {
  createElement(tagName: string): HTMLElement {
    return new FakeElement(tagName) as unknown as HTMLElement;
  }
}

class FakeElement {
  className = '';
  dataset: Record<string, string> = {};
  disabled = false;
  type = '';
  private children: FakeElement[] = [];
  private ownText = '';
  private parent: FakeElement | undefined;
  private readonly listeners = new Map<string, Array<() => void>>();

  constructor(private readonly tagName: string) {}

  get textContent(): string {
    return `${this.ownText}${this.children.map((child) => child.textContent).join('')}`;
  }

  set textContent(value: string | null) {
    this.ownText = value ?? '';
    this.children = [];
  }

  append(...nodes: Array<FakeElement | HTMLElement>): void {
    for (const node of nodes) {
      const child = node as unknown as FakeElement;
      child.parent = this;
      this.children.push(child);
    }
  }

  replaceChildren(...nodes: Array<FakeElement | HTMLElement>): void {
    this.children = [];
    this.ownText = '';
    this.append(...nodes);
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  click(): void {
    if (this.disabled) {
      return;
    }
    for (const listener of this.listeners.get('click') ?? []) {
      listener();
    }
  }

  querySelector<T extends HTMLElement>(selector: string): T | null {
    return (this.querySelectorAll(selector)[0] ?? null) as T | null;
  }

  querySelectorAll(selector: string): HTMLElement[] {
    const matches: FakeElement[] = [];
    this.walk((element) => {
      if (element.matches(selector)) {
        matches.push(element);
      }
    });
    return matches as unknown as HTMLElement[];
  }

  private removeChild(child: FakeElement): void {
    this.children = this.children.filter((candidate) => candidate !== child);
    child.parent = undefined;
  }

  private walk(visitor: (element: FakeElement) => void): void {
    for (const child of this.children) {
      visitor(child);
      child.walk(visitor);
    }
  }

  private matches(selector: string): boolean {
    if (selector.startsWith('.')) {
      return this.className.split(' ').includes(selector.slice(1));
    }

    const buildType = selector.match(/^\[data-build-type="(.+)"\]$/)?.[1];
    if (buildType !== undefined) {
      return this.dataset.buildType === buildType;
    }

    return false;
  }
}
```

- [ ] **Step 2: Run the overlay test to verify it fails**

Run:

```bash
corepack pnpm vitest run src/ui/crisisRunOverlay.test.ts
```

Expected: FAIL because `crisisRunOverlay.ts` does not exist.

- [ ] **Step 3: Implement overlay**

Create `src/ui/crisisRunOverlay.ts`:

```ts
import type { CrisisRunResult, DatacenterBuildingType } from '../state/types';

interface CrisisRunOverlayOptions {
  elapsedSeconds: number;
  cityLights: number;
  heat: number;
  powerLoad: number;
  powerCapacity: number;
  selectedBuildType: DatacenterBuildingType;
  canComplete: boolean;
  message: string;
  onSelectBuildType: (type: DatacenterBuildingType) => void;
  onComplete: () => void;
  onMenu: () => void;
}

interface CrisisRunResultOptions {
  result: CrisisRunResult;
  isBest: boolean;
  onReplay: () => void;
  onMenu: () => void;
}

export interface MountedCrisisRunOverlay {
  update: (options: CrisisRunOverlayOptions) => void;
  cleanup: () => void;
}

const BUILD_TYPES: DatacenterBuildingType[] = ['rack', 'power', 'cooling', 'network', 'battery'];

export function mountCrisisRunOverlay(root: HTMLElement, options: CrisisRunOverlayOptions): MountedCrisisRunOverlay {
  const shell = document.createElement('section');
  shell.className = 'crisis-overlay';
  root.append(shell);

  const render = (next: CrisisRunOverlayOptions): void => {
    const title = elementWithText('h1', 'crisis-title', 'Crisis Run');
    const objective = elementWithText('p', 'crisis-objective', 'Bring Nova online before the city goes dark.');
    const stats = document.createElement('div');
    stats.className = 'crisis-stats';
    stats.append(
      stat('Time', `${Math.round(next.elapsedSeconds)}s`),
      stat('Lights', `${Math.round(next.cityLights)}%`),
      stat('Heat', `${Math.round(next.heat)}%`),
      stat('Power', `${Math.round(next.powerLoad)}/${Math.round(next.powerCapacity)}`)
    );

    const builds = document.createElement('div');
    builds.className = 'crisis-builds';
    for (const type of BUILD_TYPES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.buildType = type;
      button.className = type === next.selectedBuildType ? 'is-selected' : '';
      button.textContent = labelForBuild(type);
      button.addEventListener('click', () => next.onSelectBuildType(type));
      builds.append(button);
    }

    const message = elementWithText('p', 'crisis-message', next.message);
    const actions = document.createElement('div');
    actions.className = 'crisis-actions';
    const complete = button('Serve Nova', 'primary-action', next.onComplete);
    complete.disabled = !next.canComplete;
    actions.append(complete, button('Menu', 'secondary-action', next.onMenu));

    shell.replaceChildren(title, objective, stats, builds, message, actions);
  };

  render(options);

  return {
    update: render,
    cleanup: () => shell.remove()
  };
}

export function mountCrisisRunResult(root: HTMLElement, options: CrisisRunResultOptions): { cleanup: () => void } {
  const backdrop = document.createElement('section');
  backdrop.className = 'crisis-result-backdrop';
  const card = document.createElement('article');
  card.className = 'crisis-result-card';
  card.append(
    elementWithText('span', 'crisis-result-kicker', options.isBest ? 'New best' : 'Run complete'),
    elementWithText('h2', '', `${options.result.score} pts - Grade ${options.result.grade}`),
    elementWithText('p', '', options.result.shareLine),
    stat('Time', `${Math.round(options.result.elapsedSeconds)}s`),
    stat('Lights', `${Math.round(options.result.cityLights)}%`),
    stat('Heat peak', `${Math.round(options.result.heatPeak)}%`)
  );
  const actions = document.createElement('div');
  actions.className = 'crisis-result-actions';
  actions.append(
    button('Replay', 'primary-action crisis-replay', options.onReplay),
    button('Menu', 'secondary-action crisis-menu', options.onMenu)
  );
  card.append(actions);
  backdrop.append(card);
  root.append(backdrop);

  return {
    cleanup: () => backdrop.remove()
  };
}

function stat(label: string, value: string): HTMLElement {
  const item = document.createElement('span');
  item.className = 'crisis-stat';
  item.append(elementWithText('strong', '', value), elementWithText('small', '', label));
  return item;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

function elementWithText<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function labelForBuild(type: DatacenterBuildingType): string {
  const labels: Record<DatacenterBuildingType, string> = {
    rack: 'Rack',
    power: 'Power',
    cooling: 'Cooling',
    network: 'Network',
    battery: 'Battery'
  };
  return labels[type];
}
```

- [ ] **Step 4: Replace the temporary scene with the playable scene**

Replace `src/scenes/CrisisRunScene.ts` with a compact scene using these exact design points:

- Start immediately with no dialogue or modal.
- Use a 5-column by 3-row grid centered on the canvas.
- Default selected build type is `rack`.
- Pointer input places the selected building on empty cells.
- Number keys `1` to `5` select rack, power, cooling, network, battery.
- `Space` attempts final completion when the city is ready.
- Use datacenter sim functions already present in `src/sim/datacenter.ts`.
- Seed the scene with enough resources and available chips to avoid requiring campaign completion.
- Complete when the player has at least:
  - 1 rack,
  - 1 power,
  - 1 cooling,
  - 1 network,
  - city lights at or above 100 after `Serve Nova`.

Use this scene implementation as the starting point; the draw methods are included and should remain compact:

```ts
import Phaser from 'phaser';
import balanceJson from '../content/balance.json';
import {
  createInitialDatacenterChapter,
  placeDatacenterBuilding,
  tickDatacenter,
  type DatacenterBalance,
  type DatacenterChapterState
} from '../sim/datacenter';
import { createCrisisRunResult } from '../sim/crisisRun';
import { gameStore } from '../state/gameStore';
import type { DatacenterBuildingType, ResourceState } from '../state/types';
import { mountCrisisRunOverlay, mountCrisisRunResult, type MountedCrisisRunOverlay } from '../ui/crisisRunOverlay';
import { SceneKey } from './sceneKeys';

interface BalanceContent {
  resources: {
    caps: import('../sim/economy').ResourceCaps;
  };
  ch6: DatacenterBalance;
}

const BALANCE = balanceJson as unknown as BalanceContent;
const GRID = { x: 380, y: 220, cellWidth: 104, cellHeight: 82, columns: 5, rows: 3 };
const BUILD_TYPES: DatacenterBuildingType[] = ['rack', 'power', 'cooling', 'network', 'battery'];

export class CrisisRunScene extends Phaser.Scene {
  private chapter = createCrisisChapter();
  private resources = createCrisisResources();
  private selectedBuildType: DatacenterBuildingType = 'rack';
  private overlay: MountedCrisisRunOverlay | undefined;
  private resultModal: { cleanup: () => void } | undefined;
  private worldLayer: Phaser.GameObjects.Container | undefined;
  private zones: Phaser.GameObjects.Zone[] = [];
  private heatPeak = 0;
  private mistakes = 0;
  private completed = false;

  constructor() {
    super(SceneKey.CrisisRun);
  }

  create(): void {
    gameStore.enterScene(SceneKey.CrisisRun);
    this.chapter = createCrisisChapter();
    this.resources = createCrisisResources();
    this.selectedBuildType = 'rack';
    this.heatPeak = 0;
    this.mistakes = 0;
    this.completed = false;
    document.getElementById('ui-root')?.replaceChildren();
    this.drawBackdrop();
    this.worldLayer = this.add.container(0, 0);
    this.mountOverlay();
    this.bindKeyboard();
    this.redrawWorld();
    this.time.addEvent({
      delay: BALANCE.ch6.tickSeconds * 1000,
      loop: true,
      callback: () => this.tickRun(BALANCE.ch6.tickSeconds)
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private mountOverlay(): void {
    const root = document.getElementById('ui-root');
    if (!root) {
      throw new Error('Missing #ui-root element');
    }
    this.overlay = mountCrisisRunOverlay(root, this.overlayOptions());
  }

  private bindKeyboard(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < BUILD_TYPES.length) {
        this.selectedBuildType = BUILD_TYPES[index];
        this.refreshOverlay();
      }
      if (event.code === 'Space') {
        this.completeIfReady();
      }
    });
  }

  private tickRun(seconds: number): void {
    if (this.completed) {
      return;
    }
    this.chapter = tickDatacenter(this.chapter, seconds, BALANCE.ch6);
    this.heatPeak = Math.max(this.heatPeak, this.chapter.heat);
    this.refreshOverlay();
    this.redrawWorld();
  }

  private placeBuilding(column: number, row: number): void {
    const result = placeDatacenterBuilding(this.chapter, this.resources, this.selectedBuildType, { column, row }, BALANCE.ch6);
    if (!result.ok) {
      this.mistakes += 1;
      this.refreshOverlay('That spot is blocked or too expensive. Try another cell or building.');
      return;
    }
    this.chapter = tickDatacenter(result.chapter, 0, BALANCE.ch6);
    this.resources = result.resources;
    this.refreshOverlay();
    this.redrawWorld();
  }

  private completeIfReady(): void {
    if (!this.canComplete()) {
      this.mistakes += 1;
      this.refreshOverlay('Nova needs one rack, power, cooling, and network before the city lights can return.');
      return;
    }
    this.completed = true;
    this.chapter = {
      ...this.chapter,
      cityLights: 100,
      servedContracts: ['cartoonStream', 'weatherAi', 'cityBackup', 'hospitalNova'],
      completed: true,
      completedAtSeconds: Math.round(this.chapter.elapsedSeconds),
      stage: 'victory'
    };
    const result = createCrisisRunResult({
      runId: `crisis-${Date.now()}`,
      completedAt: new Date().toISOString(),
      elapsedSeconds: this.chapter.completedAtSeconds ?? this.chapter.elapsedSeconds,
      cityLights: this.chapter.cityLights,
      servedContracts: this.chapter.servedContracts.length,
      powerEfficiency: this.powerEfficiency(),
      heatPeak: this.heatPeak,
      mistakes: this.mistakes
    });
    const previousBest = gameStore.getState().meta.bestCrisisRun;
    gameStore.recordCrisisRunResult(result);
    this.resultModal = mountCrisisRunResult(documentRoot(), {
      result,
      isBest: !previousBest || result.score >= previousBest.score,
      onReplay: () => {
        window.location.hash = 'crisis';
        this.scene.restart();
      },
      onMenu: () => {
        window.location.hash = 'menu';
        this.scene.start(SceneKey.Menu);
      }
    });
  }

  private canComplete(): boolean {
    return ['rack', 'power', 'cooling', 'network'].every((type) => this.chapter.buildings.some((building) => building.type === type));
  }

  private powerEfficiency(): number {
    if (this.chapter.powerCapacity <= 0) {
      return 0;
    }
    return Math.min(this.chapter.powerLoad / this.chapter.powerCapacity, 1);
  }

  private overlayOptions(message = 'Place one rack, power, cooling, and network. Then serve Nova.'): Parameters<typeof mountCrisisRunOverlay>[1] {
    return {
      elapsedSeconds: this.chapter.elapsedSeconds,
      cityLights: this.chapter.cityLights,
      heat: this.chapter.heat,
      powerLoad: this.chapter.powerLoad,
      powerCapacity: this.chapter.powerCapacity,
      selectedBuildType: this.selectedBuildType,
      canComplete: this.canComplete(),
      message,
      onSelectBuildType: (type) => {
        this.selectedBuildType = type;
        this.refreshOverlay();
      },
      onComplete: () => this.completeIfReady(),
      onMenu: () => {
        window.location.hash = 'menu';
        this.scene.start(SceneKey.Menu);
      }
    };
  }

  private refreshOverlay(message?: string): void {
    this.overlay?.update(this.overlayOptions(message));
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x06111d);
    this.add.rectangle(640, 560, 1280, 220, 0x0d1b2a);
  }

  private redrawWorld(): void {
    this.worldLayer?.removeAll(true);
    this.zones.splice(0).forEach((zone) => zone.destroy());
    const graphics = this.add.graphics();
    this.worldLayer?.add(graphics);
    graphics.fillStyle(0x071c2a, 0.92);
    graphics.fillRoundedRect(GRID.x - 24, GRID.y - 24, GRID.columns * GRID.cellWidth + 48, GRID.rows * GRID.cellHeight + 48, 10);
    for (let row = 1; row <= GRID.rows; row += 1) {
      for (let column = 1; column <= GRID.columns; column += 1) {
        const x = GRID.x + (column - 1) * GRID.cellWidth;
        const y = GRID.y + (row - 1) * GRID.cellHeight;
        const building = this.chapter.buildings.find((candidate) => candidate.column === column && candidate.row === row);
        graphics.fillStyle(building ? colorForBuild(building.type) : 0x0b2536, building ? 0.85 : 0.55);
        graphics.fillRoundedRect(x, y, GRID.cellWidth - 10, GRID.cellHeight - 10, 8);
        graphics.lineStyle(2, building ? 0xfff7d6 : 0x60a5fa, building ? 0.72 : 0.18);
        graphics.strokeRoundedRect(x, y, GRID.cellWidth - 10, GRID.cellHeight - 10, 8);
        if (building) {
          const label = this.add.text(x + 18, y + 20, building.type.toUpperCase(), {
            color: '#06111d',
            fontFamily: 'Nunito, system-ui',
            fontSize: '18px',
            fontStyle: '900'
          });
          this.worldLayer?.add(label);
        }
        const zone = this.add.zone(x + (GRID.cellWidth - 10) / 2, y + (GRID.cellHeight - 10) / 2, GRID.cellWidth - 10, GRID.cellHeight - 10)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.placeBuilding(column, row));
        this.zones.push(zone);
      }
    }
  }

  private cleanup(): void {
    this.overlay?.cleanup();
    this.resultModal?.cleanup();
    this.zones.splice(0).forEach((zone) => zone.destroy());
  }
}

function createCrisisChapter(): DatacenterChapterState {
  return createInitialDatacenterChapter({
    completed: true,
    completedAtSeconds: 0,
    quizCorrect: true,
    sortedDies: 24,
    bins: { perfect: 8, good: 10, salvage: 6 },
    selectedChipIds: ['cpu', 'gpu', 'dram', 'nand', 'nic', 'pmic', 'nova'],
    builtChips: [],
    perfect7nmDies: 2,
    triggeredEvents: [],
    firstFacts: []
  }, BALANCE.ch6);
}

function createCrisisResources(): ResourceState {
  return {
    minerals: { quartz: 0, copper: 0, lithium: 0, cobalt: 0, rareEarths: 0 },
    wafers: 0,
    chips: 0,
    energy: 100,
    water: 100,
    credits: 700
  };
}

function documentRoot(): HTMLElement {
  const root = document.getElementById('ui-root');
  if (!root) {
    throw new Error('Missing #ui-root element');
  }
  return root;
}

function colorForBuild(type: DatacenterBuildingType): number {
  return {
    rack: 0x60a5fa,
    power: 0xf8d45c,
    cooling: 0x22d3ee,
    network: 0x60d394,
    battery: 0xa78bfa
  }[type];
}
```

- [ ] **Step 5: Style crisis UI**

Add to `src/styles.css` near Chapter 6 styles:

```css
.crisis-overlay {
  position: fixed;
  inset: 16px 16px auto 16px;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto;
  gap: 10px;
  pointer-events: none;
}

.crisis-overlay button {
  pointer-events: auto;
}

.crisis-title {
  margin: 0;
  color: #fff7d6;
  font-size: 1.4rem;
}

.crisis-objective,
.crisis-message {
  margin: 0;
  color: #d6f6ef;
  font-weight: 800;
}

.crisis-stats,
.crisis-builds,
.crisis-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.crisis-stat {
  min-width: 72px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(6, 17, 29, 0.82);
  color: #fff7d6;
  padding: 8px 10px;
}

.crisis-stat strong,
.crisis-stat small {
  display: block;
}

.crisis-builds button {
  min-height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff7d6;
  font-weight: 900;
  padding: 0 12px;
}

.crisis-builds button.is-selected {
  background: #f8d45c;
  color: #06111d;
}

.crisis-result-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  background: rgba(3, 10, 18, 0.74);
  padding: 20px;
}

.crisis-result-card {
  width: min(540px, 100%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: #071c2a;
  color: #fff7d6;
  padding: 20px;
}

.crisis-result-kicker {
  color: #60d394;
  font-weight: 900;
  text-transform: uppercase;
}

.crisis-result-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

@media (max-width: 760px) {
  .crisis-overlay {
    inset: 8px;
    grid-template-columns: 1fr;
  }

  .crisis-title {
    font-size: 1.1rem;
  }

  .crisis-builds button,
  .crisis-actions button {
    min-height: 44px;
  }
}
```

- [ ] **Step 6: Run crisis UI tests and build**

Run:

```bash
corepack pnpm vitest run src/ui/crisisRunOverlay.test.ts src/sim/crisisRun.test.ts
corepack pnpm build
```

Expected: PASS. Build may keep the existing large chunk warning.

---

## Task 6: M11 Browser Smoke

**Files:**
- Create: `tools/m11-browser-smoke.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add smoke script**

Create `tools/m11-browser-smoke.mjs`:

```js
import { chromium } from '@playwright/test';

const baseUrl = process.env.M11_BASE_URL ?? 'http://localhost:4173/';
const screenshots = {
  menu: '/tmp/rock-to-rack-m11-menu.png',
  crisis: '/tmp/rock-to-rack-m11-crisis.png',
  result: '/tmp/rock-to-rack-m11-result.png',
  mobile: '/tmp/rock-to-rack-m11-mobile.png'
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

async function waitForGame(page) {
  await page.waitForSelector('canvas', { timeout: 10_000 });
  await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10_000 });
}

async function runDesktopSmoke() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const issues = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push(message.text());
    }
  });
  page.on('pageerror', (error) => issues.push(error.message));

  await page.goto(fullUrl('?reset#menu'), { waitUntil: 'domcontentloaded' });
  await waitForGame(page);
  await page.screenshot({ path: screenshots.menu, fullPage: true });
  await page.getByRole('button', { name: 'Crisis Run' }).click();
  await page.waitForURL(/#crisis$/, { timeout: 10_000 });
  await waitForGame(page);
  await page.waitForSelector('.crisis-overlay', { timeout: 10_000 });
  await page.screenshot({ path: screenshots.crisis, fullPage: true });

  const placements = [
    { label: 'Rack', x: 430, y: 270 },
    { label: 'Power', x: 534, y: 270 },
    { label: 'Cooling', x: 638, y: 270 },
    { label: 'Network', x: 742, y: 270 }
  ];
  for (const placement of placements) {
    await page.getByRole('button', { name: placement.label }).click();
    await page.mouse.click(placement.x, placement.y);
  }
  await page.getByRole('button', { name: 'Serve Nova' }).click();
  await page.waitForSelector('.crisis-result-card', { timeout: 10_000 });
  const text = await page.locator('.crisis-result-card').textContent();
  assert(text?.includes('Grade'), 'Result card did not include grade');
  await page.screenshot({ path: screenshots.result, fullPage: true });

  await browser.close();
  if (issues.length > 0) {
    throw new Error(`Desktop smoke issues:\n${issues.join('\n')}`);
  }
}

async function runMobileSmoke() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(fullUrl('?reset#crisis'), { waitUntil: 'domcontentloaded' });
  await waitForGame(page);
  await page.waitForSelector('.crisis-overlay', { timeout: 10_000 });
  await page.screenshot({ path: screenshots.mobile, fullPage: true });
  await browser.close();
}

await runDesktopSmoke();
await runMobileSmoke();

console.log(JSON.stringify({ status: 'pass', url: baseUrl, screenshots }, null, 2));
```

- [ ] **Step 2: Add package script**

Modify `package.json` scripts:

```json
"smoke:m11": "node tools/m11-browser-smoke.mjs"
```

- [ ] **Step 3: Run preview smoke**

Start preview if it is not already running:

```bash
corepack pnpm preview -- --host localhost --port 4173
```

In another shell:

```bash
corepack pnpm smoke:m11
```

Expected: PASS and screenshot paths:

- `/tmp/rock-to-rack-m11-menu.png`
- `/tmp/rock-to-rack-m11-crisis.png`
- `/tmp/rock-to-rack-m11-result.png`
- `/tmp/rock-to-rack-m11-mobile.png`

Use `view_image` to inspect all four screenshots. Fix overlapping text, hidden buttons, or a non-obvious first input before marking M11 complete.

---

## Task 7: Full Verification And Handoff

**Files:**
- Modify: `docs/agent-context.md`

- [ ] **Step 1: Run the complete local verification suite**

Run:

```bash
corepack pnpm simulate
corepack pnpm test
corepack pnpm verify:static
corepack pnpm build
corepack pnpm smoke:m10
corepack pnpm smoke:m11
```

Expected:

- Simulator passes.
- All Vitest tests pass.
- Static verification passes.
- Build passes with only the existing large chunk warning.
- M10 smoke still passes.
- M11 smoke passes and produces four screenshots.

- [ ] **Step 2: Update handoff**

Append to `docs/agent-context.md`:

```md
## M11 Wide Playability Cut

M11 added a new `#crisis` Crisis Run path from the menu. It is separate from the six-chapter Learn Mode campaign, starts without mandatory dialogue, gives the player immediate datacenter placement input, records local Crisis Run score history, stores the best run in save metadata, and shows a compact result card with replay/menu actions.

Implemented:

- `src/sim/crisisRun.ts` pure score, grade, history, and best-run helpers.
- `GameState.meta` save schema for crisis run history and best run.
- Menu split between `Crisis Run` and `Learn Mode`.
- New `SceneKey.CrisisRun` and `#crisis` route.
- `src/scenes/CrisisRunScene.ts` compact playable datacenter crisis mode.
- `src/ui/crisisRunOverlay.ts` objective/build/result overlay.
- Dialogue skip support via `src/ui/dialogueOverlay.ts`.
- `tools/m11-browser-smoke.mjs` and `corepack pnpm smoke:m11`.

Verification:

- `corepack pnpm simulate`
- `corepack pnpm test`
- `corepack pnpm verify:static`
- `corepack pnpm build`
- `corepack pnpm smoke:m10`
- `corepack pnpm smoke:m11`

Screenshot evidence:

- `/tmp/rock-to-rack-m11-menu.png`
- `/tmp/rock-to-rack-m11-crisis.png`
- `/tmp/rock-to-rack-m11-result.png`
- `/tmp/rock-to-rack-m11-mobile.png`

Residual risks:

- Crisis Run is an M11 replay spine, not a full economy redesign.
- Chapter 6 campaign finale still needs the separate dashboard/payoff redesign identified in the wide-playability audit.
- Keyboard coverage improves in Crisis Run, but all six campaign chapters still need a broader accessibility pass.
```

- [ ] **Step 3: Moderator review**

Use this template after verification:

```text
╔══════════════════════════════════════╗
║         MODERATOR REVIEW             ║
╠══════════════════════════════════════╣
║ Scope: M11 crisis route, scoring,    ║
║ menu split, state migration, smoke   ║
╠══════════════════════════════════════╣
║ [BLOCK] <critical issue or none>     ║
║ [WARN]  <important issue or none>    ║
║ [NIT]   <minor issue or none>        ║
║ [IDEA]  <optional follow-up>         ║
╠══════════════════════════════════════╣
║ Verdict: PASS | NEEDS_FIXES          ║
╚══════════════════════════════════════╝
```

- [ ] **Step 4: Retrospective and session log**

Append to `~/.codex/session-log.md`:

```md
## 2026-07-08 Rock to Rack M11 Wide Playability Cut
Files changed: <count and main areas> | Tests: pass (`corepack pnpm simulate`; `corepack pnpm test`; `corepack pnpm verify:static`; `corepack pnpm build`; `corepack pnpm smoke:m10`; `corepack pnpm smoke:m11`) | Retro: <one-line lesson>
Rule proposed: no
```

---

## Acceptance Criteria

- `/#menu` shows `Crisis Run` as the most prominent action and `Learn Mode` as the campaign path.
- `/#crisis` loads a playable scene directly, with no mandatory dialogue or quiz before first input.
- A cold player can click or tap a cell within 10 seconds of loading `#crisis`.
- The player can complete a Crisis Run and see a result card with score, grade, time, city lights, heat peak, replay, and menu.
- The best Crisis Run persists in `GameState.meta.bestCrisisRun` and appears on the menu.
- Existing campaign route `/#ch1` still works.
- Existing M10 smoke still passes.
- M11 desktop and mobile screenshots are visually inspected.

## Self-Review

Spec coverage:

- First 10-second hook: Task 3 menu split and Task 5 direct `#crisis` scene.
- Replay spine: Task 1 scoring and Task 2 meta persistence.
- Shareable ending: Task 5 result card and `shareLine`.
- Teaching friction: Task 4 dialogue skip foundation and Crisis Run no-dialogue start.
- Verification: Task 6 smoke and Task 7 full suite.

Placeholder scan:

- The plan uses concrete file paths, commands, and code snippets for every new module.
- There are no deferred dependency decisions and no new production dependencies.

Type consistency:

- `CrisisRunResult` lives in `src/state/types.ts`.
- `src/sim/crisisRun.ts` imports `CrisisRunResult` and returns the same shape.
- `GameStore.recordCrisisRunResult` accepts `CrisisRunResult`.
- `menuOverlay` reads `state.meta.bestCrisisRun`.

## Execution Choice

Plan complete and saved to `docs/superpowers/plans/2026-07-08-m11-wide-playability-cut.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch focused workers for state/scoring and frontend scene/UI, then integrate and verify.
2. **Inline Execution** - execute the plan in this session using `superpowers:executing-plans`, with checkpoints after state, scene, smoke, and final verification.
