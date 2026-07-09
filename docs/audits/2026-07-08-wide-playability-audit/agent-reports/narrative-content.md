# Narrative And Content Audit Agent Report

Read-only audit against the current worktree. No files were changed.

## Findings

### [BLOCK] The Game Reads As A Lesson Ladder, Not A Game With A Compelling Dramatic Arc

The player understands the semiconductor pipeline, but not a reason to care beyond "finish the next chapter": the README pitches "kids to CTOs" and the content is framed as chapter-to-chapter process handoffs.

Evidence: `README.md:3-4, 31-34`; `src/content/strings.json:190-194, 484-489, 744-749, 962-967, 1212-1218, 1469-1476, 1745-1747`; `src/content/strings.json:1811-1814`.

Why this blocks broad appeal: it feels like a curriculum demo instead of a game people would recommend for its own sake.

Owner: narrative/positioning/content.

Fix direction: give the whole run one explicit mission with visible stakes, then rewrite menu, chapter headers, and completion copy so every stage serves that same arc.

### [WARN] Sam And Dr. Vega Are Tutorial Voices, Not Memorable Characters

The player understands who explains things, but not who these people are or how they change; the cast stays in "player guide" / "systems mentor" mode across every chapter intro.

Evidence: `src/content/strings.json:133-163, 321-365, 623-664, 851-885, 1101-1135, 1359-1393, 1629-1674`.

Why this blocks broad appeal: there is no emotional attachment, banter, or evolving relationship to carry players through six educational stages.

Owner: dialogue/content.

Fix direction: differentiate their motives and voices, let them disagree occasionally, and make each chapter add a new wrinkle to their relationship.

### [WARN] The Learning Design Interrupts Play Too Often

The code repeatedly pauses the scene for dialogue, fact cards, event cards, and quizzes, and several chapters auto-queue fact cards on first milestones.

Evidence: `src/scenes/Ch1MineScene.ts:452-570`; `src/scenes/Ch2RefineryScene.ts:396-545`; `src/scenes/Ch3CrystalScene.ts:406-545`; `src/scenes/Ch4FabScene.ts:745-845`; `src/scenes/Ch5PackageScene.ts:615-770`; `src/scenes/Ch6DatacenterScene.ts:419-578`; `src/ui/factCard.ts:32-79`; `src/ui/eventCardOverlay.ts:22-57`; `src/ui/chapterOneOverlay.ts:97-160`.

Why this blocks broad appeal: the game teaches correctly, but it does so with enough modal interruption that momentum never fully forms.

Owner: UX/learning design and scene flow.

Fix direction: move nonessential explanation into optional layers, reduce auto-pauses, and reserve blocking teaching moments for only the highest-value concepts.

### [WARN] Chapter 6 Turns The Finale Into An Operations Dashboard

The player manages racks, power, cooling, network, battery, compute, contracts, chip installation, and the Nova finale across multiple panels. What the player understands is the system, but what they feel is a dense control room, not a payoff.

Evidence: `src/content/strings.json:1469-1803`; `src/ui/chapterSixOverlay.ts:226-423`; `src/scenes/Ch6DatacenterScene.ts:197-218, 267-337, 404-607`.

Why this blocks broad appeal: the most complex UI is also the ending, so casual players are most likely to churn right before the finish.

Owner: Chapter 6 UI/scene.

Fix direction: collapse the finale around one primary objective, hide secondary complexity behind drill-downs, and make the victory state readable in a single glance.

### [WARN] The Factual Layer Carries Explicit Risk And Some Current-Stat Language Is Too Sharp

`SOURCES.md` already warns that M3/M5/M6/M7 wording should be tightened before public launch, and the journey/codex text includes claims such as "3 months," "over 1,000 tiny steps," and "99.9999999% pure" that can age badly or be challenged.

Evidence: `src/content/SOURCES.md:18, 27, 32, 36-42`; `src/content/strings.json:1860-1862, 1880-1882, 1900-1902, 1920-1922`; `src/content/codex.json:441-444, 562-563, 586-587`.

Why this matters for broad appeal: if the educational promise feels shaky, the game loses trust with exactly the audience it wants to expand into.

Owner: content/research.

Fix direction: soften or date-stamp the numbers, keep precise claims in source-backed notes, and label simplified benchmarks as approximations where needed.

### [IDEA] The Ending Is Informative But Not Especially Shareable

Completion cards give stats and a journey block, but they do not give the player a concise brag line or a distinctive finish moment that is easy to screenshot or repeat.

Evidence: `src/ui/chapterOneOverlay.ts:163-214`; `src/ui/chapterThreeOverlay.ts:84-147`; `src/ui/chapterFourOverlay.ts:93-157`; `src/ui/chapterFiveOverlay.ts:107-195`; `src/ui/chapterSixOverlay.ts:133-224`; `src/content/strings.json:471-479, 731-739, 949-957, 1199-1207, 1457-1465, 1739-1803`.

Owner: completion overlays / marketing.

Fix direction: add a compact end-of-run identity line and a cleaner share card so the finish feels personal, not just correct.

## Coverage

- `src/content/strings.json`
- `src/content/codex.json`
- `src/content/chips.json`
- `src/content/events.json`
- `src/content/SOURCES.md`
- `docs/agent-context.md`
- `README.md`
- `src/ui/chapterJourney.ts`
- `src/ui/codexOverlay.ts`
- `src/ui/factCard.ts`
- `src/ui/eventCardOverlay.ts`
- `src/ui/chapterOverlay.ts`
- `src/ui/chapterOneOverlay.ts`
- `src/ui/chapterTwoOverlay.ts`
- `src/ui/chapterThreeOverlay.ts`
- `src/ui/chapterFourOverlay.ts`
- `src/ui/chapterFiveOverlay.ts`
- `src/ui/chapterSixOverlay.ts`
- `src/scenes/MenuScene.ts`
- `src/scenes/ChapterStubScene.ts`
- `src/scenes/Ch1MineScene.ts`
- `src/scenes/Ch2RefineryScene.ts`
- `src/scenes/Ch3CrystalScene.ts`
- `src/scenes/Ch4FabScene.ts`
- `src/scenes/Ch5PackageScene.ts`
- `src/scenes/Ch6DatacenterScene.ts`
- `src/sim/codex.ts`
- `src/sim/codex.test.ts`
