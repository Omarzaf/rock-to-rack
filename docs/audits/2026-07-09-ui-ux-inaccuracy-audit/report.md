# UI/UX Inaccuracy Audit - Rock to Rack

Date: 2026-07-09
Scope: current local Vite build at `http://127.0.0.1:5173/`, screenshots, source inspection, and three read-only subagent passes.

## Capture Steps

| Step | Screenshot | Health |
|---|---|---|
| 1 | `screenshots/01-menu-desktop.png` | Healthy overall, but menu visual language is simpler than in-chapter operational UI. |
| 2 | `screenshots/02-ch1-entry-desktop.png` | Dialogue blocks first action while dense HUD is already visible. |
| 3 | `screenshots/03-ch1-first-interaction-desktop.png` | Selected deposit card is detached from the clicked target. |
| 4 | `screenshots/04-settings-overlay-desktop.png` | Rejected as settings evidence because a random event intercepted the settings click; accepted as event-modal evidence. |
| 5 | `screenshots/05-settings-overlay-desktop.png` | Settings is visually readable, but lacks dialog semantics and focus handoff. |
| 6 | `screenshots/06-ch6-entry-desktop.png` | Finale has too many simultaneously active UI surfaces under dialogue. |
| 7 | `screenshots/07-menu-mobile.png` | Legible, but pipeline chips wrap with a dangling connector after Grow. |
| 8 | `screenshots/08-ch1-entry-mobile.png` | HUD and dialogue leave only a narrow playfield strip. |
| 9 | `screenshots/09-ch1-first-interaction-mobile.png` | Playfield is compressed and selected action appears far from the target. |
| 10 | `screenshots/10-ch6-entry-mobile.png` | Dialogue overlays dense CH6 controls; lower controls extend beyond comfortable view. |
| 11 | `screenshots/11-ch6-playfield-mobile.png` | CH6 controls are visible but cramped; several tap targets are under 44px. |
| 12 | `screenshots/12-ch6-short-landscape.png` | CH6 short landscape shrinks critical buttons to 24-28px. |
| 13 | `screenshots/13-ch5-dice-desktop.png` | Instructional text overlaps the bright wafer scene. |
| 14 | `screenshots/14-crisis-start-desktop.png` | Crisis Run clearly presents a rescue premise. |
| 15 | `screenshots/15-crisis-ready-desktop.png` | Minimal checklist completion is possible before visible city-risk progression. |
| 16 | `screenshots/16-crisis-result-desktop.png` | My live run showed 9s, not 0s; source still allows 0s in very fast runs before first timer tick. |

Rejected captures kept for audit trace:

- `screenshots/rejected-06-ch6-entry-desktop-wrong-state.png`
- `screenshots/rejected-07-menu-mobile-wrong-state.png`

## Findings

### 1. High - Chapter 6 reads as a dashboard, not a payoff scene

What the player sees: global HUD, stage stats, build palette, chip list, job list, action buttons, city label, and dialogue all compete at once. On desktop, the dialogue appears over active job/action areas. On mobile, the same systems are stacked into the lower half of the viewport.

Evidence: `screenshots/06-ch6-entry-desktop.png`, `screenshots/10-ch6-entry-mobile.png`, `screenshots/11-ch6-playfield-mobile.png`; `src/ui/chapterSixOverlay.ts:226`, `src/styles.css:2267`.

Likely owner: CH6 overlay layout and finale onboarding.

Recommendation: collapse CH6 around one primary task and one primary panel at a time. Secondary chip/job detail should be drill-down or contextual, not always-on.

### 2. High - Mobile and short-height CH6 controls are below comfortable target size

What the player sees: CH6 buttons fit by shrinking. In portrait mobile, build buttons are 34px tall, install action is 30px, and bottom actions are 32px. In short landscape, build/action buttons are 28px and install action is 24px.

Evidence: `screenshots/11-ch6-playfield-mobile.png`, `screenshots/12-ch6-short-landscape.png`; `src/styles.css:3369`, `src/styles.css:3412`, `src/styles.css:3562`, `src/styles.css:3623`, `src/styles.css:3656`.

Likely owner: responsive CH6 CSS.

Recommendation: do not preserve every CH6 panel at mobile sizes. Use tabs, a bottom sheet, or staged panels while keeping real controls at 44px minimum.

### 3. High - Modal-like overlays are visual modals but not accessible modals

What the player sees: event cards, settings, and dialogue visually take over the screen. What the DOM reports: no `role="dialog"`, no `aria-modal`, no labelled dialog, and focus remains on `body` after Settings and event overlays open.

Evidence: `screenshots/04-settings-overlay-desktop.png`, `screenshots/05-settings-overlay-desktop.png`; `src/ui/settingsOverlay.ts:17`, `src/ui/eventCardOverlay.ts:22`, `src/ui/dialogueOverlay.ts:34`.

Likely owner: global overlay primitives.

Recommendation: create one modal helper that sets dialog role/labels, moves initial focus, traps focus, supports Escape, and restores focus to the trigger.

### 4. High - Campaign play is not keyboard-completable

What the player sees: many main actions are canvas hotspots. Source shows pointer-only handlers for chapter interactions, with partial keyboard support only in Crisis Run and CH4.

Evidence: `src/scenes/Ch2RefineryScene.ts:239`, `src/game/createGame.ts:13`, `index.html:41`; subagent source pass also identified pointer handlers in CH1, CH3, CH5, and CH6.

Likely owner: scene input architecture.

Recommendation: add keyboard equivalents for all core chapter verbs, with visible focus and on-screen shortcut disclosure where shortcuts exist.

### 5. Medium - Persistent HUD consumes too much mobile space

What the player sees: on CH1 mobile, the HUD is 187px tall before the game begins. It pushes the canvas into a 219px-high strip and leaves the primary interaction visually small.

Evidence: `screenshots/08-ch1-entry-mobile.png`, `screenshots/09-ch1-first-interaction-mobile.png`; `src/ui/pipelineHud.ts:61`, `src/styles.css:514`.

Likely owner: global HUD and mobile HUD strategy.

Recommendation: split inventory into compact current-stage metrics plus an expandable inventory tray.

### 6. Medium - CH5 instructional text overlays the wafer

What the player sees: "Dice wafer" and helper text sit on top of or beside the bright wafer, reducing readability and distracting from the target object.

Evidence: `screenshots/13-ch5-dice-desktop.png`; `src/scenes/Ch5PackageScene.ts:249`, `src/scenes/Ch5PackageScene.ts:274`.

Likely owner: CH5 canvas composition.

Recommendation: move text into the DOM stage panel or onto a dark anchored callout outside the wafer.

### 7. Medium - Rule feedback is incomplete or inaccurate in several places

Examples:

- CH2 accepts resource-spending refinery placements that can be inert if they are not in the required left-to-right active sequence.
- CH5 says "up to four chip friends" while the actual limit is six.
- CH5 sorting asks for the right bin but hides the thresholds: Perfect >= 88, Good >= 58, otherwise Salvage.
- CH6 blocked contracts say "Blocked" and list requirements, but do not explicitly name the missing requirement.

Evidence: `src/sim/refinery.ts:102`, `src/sim/refinery.ts:158`, `src/sim/refinery.ts:193`, `src/content/strings.json:1337`, `src/content/balance.json:305`, `src/content/balance.json:306`, `src/ui/chapterFiveOverlay.ts:239`, `src/ui/chapterSixOverlay.ts:346`.

Likely owner: chapter state feedback and copy.

Recommendation: show actionable missing requirements, align copy to actual limits, and expose thresholds when the task depends on them.

### 8. Medium - Crisis Run promise and result feedback overstate the actual interaction

What the player sees: "Bring Nova online before the city goes dark." The actual completion path is placing rack, power, cooling, and network, then pressing Serve Nova. My live result showed 9s; source-based subagent review found that a very fast run can report 0s because elapsed time is timer-tick based.

Evidence: `screenshots/14-crisis-start-desktop.png`, `screenshots/15-crisis-ready-desktop.png`, `screenshots/16-crisis-result-desktop.png`; `src/scenes/CrisisRunScene.ts:63`, `src/scenes/CrisisRunScene.ts:135`, `src/ui/crisisRunOverlay.ts:42`, `src/ui/crisisRunOverlay.ts:91`.

Likely owner: Crisis Run timer and scenario feedback.

Recommendation: use wall-clock timing for results and add visible blackout pressure or soften the rescue premise.

### 9. Low - Menu mobile pipeline has a dangling connector

What the player sees: the wrapped stage chips leave a connector dash after "Grow" with no next chip on that line.

Evidence: `screenshots/07-menu-mobile.png`.

Likely owner: menu stage strip wrapping CSS.

Recommendation: replace connector dashes with CSS separators that hide at row breaks, or use a compact two-row grid without inline connectors.

## Verification

- Local Vite server: `pnpm dev --host 127.0.0.1 --port 5173` served successfully after sandbox approval.
- Runtime audit: in-app browser screenshots accepted after visual inspection.
- Tests: `pnpm test` passed 26 files, 167 tests.
- Build: `pnpm build` passed. Vite reported the existing large chunk warning for `dist/assets/index-*.js`.

## Evidence Limits

- This was not a human playtest cohort. Findings are screenshot, source, and automation based.
- I did not complete every chapter manually end to end in the browser.
- Full screen-reader behavior still needs VoiceOver/NVDA verification.
- The live Crisis Run result did not reproduce `0s`, but source and prior smoke evidence explain why it can happen in a faster scripted path.
