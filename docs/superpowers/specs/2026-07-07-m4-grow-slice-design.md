# M4 Grow & Slice Design

## Goal

Replace the Chapter 3 stub with a playable `#ch3` scene where the player grows a silicon ingot with a temperature-control timing minigame, slices that ingot into wafers, answers the Chapter 3 Field Check, and persists wafer count and quality into Chapter 4.

## Scope

M4 covers Chapter 3 only. It should not build the Chapter 4 fab, Codex, analytics network layer, or full run balancing. It should extend shared state only enough for Chapter 4 to know that wafers exist and what their quality is.

## Approach Options

### Recommended: Two-Stage Timing Scene

Stage A is a hold/release timing minigame. Holding pulls the seed upward and changes temperature drift; releasing lets the temperature settle. Time spent in the green zone increases ingot length and quality. Stage B turns the resulting ingot profile into visible slice guides. The player clicks/taps near guide lines; accurate slices produce wafers, and flawed sections are discarded.

This is the best fit because it is implementable with the current Phaser + DOM overlay architecture, teaches the core concept directly, and can be tested through pure simulation functions.

### Alternative: Drag-Based Crystal Shaping

The player drags the seed along a path while temperature changes underneath. This could feel more tactile, but it is harder to make mouse and touch equally fair and harder to unit-test.

### Alternative: Fully Automated Grow With Slicing Only

The ingot grows automatically, and the player only slices. This is safer but too passive for the chapter goal; it would fail the requirement that quality visibly reflects player skill.

## Final Design

Use the recommended two-stage timing scene.

The scene starts with a short Sam/Dr. Vega dialogue. The center canvas shows a crucible, glowing molten silicon, a seed crystal, and a vertical ingot that grows upward. A compact DOM overlay shows stage, temperature score, quality, pull progress, wafer target, retry count, and a primary action button. The HUD remains at the top.

Stage A rules live in `src/sim/crystal.ts`. Each tick consumes a small amount of energy and water, updates temperature based on whether the player is pulling, records how close temperature is to the green zone, and increases ingot height only while pulling. Quality is computed from time-in-zone and stability. The player gets one free retry before slicing.

Stage B rules also live in `src/sim/crystal.ts`. The sim generates an ingot profile from Stage A quality: high-quality pulls have wider, smoother segments; low-quality pulls produce narrower flawed sections. Slice scoring compares click/tap position against guide lines. Accurate slices produce wafers with the chapter quality score; slices through flawed sections are discarded. Output persists as `resources.wafers` and `chapters.ch3.waferQuality`.

Fact cards:

- Czochralski method and the 1915 accident origin story.
- Why wafers are round.
- Diamond wire saws and slicing waste.

Event card:

- Truck vibration: choose to pause and re-center at a time cost, or keep pulling with a stability penalty.

Field Check:

- "Why are wafers round?" Correct answer: because they are sliced from a round crystal ingot.

## State Model

Add `ChapterThreeProgress`:

```ts
export interface ChapterThreeProgress {
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
  ingotQuality: number;
  waferQuality: number;
  wafersProduced: number;
  retryUsed: boolean;
  firstFacts: string[];
}
```

`GameState.resources.wafers` remains the global wafer count. Chapter 3 stores quality metadata for Chapter 4.

## Files

Create:

- `src/sim/crystal.ts`
- `src/sim/crystal.test.ts`
- `src/ui/chapterThreeOverlay.ts`

Modify:

- `src/scenes/Ch3CrystalScene.ts`
- `src/state/types.ts`
- `src/state/gameState.ts`
- `src/state/gameState.test.ts`
- `src/fixtures/chapterFixtures.ts`
- `src/content/balance.json`
- `src/content/events.json`
- `src/content/quiz.json`
- `src/content/strings.json`
- `src/content/SOURCES.md`
- `src/styles.css`
- `docs/agent-context.md`

## Verification

Run:

```bash
node_modules/.bin/vitest run src/sim/crystal.test.ts
node_modules/.bin/vitest run src/state/gameState.test.ts
node_modules/.bin/vitest run
node_modules/.bin/tsc --noEmit
node_modules/.bin/vite build
```

Browser smoke:

- Open `http://127.0.0.1:5174/?reset#ch3`.
- Dismiss intro.
- Play pull stage with mouse.
- Trigger or handle vibration event.
- Retry once and verify retry cannot be used twice.
- Complete slicing with clicks.
- Answer the Field Check.
- Verify completion transitions to `#ch4`.
- Verify `resources.wafers > 0`, `chapters.ch3.completed = true`, `chapters.ch3.waferQuality > 0`, and `unlockedChapters` includes `4`.
- Capture desktop and mobile screenshots.

## Self-Review

- No placeholder scope remains; the chapter is bounded to Ch3.
- The design preserves the current pure-sim plus Phaser-scene plus DOM-overlay pattern.
- The design covers mouse and touch by using pointer down/up for pulling and pointer clicks/taps for slicing.
- The design does not alter Chapter 1 or Chapter 2 mechanics.
- The workspace is not a git repo, so the normal "commit spec" step cannot be completed here.
