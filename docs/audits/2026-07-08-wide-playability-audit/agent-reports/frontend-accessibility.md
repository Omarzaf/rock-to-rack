# Frontend And Accessibility Audit Agent Report

Source-only audit. No edits. No network.

## Findings

### [WARN] Core Gameplay Is Mostly Pointer-Only

Player experience: chapters 1, 2, 3, 5, and 6 depend on clicking canvas zones or holding/tapping on the playfield, while only chapter 4 wires cursor-key movement.

Accessibility risk: keyboard-only players and many assistive-tech users cannot comfortably complete the main loop.

Evidence: `src/scenes/Ch1MineScene.ts:283-284`, `src/scenes/Ch2RefineryScene.ts:239-241`, `src/scenes/Ch3CrystalScene.ts:124-126`, `src/scenes/Ch5PackageScene.ts:477-484`, `src/scenes/Ch6DatacenterScene.ts:655-657`; the partial exception is `src/scenes/Ch4FabScene.ts:151-188`.

Owner: scene input systems.

Fix direction: add keyboard equivalents for select/confirm/advance across all chapters, not just chapter 4, and expose the same actions through explicit focusable controls where possible.

### [WARN] Overlay And Modal Surfaces Are Not Treated Like Real Dialogs

Player experience: Codex, Settings, fact cards, event cards, quiz cards, and completion cards appear as layered panels, but there is no dialog semantics or focus handling in the code, so keyboard focus can drift behind the overlay and screen-reader context is weak.

Accessibility risk: users can lose track of the active surface, and Escape/close behavior is inconsistent or absent.

Evidence: `src/ui/settingsOverlay.ts:17-50`, `src/ui/codexOverlay.ts:8-47`, `src/ui/eventCardOverlay.ts:22-71`, `src/ui/factCard.ts:32-93`, `src/ui/dialogueOverlay.ts:29-90`, `src/ui/chapterOneOverlay.ts:97-160`, `src/ui/chapterOneOverlay.ts:163-229`, `src/ui/chapterSixOverlay.ts:133-223`.

Owner: `src/ui/*Overlay.ts`.

Fix direction: add `role="dialog"` and `aria-modal="true"` where appropriate, autofocus the first actionable control, trap tab within the open overlay, restore focus on close, and wire Escape when it will not conflict with gameplay.

### [WARN] Short-Height Mobile Layouts Shrink Controls Below Comfortable Touch Size

Player experience: on narrow/short devices, especially the `max-height: 520px` breakpoint, chapter 6 buttons drop to 28px tall with 0.58rem text and several labels are hidden; chapter 5 and the HUD get similarly compressed.

Why it hurts broad appeal: these screens are exactly where mobile players need larger hit targets and clearer labels, so the game becomes harder to scan and tap.

Evidence: `src/styles.css:2724-2742`, `src/styles.css:3043-3249`, `src/styles.css:3355-3496`.

Owner: `src/styles.css`.

Fix direction: keep interactive controls at or above 44px, prefer stacked/scrollable sections over further shrinking, and only hide labels when there is a clear redundant affordance next to them.

### [NIT] Centered Modal Cards Can Clip On Shorter Viewports

Player experience: fact cards, event cards, and chapter-complete cards are centered and padded, but long copy or a short landscape viewport can push content below the fold with no obvious recovery.

Evidence: `src/styles.css:949-963`, `src/styles.css:1010-1030`, `src/styles.css:2408-2429`, `src/styles.css:2353-2387`, plus the chapter 6 completion DOM that stacks tablet, stats, epilogue, and journey content in one card at `src/ui/chapterSixOverlay.ts:133-223`.

Owner: `src/styles.css` and the completion overlays.

Fix direction: cap modal height, make the body scrollable, and keep a visible close/continue action near the top.

### [IDEA] Add Layout And Accessibility Smoke Coverage

The current tests cover render/cleanup behavior, but not focus trapping, Escape close, keyboard paths, or short-height mobile states.

Useful coverage targets: `src/ui/loadingScreen.test.ts`, `src/ui/chapterOverlay.test.ts`, `src/ui/debugOverlay.test.ts`, plus a Playwright pass for 520px-high viewport behavior.

## Coverage

- `index.html`
- `public/site.webmanifest`
- `public/favicon.svg`
- `src/styles.css`
- `src/ui/menuOverlay.ts`
- `src/ui/globalPanels.ts`
- `src/ui/loadingScreen.ts`
- `src/ui/pipelineHud.ts`
- `src/ui/settingsOverlay.ts`
- `src/ui/codexOverlay.ts`
- `src/ui/chapterOverlay.ts`
- `src/ui/dialogueOverlay.ts`
- `src/ui/eventCardOverlay.ts`
- `src/ui/factCard.ts`
- `src/ui/debugOverlay.ts`
- `src/ui/chapterJourney.ts`
- `src/ui/chapterOneOverlay.ts`
- `src/ui/chapterTwoOverlay.ts`
- `src/ui/chapterThreeOverlay.ts`
- `src/ui/chapterFourOverlay.ts`
- `src/ui/chapterFiveOverlay.ts`
- `src/ui/chapterSixOverlay.ts`
- `src/ui/feedbackLink.ts`
- `src/ui/collectFx.ts`
- `src/scenes/BootScene.ts`
- `src/scenes/MenuScene.ts`
- `src/scenes/Ch1MineScene.ts`
- `src/scenes/Ch2RefineryScene.ts`
- `src/scenes/Ch3CrystalScene.ts`
- `src/scenes/Ch4FabScene.ts`
- `src/scenes/Ch5PackageScene.ts`
- `src/scenes/Ch6DatacenterScene.ts`
- `src/scenes/SandboxScene.ts`
- `src/scenes/sceneRouting.ts`
- Relevant tests: `src/ui/loadingScreen.test.ts`, `src/ui/chapterOverlay.test.ts`, `src/ui/debugOverlay.test.ts`
