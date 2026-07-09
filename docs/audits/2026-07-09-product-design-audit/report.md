# Product Design Audit - Rock to Rack

Date: 2026-07-09
Destination: local folder
Preview audited: `http://127.0.0.1:5174/`
Mode: combined UX and accessibility audit

## Audit Scope

This audit covers the current player-facing loop in the local codebase:

1. Main menu
2. Settings
3. Codex
4. Crisis Run entry
5. Crisis Run placement path
6. Crisis Run result and replay prompt
7. Mobile menu at 390x844
8. Mobile Crisis Run entry at 390x844

Screenshots were captured from the in-app browser during this audit run and saved in `docs/audits/2026-07-09-product-design-audit/screenshots/`.

One mobile capture was rejected because a hash-only route change preserved the completed crisis result. The corrected screenshot was captured after a fresh reset query. Initial desktop full-page captures were also replaced with viewport captures after a sanity check showed the full-page capture path was not faithful to the visible layout.

## Step List

| Step | Screenshot | Description | General health |
|---:|---|---|---|
| 1 | `screenshots/01-menu-desktop.png` | Desktop menu with title, six-stage pipeline, Crisis Run, Learn Mode, and utility controls. | Healthy |
| 2 | `screenshots/02-settings-desktop.png` | Settings modal with mode, mute, text size, reset, and teacher/parent context. | Healthy with caution |
| 3 | `screenshots/03-codex-desktop.png` | Codex modal in first-run locked state. | At risk |
| 4 | `screenshots/04-crisis-entry-desktop.png` | Crisis Run initial state with objective, stats, build controls, grid, and disabled finish action. | Healthy with caution |
| 5 | `screenshots/05-crisis-built-desktop.png` | Crisis Run after placing rack, power, cooling, and network; finish action enabled. | Healthy |
| 6 | `screenshots/06-crisis-result-desktop.png` | Result modal with score, grade, share line, stats, and replay prompt. | Healthy |
| 7 | `screenshots/07-menu-mobile.png` | Mobile menu at 390x844. | Healthy with caution |
| 8 | `screenshots/08-crisis-entry-mobile.png` | Mobile Crisis Run entry at 390x844. | At risk |

## Strengths

1. The desktop menu gives a clear product identity and a useful choice between quick play and campaign learning. The six-stage pipeline tells the player what world they are entering before they click.

2. Crisis Run starts quickly. The first playable screen already has the mission, stats, build controls, city backdrop, and a visible grid.

3. The ready state is understandable. After four placements, the installed parts are labeled on the grid and the primary action changes from disabled to enabled.

4. The result modal is one of the strongest product moments. It gives a score, grade, shareable sentence, replay target, and a direct replay button.

5. Settings are concise and useful for the actual audience. The teacher/parent note explains the educational frame without turning the first screen into documentation.

## UX Risks

1. Step 1: The first choice needs slightly more explanation. `Crisis Run` and `Learn Mode` are clear labels once the player understands the product, but a cold player may not know which path is recommended, how long each path is, or whether Crisis Run skips teaching. Add one short descriptor per mode or a recommended badge.

2. Step 3: Codex opens to a wall of locked entries. The unlock model is clear, but first-time motivation is weak because every visible card says locked. Give the player one or two starter entries, show category progress, or preview the kind of reward they are working toward.

3. Step 4: Crisis Run explains the required ingredients but does not preview placement consequences before the player clicks. The build buttons and empty grid are readable, but cost, effect, and selected-building feedback could be stronger. Add hover/focus/tap previews, a selected-build label near the grid, and invalid-placement feedback close to the cell.

4. Step 6: The result state has good replay motivation, but the share line is inert. Add a copy/share result action so the moment can leave the game without requiring manual text selection.

5. Step 8: Mobile Crisis Run makes the playable area secondary. At 390x844 the canvas is about 390x219 while the overlay spans almost the full viewport. The controls remain usable, but the actual grid feels small and administrative. Consider a mobile-specific layout with a compact stat strip, larger centered grid, and a sticky bottom build toolbar.

## Accessibility Risks

1. Step 7: Mobile utility controls are 40px high in the measured capture. Primary actions meet or exceed 44px, but `Mode`, `Muted`, `Codex`, and `Settings` are below the common 44px touch target guideline.

2. Step 8: Mobile build buttons and action buttons meet the 44px height threshold, but the dense vertical stack increases cognitive load and makes the grid harder to perceive.

3. Step 4 and Step 5: The grid is a canvas interaction. Screenshots cannot prove semantic names, screen-reader access, or keyboard completion. The visible UI should expose keyboard hints or an equivalent non-canvas control path if the run is meant to be broadly accessible.

4. Step 2, Step 3, and Step 6: Modals have visible close/actions, but screenshots cannot confirm focus trap, focus restore, Escape behavior, or screen-reader dialog semantics. Those need keyboard and assistive-technology testing.

5. Step 4 and Step 8: The disabled `Serve Nova` state is visually clear, but contrast ratios for disabled text and low-emphasis instructional text were not measured in this audit.

## Evidence Limits

- This was a screenshot-backed product audit, not a full WCAG audit.
- No screen reader, automated accessibility scanner, or keyboard-only completion pass was run.
- Browser DOM snapshot support was unavailable in this session, so interactions were verified with targeted DOM reads, screenshots, and visible inspection.
- No external playtesters or analytics cohorts were used.

## Recommendations

1. Add one-line mode descriptions on the menu: expected length, goal, and whether the mode teaches or challenges.
2. Seed the Codex with at least one unlocked entry and group locked entries by supply-chain stage.
3. Improve Crisis Run placement affordances with selected-build context, cost/effect previews, and cell-level feedback.
4. Add a `Copy result` or share-card action to the result modal.
5. Give mobile Crisis Run a purpose-built layout that makes the grid the main object, not a small element between stacked HUD regions.
6. Raise mobile utility controls to at least 44px high.
7. Run a follow-up keyboard and screen-reader pass for menu, settings, codex, Crisis Run placement, and result replay.

## Verification

- `pnpm run build`: passed in 21.89s. Vite reported the existing large chunk warning for `dist/assets/index-DlUMHdx8.js`.
- `pnpm test`: 26 files passed, 167 tests passed.
- Browser error log check: no errors returned.
