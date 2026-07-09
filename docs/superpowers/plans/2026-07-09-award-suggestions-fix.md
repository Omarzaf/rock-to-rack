# Award Suggestions Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the pasted award-impact suggestions into verified code, content, accessibility, replay, trust, and ship-hygiene fixes in the current Rock to Rack checkout.

**Architecture:** Keep the game-first menu as the front door, because Crisis Run is already the primary CTA. Fix remaining gaps in bounded slices: gameplay feedback/trust, CH6 payoff/layout, modal/keyboard accessibility, replay/simulator, and release hygiene. Treat external playtests, browser downloads, and live fact checks as explicit human checkpoints before network or human-outreach steps.

**Tech Stack:** Phaser 3.90, TypeScript, Vite 6, Vitest, Playwright smoke scripts, DOM overlays, localStorage-backed game state.

---

## Intake

TYPE: NEW_FEATURE | BUG_FIX | REFACTOR | DEVOPS
COMPLEXITY: COMPLEX
SCOPE: `src/scenes`, `src/ui`, `src/sim`, `src/state`, `src/content`, `src/audio`, `src/ship`, `tools`, `docs`
RISK: MEDIUM, with HIGH checkpoints for outbound browser installs, live web fact checking, and any production deployment.

## Current Baseline

- `corepack pnpm test` passes: 34 files, 187 tests.
- `corepack pnpm build` passes.
- Current bundle warning: `dist/assets/index-D0o0WoJz.js` is 1,800.62 kB minified and 428.78 kB gzip.
- This directory is not a git repo yet: `git status --short --branch` returns `fatal: not a git repository`.
- Already mostly fixed: Crisis Run is the first menu CTA; dialogue skip exists; local Crisis Run history/replay exists; Settings/Codex/Crisis result use modal focus; CH5 roster copy currently matches `maxBuildChoices: 4`.

## Human Checkpoints

- Before Task 8 live fact pass: approve outbound web/source verification.
- Before Task 11 cross-browser install: approve `corepack pnpm exec playwright install firefox webkit`.
- Before any production deploy: explicit separate approval.
- External playtesters are not autonomous agent work. This plan can create scripts/forms/checklists, but no email, DM, form submission, or recruitment happens without Umar.

## Subagent Split

- `@gameplay`: Tasks 2, 3, 4, 5, 6, 8.
- `@frontend`: Tasks 7, 9, 10.
- `@accessibility-devops`: Tasks 1, 11, 12, 13.

No more than three parallel agents. Workers must use disjoint write scopes and must not revert changes from other workers.

---

### Task 1: Initialize Version Control And Ignore Generated Weight

**Files:**
- Create: `.git/` via `git init`
- Modify/Create: `.gitignore`
- Modify/Create: `.codexignore`

- [ ] **Step 1: Initialize the repo**

Run:

```bash
git init
```

Expected: repository initialized in `/Users/omar/Downloads/Game`.

- [ ] **Step 2: Add generated-directory ignores**

Ensure `.gitignore` and `.codexignore` contain:

```gitignore
node_modules/
dist/
.playwright-mcp/
.vercel/
```

- [ ] **Step 3: Verify repo state**

Run:

```bash
git status --short --branch
```

Expected: branch is visible; generated build and dependency folders are ignored.

---

### Task 2: Fix Rule-Feedback Honesty

**Files:**
- Modify: `src/sim/refinery.ts`
- Modify: `src/sim/refinery.test.ts`
- Modify: `src/scenes/Ch2RefineryScene.ts`
- Modify: `src/sim/datacenter.ts`
- Modify: `src/sim/datacenter.test.ts`
- Modify: `src/ui/chapterSixOverlay.ts`
- Modify: `src/ui/chapterSixOverlay.test.ts`
- Modify: `src/ui/chapterFiveOverlay.ts`
- Modify: `src/ui/chapterOverlay.test.ts`
- Modify: `src/content/strings.json`

- [ ] **Step 1: Write failing CH2 inert-placement test**

Add a refinery test showing a module placed out of required left-to-right sequence is rejected or explicitly reasoned:

```ts
it('rejects modules that would be inert because they skip the active chain', () => {
  const chapter = createInitialRefineryChapter(balance);
  const result = placeRefineryModule(chapter, resources, {
    laneId: 'silicon',
    column: 2,
    moduleType: 'crusher'
  }, balance);

  expect(result.ok).toBe(false);
  expect(result.reason).toBe('inactive sequence');
});
```

- [ ] **Step 2: Implement structured CH2 reason**

Extend the placement result reason union in `src/sim/refinery.ts` with `inactive sequence`, reject placements where `column` is beyond the first missing required-module column, and render a clear `strings.json` message such as:

```json
"inactiveSequence": {
  "kid": "Start at the left. This machine will not run until the earlier spot is filled.",
  "nerd": "Refinery modules only activate as a connected left-to-right process chain."
}
```

- [ ] **Step 3: Write failing CH6 missing-requirements test**

Add a datacenter test for exact reasons:

```ts
expect(canServeContract(noChip, cartoonStream, balance).reasons).toContain('missing chip: cpu');
expect(canServeContract(noNetwork, cartoonStream, balance).reasons).toContain('insufficient network');
```

- [ ] **Step 4: Render exact CH6 blocked reasons**

In `chapterSixOverlay.ts`, make `contractCard()` render a short missing-requirement line:

```ts
const reasonLine = contractBlockReason(options, contract);
card.append(elementWithText('span', 'ch6-contract-reason', reasonLine));
```

Use `canServeContract()` output instead of only generic `Blocked`.

- [ ] **Step 5: Show CH5 sort thresholds**

Render the threshold key during sort stage:

```ts
Perfect >= 88 · Good >= 58 · Salvage below 58
```

Read thresholds from `options.balance.binThresholds`, not hardcoded constants.

- [ ] **Step 6: Verify**

Run:

```bash
corepack pnpm test src/sim/refinery.test.ts src/sim/datacenter.test.ts src/ui/chapterOverlay.test.ts
corepack pnpm test
```

Expected: targeted tests and full test suite pass.

---

### Task 3: Make Crisis Run Timing Wall-Clock Accurate

**Files:**
- Modify: `src/scenes/CrisisRunScene.ts`
- Modify: `src/sim/crisisRun.ts`
- Modify: `src/sim/crisisRun.test.ts`
- Modify: `src/ui/crisisRunOverlay.ts`
- Modify: `src/ui/crisisRunOverlay.test.ts`

- [ ] **Step 1: Add elapsed-time helper test**

Add a pure helper:

```ts
expect(elapsedWallClockSeconds(1_000, 1_100)).toBe(1);
expect(elapsedWallClockSeconds(1_000, 8_250)).toBe(8);
```

The first assertion locks the "no valid 0s run" rule.

- [ ] **Step 2: Track run start and completion**

In `CrisisRunScene`, add `runStartedAtMs` and set it from `performance.now()` in `create()`. In `completeIfReady()`, set elapsed from `performance.now()` rather than `chapter.elapsedSeconds`.

- [ ] **Step 3: Reset timer on replay**

Ensure replay path re-enters `create()` and clears previous result modal before `scene.restart()`.

- [ ] **Step 4: Verify**

Run:

```bash
corepack pnpm test src/sim/crisisRun.test.ts src/ui/crisisRunOverlay.test.ts
corepack pnpm smoke:m12
```

Expected: no completed result can display `0s`; replay starts a new baseline.

---

### Task 4: Make Replay Loop Seeded And Campaign-Aware

**Files:**
- Modify: `src/state/types.ts`
- Modify: `src/state/gameState.ts`
- Modify: `src/state/gameState.test.ts`
- Modify: `src/state/gameStore.ts`
- Modify: `src/sim/crisisRun.ts`
- Modify: `src/sim/crisisRun.test.ts`
- Modify: `src/scenes/CrisisRunScene.ts`
- Modify: `src/ui/menuOverlay.ts`
- Modify: `src/ui/menuOverlay.test.ts`

- [ ] **Step 1: Add daily seed state and tests**

Add a stable `crisisChallenge` metadata shape:

```ts
interface CrisisChallengeState {
  dailySeed: string;
  campaignChipIds: ChipTypeId[];
}
```

Test that the same date produces the same seed and a different date produces a different seed.

- [ ] **Step 2: Feed campaign chips into challenge constraints**

When CH5 has selected chips, pass those chips into Crisis Run as the available inventory variant. If no campaign exists, use the current quick-play default inventory.

- [ ] **Step 3: Surface challenge mode on menu**

Add menu copy indicating whether Crisis Run is "Daily seed" and whether it is using "your campaign chip lineup".

- [ ] **Step 4: Verify**

Run:

```bash
corepack pnpm test src/state/gameState.test.ts src/sim/crisisRun.test.ts src/ui/menuOverlay.test.ts
corepack pnpm smoke:m12
```

Expected: daily replay is deterministic; campaign outcome changes Crisis Run inventory without breaking quick play.

---

### Task 5: Rewrite Playthrough Simulator Honestly

**Files:**
- Modify: `src/sim/playthroughSimulator.ts`
- Modify: `src/sim/playthroughSimulator.test.ts`
- Modify: `docs/superpowers/reports/2026-07-08-m9-simulation-report.md` or create a new dated report

- [ ] **Step 1: Add failing no-padding test**

Assert that `simulatePackageMechanics()` does not inflate bins beyond sorted output:

```ts
expect(report).not.toContain('padded');
expect(result.chapters.find((chapter) => chapter.chapter === 5)?.completed).toBe(true);
```

- [ ] **Step 2: Remove artificial CH5 bin inflation**

Delete the block that forces:

```ts
perfect: Math.max(chapter.bins.perfect, 12)
good: Math.max(chapter.bins.good, 24)
salvage: Math.max(chapter.bins.salvage, 12)
perfect7nmDies: Math.max(chapter.perfect7nmDies, 2)
```

Tune fixture yields or bot choices instead, so the simulator catches real balance failures.

- [ ] **Step 3: Verify and write fresh report**

Run:

```bash
corepack pnpm simulate
```

Expected: all profiles complete or fail honestly; if a profile fails, tune balance rather than padding bins.

---

### Task 6: Add One Real Tradeoff Per Chapter

**Files:**
- Modify: `src/content/balance.json`
- Modify: `src/content/strings.json`
- Modify: `src/scenes/Ch2RefineryScene.ts`
- Modify: `src/scenes/Ch4FabScene.ts`
- Modify: `src/scenes/Ch5PackageScene.ts`
- Modify: `src/scenes/Ch6DatacenterScene.ts`
- Modify: relevant `src/sim/*.test.ts`

- [ ] **Step 1: CH2 speed vs purity**

Add a fast-but-wasteful refinery route and a slower high-purity route. Verify both can complete:

```bash
corepack pnpm test src/sim/refinery.test.ts
```

- [ ] **Step 2: CH4 yield vs heat**

Tune station scoring so aggressive fab choices produce faster output but higher defect risk. Verify yield math stays deterministic:

```bash
corepack pnpm test src/sim/fab.test.ts
```

- [ ] **Step 3: CH5 cheap vs reliable**

Make chip roster choice visibly trade bin cost against CH6 reliability. Verify `buildChip()` still enforces costs and max choices.

- [ ] **Step 4: CH6 power vs compute**

Make rack/chip combinations visibly force power/cooling decisions before Nova. Verify `canServeContract()` reason strings expose the tradeoff.

- [ ] **Step 5: Verify**

Run:

```bash
corepack pnpm test
corepack pnpm simulate
```

Expected: at least two viable builds exist in each changed chapter; simulator remains honest.

---

### Task 7: Collapse CH6 Finale Around Nova Payoff

**Files:**
- Modify: `src/ui/chapterSixOverlay.ts`
- Modify: `src/ui/chapterSixOverlay.test.ts`
- Modify: `src/scenes/Ch6DatacenterScene.ts`
- Modify: `src/styles.css`
- Modify: `src/content/strings.json`

- [ ] **Step 1: Add overlay mode**

Introduce `activePanel: 'build' | 'chips' | 'contracts' | 'nova' | 'complete'` in overlay options. Render only the primary task and one context rail at a time.

- [ ] **Step 2: Add tabs or bottom sheet for secondary panels**

On mobile and short landscape, move chips/contracts into a tab strip or bottom sheet. Buttons must be at least 44px tall.

- [ ] **Step 3: Make victory visually change the city**

In `Ch6DatacenterScene`, tie city light rendering to `cityLights`, and make hospital Nova completion cascade the skyline to a clear 100% lit state.

- [ ] **Step 4: Move dense stats to completion**

Keep live overlay focused on Nova objective; move detailed chip/job stats into the completion modal.

- [ ] **Step 5: Verify**

Run:

```bash
corepack pnpm test src/ui/chapterSixOverlay.test.ts src/sim/datacenter.test.ts
corepack pnpm build
```

Manual screenshot targets: `/?reset#ch6` desktop, `390x844`, and `860x520`.

---

### Task 8: Fact-Accuracy And Source-Trust Pass

**Files:**
- Modify: `src/content/strings.json`
- Modify: `src/content/codex.json`
- Modify: `src/content/SOURCES.md`
- Modify: `src/content/contentCoherence.test.ts`
- Modify: `src/content/guide.ts`

- [ ] **Step 1: Human approval for live fact check**

Ask before outbound web/source verification. Use official or primary sources where possible.

- [ ] **Step 2: Soften brittle claims**

Replace brittle wording with source-stamped approximations:

```json
"kid": "Real chip silicon is purified to extreme levels, often described as nine nines for teaching.",
"nerd": "Gameplay uses 9N as a simplified target; actual purity and process targets vary by material and manufacturing step."
```

- [ ] **Step 3: Add source labels**

For claims like `over 1,000 steps`, `3 months`, `99.9999999% purity`, add SOURCES entries or convert to approximation language.

- [ ] **Step 4: Add coherence tests**

Add tests that fail on unsourced hard claims:

```ts
expect(JSON.stringify(stringsJson)).not.toMatch(/over 1,000 tiny steps/);
```

- [ ] **Step 5: Verify**

Run:

```bash
corepack pnpm test src/content/contentCoherence.test.ts src/content/guide.test.ts
```

Expected: public copy distinguishes facts from gameplay abstractions.

---

### Task 9: Finish Modal, Keyboard, And ARIA Accessibility

**Files:**
- Modify: `src/ui/modalFocus.ts`
- Modify: `src/ui/eventCardOverlay.ts`
- Modify: `src/ui/dialogueOverlay.ts`
- Modify: `src/ui/factCard.ts`
- Modify: `src/ui/chapterOneOverlay.ts`
- Modify: `src/ui/chapterTwoOverlay.ts`
- Modify: `src/ui/chapterThreeOverlay.ts`
- Modify: `src/ui/chapterFourOverlay.ts`
- Modify: `src/ui/chapterFiveOverlay.ts`
- Modify: `src/ui/chapterSixOverlay.ts`
- Create: `src/ui/announcer.ts`
- Modify: `index.html`
- Modify: `src/scenes/Ch1MineScene.ts`, `Ch2RefineryScene.ts`, `Ch3CrystalScene.ts`, `Ch5PackageScene.ts`, `Ch6DatacenterScene.ts`

- [ ] **Step 1: Apply modal helper to all modal overlays**

Every dialogue, event, fact, quiz, and completion overlay gets `role="dialog"`, `aria-modal="true"`, initial focus, Escape behavior where dismissible, and focus restore.

- [ ] **Step 2: Add dedicated live announcer**

Create polite and assertive live regions. Emit short messages for invalid placements, blocked actions, stage transitions, and completion.

- [ ] **Step 3: Add keyboard-completable chapter path**

For each pointer-only scene, add a roving selection or DOM-equivalent control path. Visible focus and disclosed shortcuts are required.

- [ ] **Step 4: Add selected-state ARIA**

Use `aria-pressed`, `aria-selected`, or `aria-current` for selected build/chip/contract/module controls.

- [ ] **Step 5: Verify**

Run:

```bash
corepack pnpm test src/ui/dialogueOverlay.test.ts src/ui/factCard.test.ts src/ui/chapterOverlay.test.ts
corepack pnpm test
```

Manual keyboard pass: menu, Settings, Codex, event card, dialogue, fact card, quiz, Crisis Run result, and one core verb in every chapter.

---

### Task 10: Fix Mobile And Visual Polish Gaps

**Files:**
- Modify: `src/styles.css`
- Modify: `src/ui/pipelineHud.ts`
- Modify: `src/scenes/Ch1MineScene.ts`
- Modify: `src/scenes/Ch5PackageScene.ts`
- Modify: `src/ui/chapterFiveOverlay.ts`
- Modify: `src/ui/menuOverlay.ts`
- Modify: `src/content/strings.json`

- [ ] **Step 1: Compress mobile HUD**

On narrow screens, show current-stage essentials and move full inventory to an expandable tray. Preserve a larger playfield on `390x844`.

- [ ] **Step 2: Move CH5 wafer helper copy off canvas wafer**

Delete canvas hint text over the wafer in `drawWaferStage()` and render the instruction in the DOM stage panel.

- [ ] **Step 3: Fix mobile menu connector**

Replace inline connector dashes with CSS separators that do not dangle at row breaks.

- [ ] **Step 4: Verify screenshots**

Manual screenshot targets: `/?reset#menu` mobile, `/?reset#ch1` mobile, `/?reset#ch5` dice and sort, `/?reset#ch6` mobile and short landscape.

---

### Task 11: Audio And Sensory Identity

**Files:**
- Modify: `src/audio/soundDesign.ts`
- Modify: `src/audio/soundDesign.test.ts`
- Create: `src/assets/audio/` or `public/audio/` if real assets are approved/generated
- Modify: scenes that call `playUiCue`

- [ ] **Step 1: Decide asset strategy**

Use either generated local audio files or WebAudio cues. If creating binary audio assets, keep them small and document provenance.

- [ ] **Step 2: Add transformation-chain cues**

Add distinct cues for ore, wafer, chip, rack, and Nova victory. Respect mute and reduced-motion-style user preference expectations.

- [ ] **Step 3: Add tests**

Test muted behavior, unmuted cue selection, and missing-audio fallback.

- [ ] **Step 4: Verify**

Run:

```bash
corepack pnpm test src/audio/soundDesign.test.ts
corepack pnpm test
```

Manual browser pass: mute toggle off/on, chapter transformation cues, Nova victory cue.

---

### Task 12: Ship Hygiene, Code Splitting, And Browser Matrix

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/game/createGame.ts`
- Modify: `src/scenes/index.ts` or create lazy scene loader module
- Modify: `tools/m10-browser-smoke.mjs`
- Modify: `tools/m11-browser-smoke.mjs`
- Modify: `tools/m12-replay-smoke.mjs`
- Modify: `README.md`

- [ ] **Step 1: Split vendor and app chunks**

Configure Vite/Rollup chunking so Phaser and app code are not emitted as one large chunk. Prefer a conservative `manualChunks` first.

- [ ] **Step 2: Verify bundle output**

Run:

```bash
corepack pnpm build
```

Expected: no single app-owned JS chunk near 1.8 MB. If Phaser vendor remains large, document that separately from app code.

- [ ] **Step 3: Human approval for Firefox/WebKit install**

Ask before running:

```bash
corepack pnpm exec playwright install firefox webkit
```

- [ ] **Step 4: Add iPad smoke path**

Extend smoke scripts to include an iPad-sized/touch viewport path and report browser availability honestly.

- [ ] **Step 5: Verify**

Run:

```bash
corepack pnpm smoke:m10
corepack pnpm smoke:m11
corepack pnpm smoke:m12
corepack pnpm perf:m10
```

Expected: Chromium passes; Firefox/WebKit pass only if binaries are installed.

---

### Task 13: Game-First Landing Surface And Playtest Handoff

**Files:**
- Modify: `src/ui/menuOverlay.ts`
- Modify: `src/ship/siteMetadata.ts`
- Modify: `README.md`
- Create: `docs/playtests/2026-07-09-cold-playtest-script.md`

- [ ] **Step 1: Convert menu into the landing surface**

Keep the usable game as the first screen. Add pitch line, primary Play/Crisis action, credits, and an accuracy note without creating a separate marketing interstitial.

- [ ] **Step 2: Add playtest script**

Create a human-run cold-playtest script with tasks:

```md
1. Start from the live URL.
2. Choose the path you would naturally choose.
3. Complete the first playable objective.
4. Say what you think Nova is and what blocked you.
5. Rate confusion from 1-5.
```

- [ ] **Step 3: Verify public-surface copy**

Run:

```bash
corepack pnpm test src/ship/siteMetadata.test.ts src/ui/menuOverlay.test.ts
corepack pnpm build
```

Expected: landing surface stays game-first and source/accuracy note is visible without blocking play.

---

## Final Verification Gate

Run:

```bash
corepack pnpm test
corepack pnpm simulate
corepack pnpm verify:static
corepack pnpm build
corepack pnpm smoke:m10
corepack pnpm smoke:m11
corepack pnpm smoke:m12
corepack pnpm perf:m10
```

Then capture screenshots for:

- `/?reset#menu` desktop and `390x844`
- `/?reset#ch1` `390x844`
- `/?reset#ch2` desktop and `390x844`
- `/?reset#ch5` dice and sort states
- `/?reset#ch6` desktop, `390x844`, and `860x520`
- `/?reset#crisis` entry, ready, and result

## Moderator Review Template

Use after any change set over 50 lines:

```text
╔══════════════════════════════════════╗
║         MODERATOR REVIEW             ║
╠══════════════════════════════════════╣
║ Scope: <files/modules reviewed>      ║
╠══════════════════════════════════════╣
║ [BLOCK] <critical issue>             ║
║ [WARN]  <important issue>            ║
║ [NIT]   <minor issue>                ║
║ [IDEA]  <optional enhancement>       ║
╠══════════════════════════════════════╣
║ Verdict: PASS | NEEDS_FIXES | REDESIGN
╚══════════════════════════════════════╝
```

## Retrospective Closeout

After implementation and verification, emit:

```text
╔══════════════════════════════════╗
║         RETROSPECTIVE            ║
╠══════════════════════════════════╣
║ ✓ Worked:    <one line>          ║
║ ✗ Didn't:    <one line>          ║
║ → Rule:      <concrete proposal> ║
╚══════════════════════════════════╝
```
