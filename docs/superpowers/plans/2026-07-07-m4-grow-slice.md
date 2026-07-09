# M4 Grow & Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the Chapter 3 stub with a playable Grow & Slice chapter at `#ch3` where the player grows a silicon ingot, slices wafers, answers the Field Check, and persists wafer output into Chapter 4.

**Architecture:** Keep grow/slice scoring in pure `src/sim/crystal.ts` functions with Vitest coverage. Keep `Ch3CrystalScene` responsible for Phaser drawing, pointer input, timed updates, and shared overlay mounting. Keep all balance values, event/quiz definitions, and player-facing text in JSON content files.

**Tech Stack:** Phaser 3.90, TypeScript strict, Vite, Vitest, DOM overlays, local binaries under `node_modules/.bin`.

---

## Classification

TYPE: `NEW_FEATURE`
COMPLEXITY: `COMPLEX`
SCOPE: `src/sim/`, `src/scenes/Ch3CrystalScene.ts`, `src/ui/`, `src/content/*.json`, `src/state/`, `src/fixtures/`, `src/styles.css`, tests, docs
RISK: `MEDIUM` because this adds a third playable chapter and extends save state.

Human checkpoint before implementation: required by AGENTS.md for COMPLEX tasks. Do not edit implementation files until Umar approves this plan.

## Current Baseline

- `#ch1` is playable and visually polished.
- `#ch2` is playable and verified.
- `#ch3` currently extends `ChapterStubScene`.
- `GameState.resources.wafers` exists, but there is no Chapter 3 quality/progress metadata.
- Existing shared systems to reuse:
  - `src/sim/economy.ts`
  - `src/sim/events.ts`
  - `src/ui/pipelineHud.ts`
  - `src/ui/dialogueOverlay.ts`
  - `src/ui/eventCardOverlay.ts`
  - `src/ui/factCard.ts`
  - `src/ui/chapterOneOverlay.ts` modal helpers

## Files

Create:

- `src/sim/crystal.ts` — pure Czochralski pull, ingot profile, slicing, retry, and goal scoring.
- `src/sim/crystal.test.ts` — focused tests for pull quality, event penalty, retry limits, slicing accuracy, flawed-section discard, and completion.
- `src/ui/chapterThreeOverlay.ts` — DOM overlay for stage, quality, temperature meter, pull/slice controls, retry action, quiz bridge, completion bridge.

Modify:

- `src/scenes/Ch3CrystalScene.ts` — replace stub with playable Phaser scene.
- `src/state/types.ts` — add `ChapterThreeProgress`.
- `src/state/gameState.ts` — initialize and hydrate `chapters.ch3`.
- `src/state/gameState.test.ts` — cover initial state, old-save hydration, and `#ch4` fixture completion.
- `src/fixtures/chapterFixtures.ts` — `#ch3` fixture starts with Ch2 complete; `#ch4+` fixtures mark Ch3 complete and provide wafers.
- `src/content/balance.json` — add `ch3` balance.
- `src/content/events.json` — add truck vibration event.
- `src/content/quiz.json` — add Ch3 Field Check.
- `src/content/strings.json` — add Ch3 labels, intro, facts, messages, completion.
- `src/content/SOURCES.md` — add M4 source note.
- `src/styles.css` — add Ch3 overlay and responsive styles.
- `docs/agent-context.md` — update handoff and verification evidence after implementation.

## Task 1: Crystal Simulation API

**Files:**
- Create: `src/sim/crystal.test.ts`
- Create: `src/sim/crystal.ts`

- [x] **Step 1: Write failing tests for pull quality and slicing**

Create `src/sim/crystal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ResourceCaps, ResourceState } from '../state/types';
import {
  applyVibrationPenalty,
  canRetryPull,
  completeSliceStage,
  createInitialCrystalChapter,
  generateIngotProfile,
  getCrystalGoalProgress,
  retryPull,
  sliceIngot,
  tickCrystalPull,
  type CrystalBalance
} from './crystal';

const balance: CrystalBalance = {
  tickSeconds: 1,
  targetPullSeconds: 12,
  targetIngotHeight: 100,
  greenZone: { min: 45, max: 55 },
  temperature: {
    start: 50,
    min: 0,
    max: 100,
    pullDriftPerSecond: 5,
    restDriftPerSecond: -3,
    noisePerSecond: 0
  },
  resourceUsePerSecond: {
    energy: 0.08,
    water: 0.04
  },
  retryLimit: 1,
  vibrationPenalty: {
    stability: 0.18,
    temperature: 9,
    timePenaltySeconds: 20
  },
  slicing: {
    guideCount: 8,
    tolerance: 6,
    flawedThreshold: 0.42,
    waferQualityScale: 100
  },
  pacingTargetSeconds: {
    min: 720,
    max: 840
  }
};

const resources: ResourceState = {
  minerals: {
    quartz: 60,
    copper: 30,
    lithium: 20,
    cobalt: 16,
    rareEarths: 8
  },
  wafers: 0,
  chips: 0,
  energy: 100,
  water: 100,
  credits: 500
};

const caps: ResourceCaps = {
  minerals: {
    quartz: 80,
    copper: 60,
    lithium: 45,
    cobalt: 36,
    rareEarths: 30
  },
  wafers: 24,
  chips: 40,
  energy: 100,
  water: 100,
  credits: 1000
};

describe('crystal simulation', () => {
  it('starts in pull stage with centered temperature', () => {
    const chapter = createInitialCrystalChapter(balance);

    expect(chapter.stage).toBe('pull');
    expect(chapter.temperature).toBe(50);
    expect(chapter.ingotHeight).toBe(0);
    expect(chapter.retryCount).toBe(0);
  });

  it('pulling in the green zone grows the ingot and raises quality', () => {
    let chapter = createInitialCrystalChapter(balance);
    let nextResources = resources;

    for (let index = 0; index < 8; index += 1) {
      const result = tickCrystalPull(chapter, nextResources, true, 1, balance);
      chapter = result.chapter;
      nextResources = result.resources;
    }

    expect(chapter.ingotHeight).toBeGreaterThan(0);
    expect(chapter.quality).toBeGreaterThan(0.5);
    expect(nextResources.energy).toBeLessThan(resources.energy);
    expect(nextResources.water).toBeLessThan(resources.water);
  });

  it('applies vibration as a stability and temperature penalty', () => {
    const chapter = createInitialCrystalChapter(balance);

    const result = applyVibrationPenalty(chapter, balance);

    expect(result.temperature).toBe(59);
    expect(result.stabilityPenalty).toBeCloseTo(0.18);
    expect(result.elapsedSeconds).toBe(20);
  });

  it('allows one pull retry and then blocks additional retries', () => {
    const chapter = {
      ...createInitialCrystalChapter(balance),
      ingotHeight: 80,
      quality: 0.2
    };

    const first = retryPull(chapter, balance);
    const second = retryPull(first, balance);

    expect(canRetryPull(chapter, balance)).toBe(true);
    expect(first.retryCount).toBe(1);
    expect(second.retryCount).toBe(1);
    expect(second.ingotHeight).toBe(first.ingotHeight);
  });

  it('generates smoother ingot profile from higher quality', () => {
    const high = generateIngotProfile(0.92, balance);
    const low = generateIngotProfile(0.25, balance);

    expect(high.filter((segment) => segment.flawed).length).toBeLessThan(low.filter((segment) => segment.flawed).length);
    expect(high.every((segment) => segment.width > 0)).toBe(true);
  });

  it('accurate slices create wafers while flawed sections are discarded', () => {
    const chapter = {
      ...createInitialCrystalChapter(balance),
      stage: 'slice' as const,
      quality: 0.8,
      ingotProfile: [
        { start: 0, end: 25, width: 84, flawed: false },
        { start: 25, end: 50, width: 34, flawed: true },
        { start: 50, end: 100, width: 86, flawed: false }
      ]
    };

    const first = sliceIngot(chapter, 12.5, balance);
    const second = sliceIngot(first.chapter, 37.5, balance);

    expect(first.createdWafer).toBe(true);
    expect(second.createdWafer).toBe(false);
    expect(second.chapter.wafersProduced).toBe(1);
  });

  it('completes when enough wafers are produced', () => {
    const chapter = {
      ...createInitialCrystalChapter(balance),
      stage: 'slice' as const,
      quality: 0.75,
      wafersProduced: 8
    };

    const result = completeSliceStage(chapter, resources, balance, caps);

    expect(result.chapter.stage).toBe('complete');
    expect(result.chapter.waferQuality).toBe(75);
    expect(result.resources.wafers).toBe(8);
    expect(getCrystalGoalProgress(result.chapter, balance).complete).toBe(true);
  });
});
```

- [x] **Step 2: Run tests and confirm RED**

Run:

```bash
node_modules/.bin/vitest run src/sim/crystal.test.ts
```

Expected: fail because `src/sim/crystal.ts` does not exist.

- [x] **Step 3: Implement pure crystal simulation**

Create `src/sim/crystal.ts` with:

- `CrystalStage = 'pull' | 'slice' | 'complete'`
- `CrystalBalance`
- `CrystalChapterState`
- `createInitialCrystalChapter()`
- `tickCrystalPull()`
- `applyVibrationPenalty()`
- `canRetryPull()`
- `retryPull()`
- `generateIngotProfile()`
- `sliceIngot()`
- `completeSliceStage()`
- `getCrystalGoalProgress()`

Implementation constraints:

- Use `spendResources()` and `addResources()` from `src/sim/economy.ts`.
- Keep all functions deterministic from inputs.
- Quality is a 0..1 value.
- `waferQuality` is an integer 0..100.
- Slicing position is normalized to 0..100.
- A slice succeeds when it is within `balance.slicing.tolerance` of a guide and the profile segment at that position is not flawed.

- [x] **Step 4: Run focused sim tests and fix until GREEN**

Run:

```bash
node_modules/.bin/vitest run src/sim/crystal.test.ts
```

Expected: 7/7 tests pass.

## Task 2: Chapter 3 Save State and Fixtures

**Files:**
- Modify: `src/state/types.ts`
- Modify: `src/state/gameState.ts`
- Modify: `src/state/gameState.test.ts`
- Modify: `src/fixtures/chapterFixtures.ts`

- [x] **Step 1: Add failing state tests**

Extend `src/state/gameState.test.ts` with tests that assert:

- `createInitialGameState().chapters.ch3` equals the safe default.
- an old save without `ch3` hydrates with the default.
- `createFixtureStateForScene(SceneKey.Ch4Fab)` marks Ch3 complete with wafers and quality.

Expected default:

```ts
{
  completed: false,
  completedAtSeconds: null,
  quizCorrect: null,
  ingotQuality: 0,
  waferQuality: 0,
  wafersProduced: 0,
  retryUsed: false,
  firstFacts: []
}
```

- [x] **Step 2: Run state tests and confirm RED**

Run:

```bash
node_modules/.bin/vitest run src/state/gameState.test.ts
```

Expected: fail because `ch3` is missing.

- [x] **Step 3: Extend state types and hydration**

In `src/state/types.ts`, add `ChapterThreeProgress` and include `ch3` in `ChapterProgressState`.

In `src/state/gameState.ts`, initialize `ch3`, hydrate it in `chaptersOr()`, and add a helper for bounded number lists if needed.

- [x] **Step 4: Extend fixtures**

In `src/fixtures/chapterFixtures.ts`:

- `#ch3` should start with Ch1 and Ch2 complete.
- `#ch4+` should set `ch3.completed = true`, `ingotQuality = 80`, `waferQuality = 80`, `wafersProduced = 8`, `retryUsed = false`, `quizCorrect = true`, and `resources.wafers = 8`.

- [x] **Step 5: Run state tests and full tests**

Run:

```bash
node_modules/.bin/vitest run src/state/gameState.test.ts
node_modules/.bin/vitest run
```

Expected: all tests pass.

## Task 3: Chapter 3 Content

**Files:**
- Modify: `src/content/balance.json`
- Modify: `src/content/events.json`
- Modify: `src/content/quiz.json`
- Modify: `src/content/strings.json`
- Modify: `src/content/SOURCES.md`

- [x] **Step 1: Add `ch3` balance**

Add a `ch3` object to `src/content/balance.json`:

```json
{
  "tickSeconds": 0.25,
  "targetPullSeconds": 70,
  "targetIngotHeight": 100,
  "greenZone": { "min": 43, "max": 57 },
  "temperature": {
    "start": 50,
    "min": 0,
    "max": 100,
    "pullDriftPerSecond": 4,
    "restDriftPerSecond": -2.8,
    "noisePerSecond": 0.6
  },
  "resourceUsePerSecond": {
    "energy": 0.035,
    "water": 0.018
  },
  "retryLimit": 1,
  "vibrationPenalty": {
    "stability": 0.16,
    "temperature": 8,
    "timePenaltySeconds": 30
  },
  "slicing": {
    "guideCount": 8,
    "tolerance": 5,
    "flawedThreshold": 0.45,
    "waferQualityScale": 100
  },
  "pacingTargetSeconds": {
    "min": 720,
    "max": 840
  },
  "eventTriggers": {
    "vibrationAtHeight": 35
  }
}
```

- [x] **Step 2: Add event and quiz content**

Add `ch3TruckVibration` to `src/content/events.json` with choices:

- `pause-and-center`: time penalty, small energy cost.
- `keep-pulling`: no time penalty, applies scene-level vibration penalty.

Add `ch3FieldCheck` to `src/content/quiz.json`:

- Correct: wafers are sliced from a round crystal ingot.
- Wrong: because rectangles are illegal.
- Wrong: because round wafers use less electricity.

- [x] **Step 3: Add strings**

Add `ch3` to `src/content/strings.json` with:

- title and subtitle.
- overlay labels.
- messages for pull, retry, slicing, discarded flawed section, slice miss, completion.
- intro dialogue.
- fact cards: `czochralski`, `roundWafers`, `diamondWire`.
- completion title/body.

- [x] **Step 4: Validate JSON**

Run:

```bash
node -e "for (const file of ['src/content/balance.json','src/content/events.json','src/content/quiz.json','src/content/strings.json']) JSON.parse(require('fs').readFileSync(file,'utf8')); console.log('json ok')"
```

Expected: `json ok`.

## Task 4: Chapter 3 Overlay

**Files:**
- Create: `src/ui/chapterThreeOverlay.ts`
- Modify: `src/styles.css`

- [x] **Step 1: Create overlay component**

Create `src/ui/chapterThreeOverlay.ts` that exports:

- `ChapterThreeLabels`
- `ChapterThreeOverlayOptions`
- `MountedChapterThreeOverlay`
- `mountChapterThreeOverlay()`
- `mountChapterThreeQuiz()`
- `mountChapterThreeComplete()`

Overlay should render:

- compact status panel with stage, quality, wafers, retry availability.
- temperature meter with green zone.
- primary action button text based on stage.
- retry button during pull stage.
- menu and kid/nerd toggle.

Bridge quiz/completion to the existing Chapter 1 modal helpers as Chapter 2 does.

- [x] **Step 2: Add styles**

Add CSS classes:

- `.ch3-overlay`
- `.ch3-status-panel`
- `.ch3-temperature-panel`
- `.ch3-action-panel`
- `.ch3-quality-bar`
- `.ch3-temperature-track`
- `.ch3-temperature-green`
- `.ch3-temperature-needle`
- `.ch3-slice-list`

Desktop: keep panels at edges and leave the crucible/ingot center open.

Mobile: collapse into top status plus bottom controls without covering the ingot center.

- [x] **Step 3: Typecheck**

Run:

```bash
node_modules/.bin/tsc --noEmit
```

Expected: pass.

## Task 5: Playable Ch3 Scene

**Files:**
- Replace: `src/scenes/Ch3CrystalScene.ts`

- [x] **Step 1: Replace stub scene**

Implement `Ch3CrystalScene` as a Phaser scene that:

- calls `gameStore.enterScene(SceneKey.Ch3Crystal, 3)`.
- draws a warm crystal-growth lab backdrop.
- mounts HUD and Ch3 overlay into `#ui-root`.
- shows intro dialogue.
- registers scene-level `pointerdown` and `pointerup` for hold/release pulling.
- uses `this.time.addEvent({ delay: BALANCE.ch3.tickSeconds * 1000, loop: true, callback })` for simulation ticks.
- draws crucible, molten silicon, seed, ingot height, green-zone meter, and saw/slice guides.
- handles the vibration event card.
- queues and displays fact cards.
- transitions from pull to slice when target height is reached.
- handles slice clicks/taps using normalized x/y along the ingot.
- shows quiz and completion after slicing output is ready.
- persists Chapter 3 progress and global `resources.wafers`.
- moves to `#ch4` on completion.

- [x] **Step 2: Add scene helper methods**

Keep helpers small and named:

- `mountDom()`
- `drawBackdrop()`
- `drawPullStage()`
- `drawSliceStage()`
- `redrawCrystal()`
- `tickPullStage()`
- `handleSlicePointer()`
- `showIntroDialogue()`
- `queueFact()`
- `showNextPendingFact()`
- `showEventCard()`
- `showQuiz()`
- `showCompletion()`
- `persistChapterProgress()`
- `syncChapterProgressFromStore()`
- `cleanup()`

- [x] **Step 3: Typecheck**

Run:

```bash
node_modules/.bin/tsc --noEmit
```

Expected: pass.

## Task 6: Browser Smoke and Visual QA

**Files:**
- No source edits unless QA finds issues.

- [x] **Step 1: Run full local verification**

Run:

```bash
node_modules/.bin/vitest run
node_modules/.bin/tsc --noEmit
node_modules/.bin/vite build
```

Expected:

- Vitest count increases by the new crystal tests.
- TypeScript passes.
- Vite build passes with only the existing Phaser bundle-size warning.

- [x] **Step 2: Run browser smoke**

Open `http://127.0.0.1:5174/?reset#ch3` with Playwright.

Verify:

- Ch3 scene loads with canvas and overlay.
- Intro can be dismissed.
- Mouse hold/release grows an ingot.
- Touch-style pointer events work through Playwright touchscreen or mobile viewport.
- Vibration event appears and can be resolved.
- Retry works once and cannot repeat.
- Slicing creates wafers.
- Quiz appears; wrong answer retries; correct answer completes.
- Completion button moves to `#ch4`.
- Live store shows `currentChapter = 4`, `activeScene = Ch4FabScene`, `resources.wafers > 0`, `chapters.ch3.completed = true`, and `chapters.ch3.waferQuality > 0`.

- [x] **Step 3: Capture screenshots**

Capture:

- `/tmp/rock-to-rack-m4-ch3-pull.png`
- `/tmp/rock-to-rack-m4-ch3-slice.png`
- `/tmp/rock-to-rack-m4-ch3-complete.png`
- `/tmp/rock-to-rack-m4-ch3-mobile.png`

Inspect with `view_image` and fix visible overlap, blank canvas, unreadable text, or blocked controls.

## Task 7: Handoff, Moderator Review, Retrospective

**Files:**
- Modify: `docs/agent-context.md`
- Append: `/Users/omar/.codex/session-log.md` because M4 is COMPLEX.

- [x] **Step 1: Update agent context**

Add M4 implementation summary, key files, verification evidence, screenshots, known caveats, and next likely milestone M5.

- [x] **Step 2: Moderator review**

Use the AGENTS.md moderator template. Scope must include Ch3 scene, sim, state, content, overlay, CSS, tests, screenshots.

- [x] **Step 3: Retrospective**

Use the AGENTS.md retrospective template.

- [x] **Step 4: Final response**

Report:

- what changed.
- exact verification commands and results.
- screenshot paths.
- remaining caveats, if any.

## Plan Self-Review

- Spec coverage: covers two mini-stages, quality from time-in-green-zone, slicing accuracy, discarded flawed sections, wafer count/quality persistence, fact cards, event card, Field Check, mouse/touch, and `#ch3` acceptance.
- Placeholder scan: no `TBD` or unspecified future implementation remains.
- Type consistency: `ChapterThreeProgress`, `CrystalBalance`, `CrystalChapterState`, and helper names are consistent across tasks.
- Risk: natural 13-minute pacing may require browser smoke acceleration through the exact loaded Vite module URL, same as M3.
- Workspace caveat: this directory is not a git repo, so plan commit steps are intentionally omitted.
