# Agent Fix Handoff - Rock to Rack UI/UX

Date: 2026-07-09  
Purpose: give future agents a concrete, source-backed backlog for fixing UI/UX issues found in the July 9 audits.

This report is a fix handoff, not another broad critique. Each ticket includes likely files, repro, implementation notes, acceptance criteria, and verification.

## Current-State Corrections

Do not spend time on stale items from earlier reports without checking current source first:

- Settings and Codex now have `role="dialog"` and `aria-modal="true"` in `src/ui/settingsOverlay.ts` and `src/ui/codexOverlay.ts`.
- Crisis Run result now has a `Copy result` action in `src/ui/crisisRunOverlay.ts`.
- The remaining global-overlay accessibility issue is focus movement, focus trap, Escape, and focus restore.
- Dialogue, event cards, quiz cards, fact cards, and chapter completion overlays still lack the same dialog/focus treatment.
- Route/hash state can stick during browser testing; always verify the visible scene before accepting a screenshot.

## Fresh Evidence

Fresh screenshots for this pass are in `docs/audits/2026-07-09-agent-fix-handoff/screenshots/`.

| Step | Screenshot | Use |
|---:|---|---|
| 1 | `01-ch2-entry-dialogue.png` | CH2 first-load reference. |
| 2 | `02-ch2-inert-placement.png` | Visible but inactive CH2 module with no explanatory message. |
| 3 | `03-ch5-sort-hidden-thresholds.png` | First-time CH5 fact card interrupts the intended sort transition. |
| 4 | `04-ch6-blocked-contract-feedback.png` | CH6 blocked jobs list requirements but do not say what is missing. |
| 5 | `05-ch5-sort-active-die-hidden-thresholds.png` | Active CH5 die shows score 73, but no threshold key. |
| 6 | `06-settings-focus-semantics.png` | Settings has dialog attributes, but focus stays on the trigger. |
| 7 | `07-codex-locked-focus-semantics.png` | Codex has dialog attributes, but focus stays on the trigger and locked content dominates. |

Rejected trace:

- `rejected-05-ch5-sort-active-die-wrong-state.png` was a stale CH6 route capture and must not be used as CH5 evidence.

## Recommended Agent Split

Run no more than three agents in parallel:

1. `@frontend`: CH6 layout, responsive HUD/playfield, CH5 wafer copy, CH2/CH4 panel hierarchy.
2. `@accessibility`: shared modal focus helper, keyboard-completable campaign controls, live announcer, ARIA state.
3. `@gameplay`: Crisis Run timing/routing, CH5 thresholds/copy, CH2/CH6 blocked-state explanations.

Do shared infrastructure first:

1. Overlay focus helper and tests.
2. CH6 responsive/layout work.
3. Rules/copy feedback fixes.
4. Keyboard completion pass.

## P0 Tickets

### P0-1. Collapse CH6 Finale Dashboard Stack

Owner: `@frontend`

Likely files:

- `src/ui/chapterSixOverlay.ts`
- `src/styles.css`
- `src/scenes/Ch6DatacenterScene.ts`

Repro:

1. Open `/?reset#ch6` at desktop size.
2. Skip dialogue.
3. Compare `docs/audits/2026-07-09-ui-ux-inaccuracy-audit/screenshots/06-ch6-entry-desktop.png` and `10-ch6-entry-mobile.png`.

Problem:

CH6 renders global HUD, status panel, build palette, chip panel, job panel, action panel, city readout, and dialogue at the same time. The finale reads as a dashboard instead of a payoff scene.

Implementation hint:

Make CH6 a staged shell. Keep one primary task panel and one secondary context panel visible at a time. Move chip/job details into a tray, tabs, or contextual panel.

Acceptance criteria:

- No dialogue overlaps active job/action controls.
- Main grid remains visually dominant on desktop and mobile.
- Job/chip panels are not all fully open at once on small screens.
- No clipped essential labels.

Verification:

- `pnpm test`
- `pnpm build`
- Fresh screenshots for `/?reset#ch6` desktop and `390x844`.

### P0-2. Build Shared Overlay Focus Management

Owner: `@accessibility`

Likely files:

- New helper under `src/ui/`
- `src/ui/settingsOverlay.ts`
- `src/ui/codexOverlay.ts`
- `src/ui/eventCardOverlay.ts`
- `src/ui/dialogueOverlay.ts`
- `src/ui/chapterOneOverlay.ts`
- `src/ui/crisisRunOverlay.ts`
- Tests beside overlay tests

Repro:

1. Open Settings or Codex from `/?reset#menu`.
2. Inspect `document.activeElement`.
3. Current evidence shows focus remains on the trigger while the dialog is open: `06-settings-focus-semantics.png`, `07-codex-locked-focus-semantics.png`.
4. Open event/dialogue/quiz overlays and note they still lack shared dialog semantics and focus behavior.

Problem:

Some overlays now expose dialog attributes, but the system does not move focus into the overlay, trap focus, close with Escape, or restore focus to the trigger. Older overlays still behave like visual modals only.

Implementation hint:

Add a shared helper that:

- sets `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`;
- stores the trigger element;
- focuses the first safe control or heading on mount;
- traps Tab/Shift+Tab;
- handles Escape when the overlay is dismissible;
- restores trigger focus on cleanup.

Acceptance criteria:

- Focus cannot reach background controls while an overlay is open.
- Escape closes dismissible overlays.
- Focus returns to the invoking control.
- Settings, Codex, event card, dialogue, quiz, completion, and Crisis Run result use the helper or match its behavior.

Verification:

- `pnpm test`
- `pnpm build`
- Manual keyboard pass: Settings, Codex, event card, dialogue, quiz, Crisis Run result.

### P0-3. Fix CH6 Mobile And Short-Landscape Controls

Owner: `@frontend`

Likely files:

- `src/styles.css`
- `src/ui/chapterSixOverlay.ts`

Repro:

1. Open `/?reset#ch6` at `390x844`.
2. Open `/?reset#ch6` at short landscape, around `860x520`.
3. Compare `11-ch6-playfield-mobile.png` and `12-ch6-short-landscape.png` from the previous UI/UX audit.

Problem:

CH6 currently preserves every panel by shrinking controls. Prior capture measured build/action controls in the 24-34px range.

Implementation hint:

Do not solve mobile by shrinking. Use a mobile mode with staged disclosure, tabs, or a bottom sheet. Keep all actionable controls at least 44px tall.

Acceptance criteria:

- Every actionable CH6 control is at least 44px tall at `390x844` and short landscape.
- Text does not clip.
- Grid remains the primary interaction surface.
- Essential chip/job labels are not hidden without an accessible alternative.

Verification:

- `pnpm test`
- `pnpm build`
- Fresh screenshots at `390x844` and short landscape.

## P1 Tickets

### P1-1. Make Crisis Run Time Wall-Clock Accurate

Owner: `@gameplay`

Likely files:

- `src/scenes/CrisisRunScene.ts`
- `src/ui/crisisRunOverlay.ts`
- `src/sim/crisisRun.ts`
- `src/sim/crisisRun.test.ts`

Repro:

1. Open `/?reset#crisis`.
2. Place Rack, Power, Cooling, and Network quickly.
3. Serve Nova.
4. Current code sets `completedAtSeconds` from simulation ticks at `src/scenes/CrisisRunScene.ts:135`.

Problem:

Elapsed time is based on the simulation tick loop, not monotonic interaction time. Very fast/scripted paths can underreport and may show `0s`.

Implementation hint:

Track `runStartedAtMs` and `runCompletedAtMs` with a monotonic clock separate from `tickDatacenter`. Feed result scoring/display from wall-clock seconds.

Acceptance criteria:

- No valid completed run reports `0s`.
- Result time matches wall-clock session time within a reasonable tolerance.
- Replay starts a new timer baseline.

Verification:

- Unit test a fast completion path.
- `pnpm test`
- `pnpm build`
- Browser replay smoke on `/?reset#crisis`.

### P1-2. Surface CH5 Sort Thresholds And Correct Roster Cap Copy

Owner: `@gameplay`

Likely files:

- `src/ui/chapterFiveOverlay.ts`
- `src/scenes/Ch5PackageScene.ts`
- `src/content/strings.json`
- `src/content/balance.json`
- `src/content/contentCoherence.test.ts`

Repro:

1. Open `/?reset#ch5`.
2. Skip dialogue, dice wafer, dismiss fact card, start sorting.
3. See `05-ch5-sort-active-die-hidden-thresholds.png`: active die shows `Score 73`, but no in-game threshold key.
4. Source has `maxBuildChoices: 6` at `src/content/balance.json`, while copy says "up to four chip friends" in `src/content/strings.json`.

Problem:

The player is asked to choose the right bin without seeing `Perfect >= 88`, `Good >= 58`, otherwise `Salvage`. Roster copy also contradicts the balance value.

Implementation hint:

Render threshold hints near the sort controls or stage panel. Generate roster cap copy from balance data or align static copy to `6`.

Acceptance criteria:

- Sort UI shows exact thresholds.
- Roster copy matches `maxBuildChoices`.
- Content coherence test catches future copy/balance drift.

Verification:

- `pnpm test`
- `pnpm build`
- Fresh CH5 sort screenshot.

### P1-3. Explain Blocked And Disabled Actions In CH2, CH5, And CH6

Owner: `@gameplay`

Likely files:

- `src/sim/refinery.ts`
- `src/scenes/Ch2RefineryScene.ts`
- `src/ui/chapterTwoOverlay.ts`
- `src/scenes/Ch5PackageScene.ts`
- `src/ui/chapterFiveOverlay.ts`
- `src/scenes/Ch6DatacenterScene.ts`
- `src/ui/chapterSixOverlay.ts`
- `src/content/strings.json`

Repro:

- CH2: `02-ch2-inert-placement.png` shows a Crusher placed in a non-leftmost Silicon column. It spends resources and appears, but the lane does not run and no message explains why.
- CH5: locked/unaffordable chips and fact-card interruptions can leave the player unsure why the expected action did not happen.
- CH6: `04-ch6-blocked-contract-feedback.png` shows blocked contracts with broad requirements, but no "missing CPU/NAND/rack/network" explanation.

Problem:

Blocked states are visible but not actionable. The UI often says "Blocked" or nothing.

Implementation hint:

Carry structured failure reasons through sim/scene state and render them on the relevant card/action. For CH2, either reject inert placements with a reason or mark placed modules as inactive/misordered.

Acceptance criteria:

- Every disabled or blocked primary action names the exact missing prerequisite.
- CH2 cannot silently accept a module placement that produces nothing.
- CH6 selected contract shows missing chips/infrastructure directly.

Verification:

- Add unit tests for failure-reason derivation.
- `pnpm test`
- `pnpm build`
- Fresh screenshots for CH2 inert placement and CH6 blocked contract.

### P1-4. Make Campaign Chapters Keyboard-Completable

Owner: `@accessibility`

Likely files:

- `src/scenes/Ch1MineScene.ts`
- `src/scenes/Ch2RefineryScene.ts`
- `src/scenes/Ch3CrystalScene.ts`
- `src/scenes/Ch4FabScene.ts`
- `src/scenes/Ch5PackageScene.ts`
- `src/scenes/Ch6DatacenterScene.ts`
- Related chapter overlays

Repro:

1. Start Learn Mode.
2. Try to complete each chapter without mouse/touch.
3. Canvas hotspots are pointer-driven in the current scenes.

Problem:

Core campaign actions are not reachable by keyboard. Crisis Run has partial keyboard support, but the campaign does not meet the same standard.

Implementation hint:

Define a chapter-level keyboard model: roving selection for canvas targets, keyboard shortcuts for primary actions, and visible focus indicators. Avoid hidden shortcuts unless they are also disclosed.

Acceptance criteria:

- Each chapter can be completed keyboard-only.
- Active target/control has visible focus.
- Shortcuts are documented on-screen.

Verification:

- Manual keyboard-only playthrough.
- Add tests where DOM controls are introduced.
- `pnpm test`
- `pnpm build`

### P1-5. Give Mobile HUD And CH1 First Interaction More Playfield Space

Owner: `@frontend`

Likely files:

- `src/ui/pipelineHud.ts`
- `src/styles.css`
- `src/scenes/Ch1MineScene.ts`
- `src/ui/chapterOneOverlay.ts`

Repro:

1. Open `/?reset#ch1` at `390x844`.
2. Compare previous screenshots `08-ch1-entry-mobile.png` and `09-ch1-first-interaction-mobile.png`.

Problem:

The HUD and dialogue consume most of the vertical space before play starts. After selecting a deposit, the action panel is spatially detached from the clicked target.

Implementation hint:

Compress HUD into current-stage essentials plus an expandable inventory. Anchor selected deposit feedback closer to the selected object or use a clear callout/connector.

Acceptance criteria:

- Mobile canvas/playfield gains visible height.
- First actionable state is clear after dialogue.
- Selected deposit feedback reads as attached to the clicked target.

Verification:

- `pnpm test`
- `pnpm build`
- Fresh CH1 mobile screenshot at `390x844`.

## P2 Tickets

### P2-1. Move CH5 Dice Helper Text Off The Wafer

Owner: `@frontend`

Likely files:

- `src/scenes/Ch5PackageScene.ts`
- `src/ui/chapterFiveOverlay.ts`
- `src/styles.css`

Repro:

Open `/?reset#ch5` on the dice stage. Previous evidence: `docs/audits/2026-07-09-ui-ux-inaccuracy-audit/screenshots/13-ch5-dice-desktop.png`.

Problem:

Instructional canvas text overlaps the bright wafer art, reducing readability and competing with the focal object.

Implementation hint:

Move helper copy to the DOM panel or a dark callout outside the wafer. Keep the wafer visually clean.

Acceptance criteria:

- Wafer is unobscured.
- Instruction copy is readable.
- Main action remains visually clear.

Verification:

- `pnpm test`
- `pnpm build`
- Fresh CH5 dice screenshot.

### P2-2. Add Dedicated Live Announcer For Game Feedback

Owner: `@accessibility`

Likely files:

- `index.html`
- `src/main.ts`
- New `src/ui/announcer.ts`
- Scene files that emit invalid-action/stage/completion feedback

Repro:

Trigger invalid placement, blocked action, event choice, and chapter completion.

Problem:

`#ui-root` is broadly `aria-live="polite"`, while scene state updates replace large DOM chunks. Screen-reader users can miss critical feedback or hear noisy repeated updates.

Implementation hint:

Use dedicated polite/status and assertive/alert channels. Emit short messages for invalid actions, stage changes, and completion. Debounce repeated identical messages.

Acceptance criteria:

- Blocked actions are announced once.
- Stage transitions and completions are announced.
- Live updates do not steal focus or spam repeated resource changes.

Verification:

- Manual VoiceOver/NVDA pass.
- `pnpm test`
- `pnpm build`

### P2-3. Reflect Selected State In ARIA

Owner: `@accessibility`

Likely files:

- `src/ui/chapterTwoOverlay.ts`
- `src/ui/chapterFiveOverlay.ts`
- `src/ui/chapterSixOverlay.ts`
- `src/ui/crisisRunOverlay.ts`
- `src/ui/settingsOverlay.ts`

Repro:

Inspect selected module/build/chip/contract controls. Current captured DOM shows visual classes such as `active` and `is-selected`, but no `aria-pressed` or `aria-selected` in several chapter controls.

Problem:

Assistive tech hears generic buttons without selected state.

Implementation hint:

Use `aria-pressed` for toggle-like buttons, `aria-selected` with listbox/tab patterns when appropriate, or `aria-current` for the current stage.

Acceptance criteria:

- Selected module/build/chip/contract state is announced.
- Disabled/unavailable options remain semantically disabled.
- Reading order matches visual state.

Verification:

- Accessibility tree inspection.
- Manual screen-reader pass.
- `pnpm test`
- `pnpm build`

### P2-4. Stabilize Route/Replay Reset Semantics

Owner: `@gameplay` or `@devops`

Likely files:

- `src/scenes/BootScene.ts`
- `src/scenes/sceneRouting.ts`
- `src/scenes/CrisisRunScene.ts`
- `src/scenes/MenuScene.ts`
- `src/state/gameStore.ts`

Repro:

1. Finish Crisis Run.
2. Replay, then navigate via hash-only route changes during browser testing.
3. This audit had to reject stale-route screenshots where a visible scene did not match the target URL.

Problem:

The app mixes hash mutation, `scene.restart()`, `scene.start()`, fixture loading, and saved-state loading. This can preserve stale scene state around reset/replay paths and makes QA automation error-prone.

Implementation hint:

Centralize navigation/reset helpers. Distinguish saved campaign resume, route fixture preview, and forced reset with a single source of truth.

Acceptance criteria:

- `?reset#scene` always enters the requested scene fresh.
- Replay always starts a clean Crisis Run.
- Hash-only navigation cannot leave visible state mismatched to route.

Verification:

- Add route/replay smoke test.
- `pnpm test`
- `pnpm build`
- Browser smoke over `#menu`, `#crisis`, `#ch5`, `#ch6`.

### P2-5. Improve CH2 And CH4 Panel Hierarchy

Owner: `@frontend`

Likely files:

- `src/ui/chapterTwoOverlay.ts`
- `src/ui/chapterFourOverlay.ts`
- `src/styles.css`
- Related chapter scenes if panel state changes are needed

Repro:

Open `/?reset#ch2` and `/?reset#ch4` on desktop, mobile, and short landscape. Compare wide-playability baselines in `docs/audits/2026-07-08-wide-playability-audit/screenshots/`.

Problem:

CH2 and CH4 present several panels at equal prominence, pushing toward dashboard layout instead of a focused chapter task.

Implementation hint:

Promote the active step, demote secondary stats, and stage details on narrow screens.

Acceptance criteria:

- Active task is visually dominant.
- Secondary panels do not crowd the playfield.
- Button labels stay clear on narrow widths.

Verification:

- `pnpm test`
- `pnpm build`
- Fresh CH2/CH4 desktop and short-landscape screenshots.

## Suggested Verification Suite

Run after each isolated fix:

```bash
pnpm test
pnpm build
```

For visual/layout fixes, also run a browser screenshot pass at minimum:

- `/?reset#menu` desktop and `390x844`
- `/?reset#ch1` `390x844`
- `/?reset#ch2` desktop and `390x844`
- `/?reset#ch5` dice and sort states
- `/?reset#ch6` desktop, `390x844`, and short landscape
- `/?reset#crisis` entry, ready, and result

For accessibility fixes, run a manual pass:

- Tab through Menu, Settings, Codex.
- Open/close each overlay with keyboard.
- Confirm Escape and focus restore.
- Complete at least one chapter verb keyboard-only.
- Screen-reader check for selected state and live feedback.

## Reports This Handoff Consolidates

- `docs/audits/2026-07-09-ui-ux-inaccuracy-audit/report.md`
- `docs/audits/2026-07-09-product-design-audit/report.md`
- `docs/audits/2026-07-08-wide-playability-audit/report.md`

