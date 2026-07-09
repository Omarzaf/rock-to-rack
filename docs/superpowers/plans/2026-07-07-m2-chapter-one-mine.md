# M2 Chapter One Mine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Chapter 1 stub with a playable mining chapter at `#ch1` that reaches the M2 acceptance criteria from `ROCK-TO-RACK-EXECUTION-PLAN.md`.

**Architecture:** Keep mining rules in pure `src/sim/` functions with Vitest coverage. Keep `Ch1MineScene` responsible for Phaser graphics, pointer input, scene timing, and mounting reusable DOM overlays from M1. Keep all text and balance/content data in JSON.

**Tech Stack:** Phaser 3.90, TypeScript strict, Vite, Vitest, DOM overlays, local project binaries in `node_modules/.bin` because `pnpm` is not on PATH.

---

## Classification

TYPE: `NEW_FEATURE`
COMPLEXITY: `COMPLEX`
SCOPE: `src/sim/`, `src/scenes/Ch1MineScene.ts`, `src/ui/`, `src/content/*.json`, `src/state/`, tests
RISK: `MEDIUM` because this replaces the first playable chapter and extends saved state.

Human checkpoint before implementation: required. Do not edit implementation files until Umar approves this plan.

## Current Baseline

- `node_modules/.bin/vitest run`: 13/13 tests pass.
- `node_modules/.bin/tsc --noEmit && node_modules/.bin/vite build`: passes.
- `src/scenes/Ch1MineScene.ts` is still a `ChapterStubScene`.
- Existing M1 reusable systems:
  - `src/sim/economy.ts`
  - `src/sim/events.ts`
  - `src/ui/pipelineHud.ts`
  - `src/ui/dialogueOverlay.ts`
  - `src/ui/factCard.ts`
  - `src/ui/eventCardOverlay.ts`
- `quiz.json` is empty and must be populated for M2.
- This directory is not a git repo, so no commit steps are possible unless the project is initialized or moved into a repo.

## File Structure

- Create `src/sim/mining.ts`: pure Chapter 1 mining state transitions.
- Create `src/sim/mining.test.ts`: TDD coverage for placement, extraction, depletion, energy upkeep, events, goal completion, and duration estimate.
- Create `src/ui/chapterOneOverlay.ts`: DOM overlay for goal checklist, selected deposit, miner slots, quiz, and completion screen.
- Replace `src/scenes/Ch1MineScene.ts`: Phaser side-view terrain, deposits, miner placement, ticking, fact/event/quiz flow.
- Modify `src/state/types.ts`: add minimal persisted Chapter 1 progress/stats.
- Modify `src/state/gameState.ts`: hydrate/serialize new persisted fields safely.
- Modify `src/fixtures/chapterFixtures.ts`: Ch2 fixture should represent Ch1-complete resources/state.
- Modify `src/content/balance.json`: add Chapter 1 deposits, miner costs, extraction rates, energy upkeep, target basket, event triggers, and pacing values.
- Modify `src/content/strings.json`: add Chapter 1 intro dialogue, labels, five fact cards, quiz/end-screen text.
- Modify `src/content/events.json`: add mine flood and copper price spike event cards.
- Modify `src/content/quiz.json`: add one Field Check question.
- Modify `src/styles.css`: add mine scene overlay, checklist, quiz, and completion styles.

## Task 1: Mining Simulation API

**Files:**
- Create: `src/sim/mining.ts`
- Create: `src/sim/mining.test.ts`

- [ ] Write failing tests for these behaviors:
  - placing a miner spends credits and occupies one of 4 slots
  - placing fails atomically when credits are insufficient
  - placing fails after 4 active miners
  - ticking extracts mineral output over elapsed seconds
  - deeper miners consume energy upkeep
  - deposits deplete and stop producing
  - goal progress returns complete only when target basket is met
  - duration estimate lands in 10-12 minutes for the planned balance

Run:

```bash
node_modules/.bin/vitest run src/sim/mining.test.ts
```

Expected RED: missing `src/sim/mining.ts` exports.

- [ ] Implement minimal pure API:

```ts
export interface MineDeposit {
  id: string;
  mineral: MineralType;
  x: number;
  y: number;
  depth: number;
  richness: number;
  remaining: number;
}

export interface PlacedMiner {
  id: string;
  depositId: string;
  mineral: MineralType;
  depth: number;
}

export interface MiningChapterState {
  deposits: MineDeposit[];
  miners: PlacedMiner[];
  firstMined: MineralType[];
  elapsedSeconds: number;
  triggeredEvents: string[];
}

export function placeMiner(
  chapter: MiningChapterState,
  resources: ResourceState,
  depositId: string,
  balance: MiningBalance
): PlaceMinerResult;

export function tickMining(
  chapter: MiningChapterState,
  resources: ResourceState,
  elapsedSeconds: number,
  balance: MiningBalance,
  caps: ResourceCaps
): TickMiningResult;

export function getGoalProgress(
  resources: ResourceState,
  target: Partial<Record<MineralType, number>>
): GoalProgress;

export function isGoalComplete(
  resources: ResourceState,
  target: Partial<Record<MineralType, number>>
): boolean;

export function estimateCompletionSeconds(
  balance: MiningBalance,
  target: Partial<Record<MineralType, number>>
): number;
```

- [ ] Run the focused test until GREEN, then run full tests.

## Task 2: Persisted Chapter State

**Files:**
- Modify: `src/state/types.ts`
- Modify: `src/state/gameState.ts`
- Modify: `src/state/gameState.test.ts`
- Modify: `src/fixtures/chapterFixtures.ts`

- [ ] Write failing tests proving:
  - fresh saves include empty Chapter 1 progress
  - old saves without chapter progress hydrate safely
  - Ch2 fixture carries Ch1-complete state and resources

Run:

```bash
node_modules/.bin/vitest run src/state/gameState.test.ts
```

- [ ] Implement a narrow persisted shape:

```ts
export interface ChapterOneProgress {
  firstMined: MineralType[];
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
}

export interface ChapterProgressState {
  ch1: ChapterOneProgress;
}

export interface GameState {
  version: number;
  preferences: Preferences;
  progress: ProgressState;
  resources: ResourceState;
  chapters: ChapterProgressState;
  updatedAt: string;
}
```

- [ ] Hydrate missing or malformed fields to safe defaults.

## Task 3: Chapter 1 Content

**Files:**
- Modify: `src/content/balance.json`
- Modify: `src/content/strings.json`
- Modify: `src/content/events.json`
- Modify: `src/content/quiz.json`

- [ ] Add balance-driven values only in JSON:
  - 5 mineral deposits: quartz, copper, lithium, cobalt, rareEarths
  - 4 miner slots
  - miner placement cost
  - per-depth energy upkeep
  - per-mineral extraction rates/richness
  - deposit totals/depletion values
  - target basket
  - event trigger thresholds
  - pacing target of 600-720 seconds

- [ ] Add player-facing strings as dual-register objects such as `{ "kid": "Mine quartz first.", "nerd": "Quartz is the input that will later become refined silicon." }`:
  - 4-line Sam/Dr. Vega intro
  - overlay labels and end-screen labels
  - five fact cards, one per mineral
  - field-check labels and answer explanations

- [ ] Add two event cards:
  - mine flood: pay credits or lose time
  - price spike: sell surplus copper for bonus

- [ ] Add one quiz:
  - question: Which mineral becomes the chip itself?
  - correct answer: Quartz/silicon

## Task 4: Chapter 1 DOM Overlay

**Files:**
- Create: `src/ui/chapterOneOverlay.ts`
- Modify: `src/styles.css`

- [ ] Build reusable DOM overlay functions for:
  - target basket checklist
  - active miner slots
  - selected deposit panel
  - quiz modal
  - chapter-complete panel with stats and `Next: The Refinery`

- [ ] Ensure all labels are dual-register and update when text mode toggles.

- [ ] Keep persistent UI away from the playfield center. HUD stays top, checklist/status stays edge-aligned, dialogue/fact/event overlays reuse M1 components.

## Task 5: Phaser Chapter Scene

**Files:**
- Replace: `src/scenes/Ch1MineScene.ts`

- [ ] Query Context7 for Phaser 3.90 pointer input and graphics usage before implementation.
- [ ] Draw the side-view terrain with layered colored strata using Phaser graphics.
- [ ] Draw five clickable gem-cluster deposits with mineral-specific colors.
- [ ] On deposit click, call `placeMiner`; if successful, draw miner rig and update HUD/checklist.
- [ ] Tick mining on a timed interval using pure `tickMining`.
- [ ] Open intro dialogue from `strings.json` on scene start.
- [ ] Open a mineral fact card the first time each mineral is mined.
- [ ] Trigger mine flood and price spike event cards once at configured thresholds.
- [ ] When the goal basket is complete, show the Field Check quiz.
- [ ] Emit `quiz_answer` analytics with question id and correctness.
- [ ] On correct quiz or completion flow, mark Ch1 complete, save state, unlock Ch2, and move to Ch2 stub.

## Task 6: Verification

**Commands:**

```bash
node_modules/.bin/vitest run
node_modules/.bin/tsc --noEmit && node_modules/.bin/vite build
node_modules/.bin/vite --host 127.0.0.1 --port 5173
```

**Browser checks at `http://127.0.0.1:<port>/?reset#ch1`:**

- [ ] Page boots directly into Chapter 1.
- [ ] HUD shows all resources.
- [ ] Intro dialogue appears and advances.
- [ ] Clicking deposits places miners and spends credits.
- [ ] Four-miner limit is enforced.
- [ ] Resources increase over time.
- [ ] Depleted deposits stop producing.
- [ ] First mining of each mineral opens the correct fact card.
- [ ] Kid/nerd mode changes all visible text.
- [ ] Both event cards appear and apply resource effects.
- [ ] Checklist reaches complete.
- [ ] Quiz appears and logs `quiz_answer`.
- [ ] End screen shows stats and Next button.
- [ ] Next transitions to `#ch2` and Ch2 stub receives persisted state.
- [ ] Capture desktop and mobile screenshots.

## Moderator Review

Run structured review after implementation:

```text
Scope: src/sim/mining.ts, Ch1MineScene, chapter overlay, content JSON, state hydration, styles
[BLOCK] build/test/playthrough blockers
[WARN] pacing, maintainability, persistence, or UI risks
[NIT] minor naming/style issues
[IDEA] defer to later milestones
Verdict: PASS | NEEDS_FIXES | REDESIGN
```

## Retrospective

Emit retrospective before closing:

```text
Worked:
Didn't:
Rule:
```
