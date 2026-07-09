# Polish Loops - Rock to Rack

Date: 2026-07-09
Preview checked: `http://127.0.0.1:5173/`
Source audit: `docs/audits/2026-07-09-product-design-audit/report.md`

## Fixed In Loop 1

1. Menu choice clarity
   - Added short descriptions for `Crisis Run` and `Learn Mode`.
   - Raised menu utility controls from 40px to 44px.
   - Evidence: `screenshots/01-menu-desktop.png`, `screenshots/05-menu-mobile.png`.

2. Codex first-run locked wall
   - Added a first-run primer above the locked Codex grid.
   - Added dialog labelling attributes to the Codex panel.
   - Evidence: `screenshots/02-codex-desktop.png`.

3. Crisis Run placement affordance
   - Added selected-build guidance for rack, power, cooling, network, and battery.
   - Replaced generic placement failure text with reason-specific messages for occupied, insufficient resources, and out-of-bounds failures.
   - Evidence: `screenshots/03-crisis-entry-desktop.png`, `screenshots/06-crisis-entry-mobile.png`.

4. Result sharing affordance
   - Added `Copy result` to the result modal.
   - Added success/failure status text and a local fallback path when the Clipboard API is unavailable.
   - Evidence: `screenshots/04-crisis-result-desktop.png`.

5. Crisis Run backend/state robustness
   - Added monotonic `totalCrisisRuns` so run numbering does not freeze after capped history.
   - Reconciled stale saved best-run data against retained history during hydration.
   - Preserved crisis-run analytics fields: score, grade, elapsed seconds, city lights, served contracts.

6. Test coverage
   - Added dedicated tests for menu, settings, and Codex overlays.
   - Extended Crisis Run overlay, analytics, and game-state tests.

## Fixed In Loop 2

1. Modal keyboard behavior
   - Added a reusable modal focus controller.
   - Settings and Codex now move focus into the dialog, close on Escape, and restore focus to the opener.
   - Crisis Run result modal now starts focus on `Copy result`.
   - Evidence: `screenshots/08-codex-desktop-loop2.png`, live DOM checks.

2. Mobile Crisis Run board prominence
   - Added a portrait-mobile Crisis Run grid layout without changing the global Phaser scale mode.
   - Increased the mobile rack-floor cell size and moved the action row below the enlarged board.
   - Evidence: `screenshots/10-crisis-entry-mobile-loop2.png`.

3. Result completion and copy path
   - Verified mobile canvas placement through the full rack, power, cooling, and network flow.
   - Verified result modal content, run number, `Copy result` focus, and `Copied result.` feedback.
   - Evidence: `screenshots/11-crisis-result-mobile-loop2.png`.

## Verification

- `pnpm exec vitest run src/ui/menuOverlay.test.ts src/ui/settingsOverlay.test.ts src/ui/codexOverlay.test.ts src/ui/crisisRunOverlay.test.ts src/state/gameState.test.ts src/analytics/analytics.test.ts`: 42 passed.
- `pnpm test`: 29 files passed, 175 tests passed.
- `pnpm run build`: passed. Vite still reports the existing large chunk warning.
- Browser console errors during verification: none. Phaser startup banner only.
- Fresh-tab `/#crisis` deep link mounted the Crisis Run overlay.
- Browser focus checks:
  - Settings: initial focus `Close`, Escape closed dialog, focus restored to `Settings`.
  - Codex: initial focus `Close`, Escape closed dialog, focus restored to `Codex`.
  - Crisis result: initial focus `Copy result`, copy feedback returned `Copied result.`.

## Remaining Loop Items

1. The production bundle remains large at about 1.79 MB minified JS. Code splitting is still a polish/performance item.
2. A native mobile share path could still improve result sharing, but the current copy path is functional and verified.

## Screenshots

- `screenshots/01-menu-desktop.png`
- `screenshots/02-codex-desktop.png`
- `screenshots/03-crisis-entry-desktop.png`
- `screenshots/04-crisis-result-desktop.png`
- `screenshots/05-menu-mobile.png`
- `screenshots/06-crisis-entry-mobile.png`
- `screenshots/07-menu-desktop-loop2.png`
- `screenshots/08-codex-desktop-loop2.png`
- `screenshots/09-crisis-entry-desktop-loop2.png`
- `screenshots/10-crisis-entry-mobile-loop2.png`
- `screenshots/11-crisis-result-mobile-loop2.png`
