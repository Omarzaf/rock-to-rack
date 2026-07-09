# Wide Playability Audit - Rock to Rack

Date: 2026-07-08  
Goal: review the game in repeated evidence-backed passes until every major component has been checked with due diligence, then identify what is preventing broad play.

## Verdict

Rock to Rack is a credible educational product, but it is not yet structured like a game that can become widely played.

The central blocker is not one bug. It is the product shape: the game is a long, linear lesson ladder with correct systems, frequent instructional interruptions, limited strategy, weak replay motivation, and mobile/accessibility gaps. The first-time experience teaches the semiconductor supply chain, but it does not deliver a fast enough hook, a strong enough fantasy, or a durable enough reason to return.

The fastest path toward broad play is to stop adding more content and build a "wide-playability cut": immediate playable hook, shorter first run, lower-friction teaching, repeatable score/challenge loop, clearer finale, and baseline web accessibility.

## Due-Diligence Loop

This audit was intentionally run as a loop rather than a single opinion pass.

| Pass | Method | Result |
|---|---|---|
| 1 | Preview capture across desktop/mobile menu and chapters 1-6 | 18 screenshots accepted after rejecting an invalid first capture that reused stale hash navigation |
| 2 | Gameplay specialist audit | Found replay, pacing, onboarding, and mechanics blockers |
| 3 | Frontend/accessibility specialist audit | Found pointer-only input, modal semantics, and mobile hit-target risks |
| 4 | Narrative/content specialist audit | Found lesson-ladder arc, weak character motivation, and source-tightness risks |
| 5 | Coordinator source pass | Covered 88 source files across app shell, scenes, systems, UI, state, content, and tests |
| 6 | Synthesis/moderation pass | Cross-checked repeated findings and prioritized the blockers below |

I do not see a major component left unreviewed at component level. The remaining uncertainty is user evidence, not code coverage: there is no analytics cohort, no fresh external playtest group, and no completed browser playthrough by a human in this audit.

## Evidence Record

Local artifacts:

- Screenshot manifest: `docs/audits/2026-07-08-wide-playability-audit/screenshots/screenshot-manifest.json`
- Screenshots: `docs/audits/2026-07-08-wide-playability-audit/screenshots/*.png`
- Gameplay report: `docs/audits/2026-07-08-wide-playability-audit/agent-reports/gameplay.md`
- Frontend/accessibility report: `docs/audits/2026-07-08-wide-playability-audit/agent-reports/frontend-accessibility.md`
- Narrative/content report: `docs/audits/2026-07-08-wide-playability-audit/agent-reports/narrative-content.md`
- Simulator verification: `corepack pnpm simulate` passed 5/5 tests and reported full-run paths of 63.2, 84.0, and 86.6 minutes.

External context used:

- Newzoo: the 2025-2026 games market is large but discovery is harder, so broad reach needs strong retention and organic appeal. Source: https://newzoo.com/resources/blog/global-games-market-q2-2026
- Defold/Poki web-game guidance: high-performing web games emphasize instant fun, fast loading, simple satisfying loops, strong controls, clear visuals, and replayability. Source: https://defold.com/2026/06/02/Best-practices-when-building-for-the-web/
- Poki requirements: web games should support desktop, mobile, and tablet, streamline entry, use skippable cutscenes, avoid text-heavy tutorials, and provide adaptive controls. Source: https://sdk.poki.com/new-requirements
- GameDeveloper onboarding guidance: early onboarding should avoid frontloaded exposition, confusing UI, and complexity before the player has a reason to care. Source: https://www.gamedeveloper.com/design/how-onboarding-should-be-applied-to-tutorials

## Coverage Matrix

| Area | Components reviewed | Audit result |
|---|---|---|
| Boot and app shell | `src/main.ts`, `src/game/createGame.ts`, `src/scenes/BootScene.ts`, `index.html` | Stable enough for audit; fixed 1280x720 FIT canvas works but the product relies heavily on scaling dense UI. |
| Menu and ship surface | `src/scenes/MenuScene.ts`, `src/ui/menuOverlay.ts`, `src/ship/*`, `public/*` | Menu is polished but static. It communicates subject matter before it creates a playable desire. Feedback link is disabled when metadata is empty. |
| Chapter 1 mine | `src/scenes/Ch1MineScene.ts`, `src/sim/mining.ts`, chapter one overlay/content | First gameplay is blocked by dialogue. The mining verb is readable, but the loop is mostly click clusters, install miners, meet target. |
| Chapter 2 refinery | `src/scenes/Ch2RefineryScene.ts`, `src/sim/refinery.ts` | Teaches purification clearly. Exact module chain means the player is solving the intended checklist more than experimenting. |
| Chapter 3 crystal | `src/scenes/Ch3CrystalScene.ts`, `src/sim/crystal.ts` | Strongest tactile chapter. Heat/drag interaction has game feel, but reward targets remain abstract. |
| Chapter 4 fab | `src/scenes/Ch4FabScene.ts`, `src/sim/fab.ts` | Best keyboard exception and a clearer physical verb. Still instruction-heavy and completion-gated. |
| Chapter 5 package | `src/scenes/Ch5PackageScene.ts`, `src/sim/package.ts` | System is understandable, but visible text overlays the wafer area in screenshots and die bins are largely fixed by data. |
| Chapter 6 datacenter | `src/scenes/Ch6DatacenterScene.ts`, `src/sim/datacenter.ts`, `src/ui/chapterSixOverlay.ts` | Finale is over-dense. Multiple operational panels compete with the core payoff, and the mobile/desktop screenshots show clipped or cramped regions. |
| Sandbox/debug/routing | `src/scenes/SandboxScene.ts`, `src/scenes/debugProgress.ts`, `src/scenes/sceneRouting.ts` | Useful for development and testing, not a player-facing retention loop. |
| Sim systems | `src/sim/*`, `src/content/balance.json` | Internally coherent and tested. Broad-play issue is design, not broken math: systems are deterministic and checklist-oriented. |
| UI overlays | `src/ui/*Overlay.ts`, `factCard.ts`, `eventCardOverlay.ts`, `dialogueOverlay.ts`, `pipelineHud.ts` | Many polished panels, but too many are blocking and most lack robust dialog semantics/focus management. |
| State/storage | `src/state/*` | Tracks resources, progress, and completion. It does not model durable meta-progression, challenges, score history, unlocks, or return hooks. |
| Content/research | `src/content/*.json`, `src/content/SOURCES.md`, `README.md` | Strong educational coverage. Some claims need softer wording or source tightening before public trust work. |
| Tests and tools | Unit tests, static checks, simulator, screenshots | Existing tests support correctness. They do not yet prove keyboard completion, mobile ergonomics, focus trapping, or fun/retention. |

## Prioritized Findings

### 1. [BLOCK] The Game Ends Instead Of Turning Into A Reason To Return

Evidence:

- `src/scenes/Ch6DatacenterScene.ts:582-607` sends the player back to menu after completion.
- `src/state/gameState.ts:7-102` stores completion/resources but no score history, meta progression, unlocks, daily run, challenge board, or alternate route.
- `src/scenes/sceneRouting.ts:3-16` only routes menu, sandbox, and chapters 1-6.

Why it matters:

Widely played games need a reason to play again, recommend, compare, improve, or share. Rock to Rack currently has a clear end, but not a durable return loop.

Fix direction:

Create a repeatable 15-20 minute "Run of the Day" or "Crisis Run" unlocked from the menu. Track score, run grade, time, bottlenecks, power efficiency, yield, and cloud jobs served. Give the player a shareable result card and a reason to rerun with different constraints.

### 2. [BLOCK] The First 10 Seconds Do Not Hook The Player

Evidence:

- `01-menu-desktop.png` and `08-menu-mobile.png` show a static title/menu with abstract visuals, not an immediately playable scene.
- `02-ch1-entry-desktop.png` shows the mine behind dialogue before the player has done anything.
- `corepack pnpm simulate` reports full completion paths of 63.2 to 86.6 minutes.

Why it matters:

For web games, players decide quickly. The game currently asks for patience before it proves the fun.

Fix direction:

Open with a playable micro-crisis in under 10 seconds: "the city model is dark, bring one AI rack online." Let the player tap, drag, or connect something immediately, then reveal that the supply chain is how they scale the solution. Move the current menu behind Play/Pause rather than making it the first emotional beat.

### 3. [WARN] The Core Mechanics Are Correct But Too Checklist-Oriented

Evidence:

- `src/sim/mining.ts:222-259` allows full refund removal.
- `src/sim/refinery.ts:148-171` and `193-258` enforce an ordered lane/module path.
- `src/sim/package.ts:118-245` uses precomputed die bins and fixed build requirements.
- `src/sim/datacenter.ts:256-335` checks contracts against installed chips/infrastructure requirements.

Why it matters:

Correct systems teach, but strategy creates stories. Right now the likely player story is "I found the intended solution," not "I made a clever build."

Fix direction:

Add one real tradeoff per chapter: speed vs purity, yield vs heat, power vs compute, cheap chips vs reliability, local cooling vs grid load. Make at least two builds viable and let mistakes be recoverable but consequential.

### 4. [WARN] Teaching Interrupts Momentum Too Often

Evidence:

- Mandatory intro/dialogue and quiz gates recur in chapter scenes: `Ch1MineScene.ts:452-570`, `Ch2RefineryScene.ts:396-545`, `Ch3CrystalScene.ts:406-545`, `Ch4FabScene.ts:745-845`, `Ch5PackageScene.ts:615-770`, `Ch6DatacenterScene.ts:419-578`.
- Fact cards and event cards appear as modal instructional surfaces.

Why it matters:

The game earns trust as an explainer but loses momentum as a game. This is especially dangerous for repeat sessions.

Fix direction:

Make explanations progressive, optional, and one-time where possible. Let first-run teaching exist, but allow "skip to play" and embed more instruction into the toy itself through labels, ghost previews, meters, and feedback.

### 5. [WARN] Chapter 6 Is The Payoff, But It Feels Like A Dashboard

Evidence:

- `07-ch6-playfield-desktop.png` shows multiple UI regions around a muted grid; the bottom jobs panel is clipped.
- `10-ch6-playfield-mobile.png` shows dense stacked panels and reduced game area.
- `src/ui/chapterSixOverlay.ts:226-423` and `src/scenes/Ch6DatacenterScene.ts:197-607` coordinate many competing systems at the finale.

Why it matters:

The final chapter should make the player feel the semiconductor chain come alive. Instead, the most complex administrative UI arrives at the exact moment the game needs emotional payoff.

Fix direction:

Collapse the finale around one readable objective: bring Nova online under power/cooling pressure. Hide secondary systems behind drill-downs, show a dramatic visual state change, and reserve dense stats for the completion screen.

### 6. [WARN] Mobile And Accessibility Are Not Ready For Broad Web Distribution

Evidence:

- Core chapters are mostly pointer-only: `Ch1MineScene.ts:283-284`, `Ch2RefineryScene.ts:239-241`, `Ch3CrystalScene.ts:124-126`, `Ch5PackageScene.ts:477-484`, `Ch6DatacenterScene.ts:655-657`.
- Chapter 4 is the partial keyboard exception: `Ch4FabScene.ts:151-188`.
- Overlay surfaces lack full dialog semantics/focus handling: `settingsOverlay.ts`, `codexOverlay.ts`, `eventCardOverlay.ts`, `factCard.ts`, `dialogueOverlay.ts`, chapter overlays.
- Short-height CSS breakpoints shrink controls below comfortable touch size: `src/styles.css:2724-2742`, `3043-3249`, `3355-3496`.

Why it matters:

Broad web distribution means phones, tablets, laptops, keyboard users, and assistive tech. The current experience can be playable for many users, but not reliably inclusive or comfortable.

Fix direction:

Add keyboard equivalents for all core actions, keep touch controls at or above 44px, implement focus trap/restore/Escape behavior for modal overlays, and add Playwright checks for mobile and short-height layouts.

### 7. [WARN] The Narrative Has Subject Matter But Not A Strong Player Fantasy

Evidence:

- README and menu copy frame the game as an educational journey.
- Sam and Dr. Vega mostly function as tutorial voices across `src/content/strings.json`.
- Chapter completion copy explains process handoffs more than character stakes.

Why it matters:

People may share a good explainer once. They replay and recommend games when they can say what role they had and why it felt satisfying.

Fix direction:

Define one mission: keep a public-interest AI system alive, rescue a launch, defend an open compute network, or rebuild a broken supply chain. Give Sam and Dr. Vega clashing motives and let each chapter escalate the same mission.

### 8. [WARN] The Fact Layer Still Needs Public-Trust Hardening

Evidence:

- `src/content/SOURCES.md` flags wording that should be tightened before public launch.
- Current strings/codex contain precise or age-sensitive claims such as 3 months, over 1,000 steps, and 99.9999999% purity.

Why it matters:

The game is selling educational trust. If specific claims look brittle, the audience most likely to praise the game may instead scrutinize it.

Fix direction:

Date-stamp or soften sharp claims, move precise claims into source-backed notes, and label simplified benchmarks as approximations.

### 9. [IDEA] The Game Needs More Tactile Identity

Evidence:

- Screenshots show many abstract circles, panels, meters, and text-heavy overlays.
- The strongest moments are the physical-feeling chapters, especially crystal/fab interactions.

Why it matters:

The current look is polished but not instantly memorable. For broad play, the game needs a visual/action identity that survives a screenshot.

Fix direction:

Build around one iconic toy-like interaction: ore to wafer to chip to rack as a visible transformation chain. Add more motion, sound, and one screenshot-worthy victory state before expanding scope.

### 10. [IDEA] Product Analytics And Feedback Are Present But Not Useful Yet

Evidence:

- `src/analytics/analytics.ts` exists, but this audit found no product report that answers first-session dropoff, replay, chapter churn, or control frustration.
- `src/ship/siteMetadata.ts` leaves `feedbackHref` empty, which disables the feedback link path.

Why it matters:

Once the first wide-playability cut exists, iteration should be driven by where players churn, not by internal taste alone.

Fix direction:

Track anonymous local/session events for start, first interaction, first completion, chapter abandon, quiz retries, mobile viewport, and replay. Add a visible feedback channel before external distribution.

## What Not To Do First

- Do not add more chapters before fixing hook, replay, mobile, and modal friction.
- Do not add more fact cards as the primary educational improvement.
- Do not spend the next pass only polishing copy if the first 10 seconds remain static.
- Do not ship a public growth push until keyboard/mobile and source-tightness issues are addressed.
- Do not treat the simulator passing as evidence that the experience is fun. It proves pacing windows and completion logic, not broad appeal.

## Recommended Fix Order

### Milestone A: Wide-Playability Cut

Goal: make the first session compelling enough for a cold web player.

1. Start on a playable micro-crisis within 10 seconds.
2. Add skip/fast-forward for intros and quizzes after first exposure.
3. Shorten the first complete route or split into a 15-20 minute run mode.
4. Add a shareable end card with score, identity line, and one clear replay prompt.

### Milestone B: Replay And Strategy

Goal: make "I can do better" true.

1. Add a daily/challenge run.
2. Persist score history and best runs.
3. Add at least one meaningful tradeoff per chapter.
4. Make chapter outcomes influence later constraints.

### Milestone C: Mobile And Accessibility

Goal: make the game comfortably playable on broad web surfaces.

1. Add keyboard completion paths.
2. Fix dialog semantics, focus trap, focus restore, and Escape.
3. Keep mobile controls at 44px or larger.
4. Add Playwright checks for desktop, mobile, short-height landscape, and modal focus.

### Milestone D: Narrative And Payoff

Goal: make the game worth recommending as a game, not only as an explainer.

1. Pick one mission and rewrite the menu/chapter framing around it.
2. Give Sam and Dr. Vega motives, disagreement, and change.
3. Rebuild Chapter 6 around a single high-stakes visible payoff.
4. Add sound/motion around the transformation chain.

### Milestone E: Public-Trust Hardening

Goal: make the educational promise defensible.

1. Audit sharp factual claims.
2. Add source/date notes for claims likely to age.
3. Keep gameplay abstractions labeled as approximations.
4. Re-run content coherence tests and add tests for updated claims.

## Moderator Review

Scope: screenshots, three agent reports, simulator output, source inventory, scene/sim/UI/state/content layers, external web-game benchmark sources.

[BLOCK] The report must not imply the game is broken. It is not; the blocker is product/game shape.  
[WARN] The audit lacks real user telemetry and live external playtest evidence. Treat recommendations as design diagnosis, then validate with players.  
[NIT] Some evidence is source-line based and may drift after edits. Re-check line numbers before turning findings into tickets.  
[IDEA] Convert the top findings into a tracked milestone board before implementing.

Verdict: PASS. The audit has enough component coverage to close the review loop and move into a prioritized implementation plan.

## Retrospective

Worked: repeated passes converged on the same blockers from screenshots, source, simulator, and specialist audits.  
Did not: no outside playtest or analytics cohort was available, so confidence is high on component coverage but not on market validation.  
Rule proposal: for future wide-playability audits, require screenshot evidence plus at least one measured first-session playthrough before making growth recommendations.
