# Rock to Rack Agent Context

Updated: 2026-07-09 YC readiness pass
Workspace: `/Users/omar/Downloads/Game`

## Current State

This is a Phaser 3.90 / Vite / TypeScript browser game named Rock to Rack. The workspace is not a git repo. `pnpm` is declared in `package.json`; on this machine, use `corepack pnpm ...` or local binaries in `node_modules/.bin` because `pnpm` is not on PATH.

Latest final-readiness report: `docs/audits/2026-07-09-yc-readiness-check/report.md`.
Fable 5 project handoff: `docs/FABLE_5_PROJECT_REPORT.md`.

Current verification snapshot:

- `corepack pnpm test`: 34 files, 187 tests passed.
- `corepack pnpm simulate`: fast, average, and slow profiles complete all six chapters.
- `corepack pnpm verify:static`: 2 files, 7 tests passed.
- `corepack pnpm build`: passed with the existing large JS chunk warning.
- `corepack pnpm smoke:m10`, `smoke:m11`, and `smoke:m12`: passed in Chromium against Vite preview.
- `corepack pnpm perf:m10`: passed when run alone with latest `firstPlayableMs` 725 and `totalBytes` 1,861,250.

Do not run `perf:m10` in parallel with the browser smokes; a concurrent run measured local contention rather than app startup cost.

Local production preview for verification runs at:

```bash
http://localhost:4173/
```

Public Vercel URL verified after deploy:

```bash
https://rock-to-rack.vercel.app/
```

If that server is gone, run `corepack pnpm build`, then start `corepack pnpm preview --host 127.0.0.1` from this workspace.

## Current Handoff

- M1 through M12 Replay Loop are implemented and verified.
- M7 completed Chapter 6 Rack Up / Data Center Integration at `#ch6`.
- `#ch6` is now a playable data-center finale with racks, chip installs, contracts, crises, Nova, quiz gating, and victory flow.
- M8 completed Codex, analytics, settings, and save polish.
- M9 completed balance simulation, catch-up pacing hooks, and debug playtest instrumentation.
- M10 local ship prep completed static launch assets, metadata, favicon, loading screen, 404 fallback, production-gated service worker, README, and local perf/browser smoke.
- M11 completed a new `#crisis` Crisis Run path, menu mode split, local best-run scoring, result card, and dialogue skip foundation.
- M12 completed the Crisis Run replay loop: result cards now show run number, best-score comparison, next replay target, clean replay restart behavior, and a two-run browser smoke script.
- The M6 implementation plan is `docs/superpowers/plans/2026-07-07-m6-chapter-five-package.md`.
- The M7 implementation plan is `docs/superpowers/plans/2026-07-07-m7-chapter-six-datacenter.md`.
- The M8 implementation plan is `docs/superpowers/plans/2026-07-07-m8-codex-analytics-save-polish.md`.
- The M9 implementation plan is `docs/superpowers/plans/2026-07-08-m9-balance-playtest-instrumentation.md`.
- The M9 simulation report is `docs/superpowers/reports/2026-07-08-m9-simulation-report.md`.
- The M10 implementation plan is `docs/superpowers/plans/2026-07-08-m10-ship-it.md`.
- The M11 implementation plan is `docs/superpowers/plans/2026-07-08-m11-wide-playability-cut.md`.
- The M12 implementation plan is `docs/superpowers/plans/2026-07-08-m12-replay-loop.md`.
- The wide-playability audit is `docs/audits/2026-07-08-wide-playability-audit/report.md`.
- The user approved an updated preview deploy on 2026-07-08. Vercel CLI created/linked project `rock-to-rack`; the deploy command was run without `--prod`, but Vercel returned `target: production` and aliased `https://rock-to-rack.vercel.app/`. The generated deployment URL is SSO-protected; the public alias is the verified URL.

## Operator Direction

The user asked to proceed milestone by milestone:

- M1: Shared systems: resources, HUD, dialogue, fact cards.
- M2: Chapter 1 mine scene.
- After M2 was playable, the user said it looked complex and clunky, then approved a visual polish pass before moving to the next step.

The latest completed work is M12 Replay Loop. Public preview deploy refresh, production promotion, Lighthouse install/run, real feedback-link configuration, and full manual 90-minute cross-browser playthrough remain explicit checkpoints.

## M2 Implementation Summary

Chapter 1 is playable at `#ch1`.

Implemented:

- Side-view mine cutaway with five deposits: quartz, copper, lithium, cobalt, rare earths.
- Miner placement with credit cost and four-slot limit.
- Miner movement/removal.
- Extraction over time into the HUD.
- Depth-based energy upkeep.
- Deposit depletion.
- Goal basket checklist.
- Four-line intro dialogue.
- Five first-mined fact cards with kid and nerd text.
- Two event cards: mine flood and copper price spike.
- One-question Field Check quiz.
- Wrong-answer explanation and retry.
- Completion screen with `Next: The Refinery`.
- Chapter 1 completion state persists into the Chapter 2 stub.
- Fact-card and quiz analytics events are emitted on the local event bus.

Key files:

- `src/scenes/Ch1MineScene.ts`
- `src/sim/mining.ts`
- `src/sim/mining.test.ts`
- `src/ui/chapterOneOverlay.ts`
- `src/ui/pipelineHud.ts`
- `src/content/balance.json`
- `src/content/events.json`
- `src/content/quiz.json`
- `src/content/strings.json`
- `src/content/SOURCES.md`
- `src/state/types.ts`
- `src/state/gameState.ts`
- `src/fixtures/chapterFixtures.ts`
- `src/styles.css`

## Visual Polish Summary

The post-M2 visual pass changed presentation only.

Changes:

- Reworked `drawTerrain()` from hard horizontal bands into a softer cutaway mine with layered polygon strata, subtle texture, haze, and lower-contrast rules.
- Added deposit glow/shadow and visible selected-deposit rings.
- Replaced the heavy three-panel overlay with:
  - compact top resource HUD,
  - objective strip with progress bars,
  - contextual selected-deposit card,
  - smaller bottom action tray with slot pips.
- Tightened mobile layout into non-overlapping bands.

Fresh screenshot evidence:

- `/tmp/rock-to-rack-polish-desktop.png`
- `/tmp/rock-to-rack-polish-mobile.png`

## M3 Implementation Summary

Chapter 2 is playable at `#ch2`.

Implemented:

- Refinery routing puzzle with four lanes: silicon, copper, lithium, cobalt.
- Module palette with crusher, furnace, chemical bath, and zone refiner.
- Ordered module-chain validation and occupied-cell checks in pure sim code.
- Timed refinery ticks that consume minerals, energy, and water.
- Silicon purity progression toward 9N.
- Parallel refined-output targets for copper, lithium, and cobalt.
- Slag generation, recycling, safe storage, and slag-cap blocking.
- Chapter 2 intro dialogue, fact cards, event cards, Field Check quiz, and completion modal.
- Chapter 2 save hydration and fixture state for `#ch2` and `#ch3+`.
- Completion transition from Chapter 2 to `#ch3`.
- Responsive Chapter 2 overlay with desktop and mobile visual QA pass.

Key files:

- `src/scenes/Ch2RefineryScene.ts`
- `src/sim/refinery.ts`
- `src/sim/refinery.test.ts`
- `src/ui/chapterTwoOverlay.ts`
- `src/content/balance.json`
- `src/content/events.json`
- `src/content/quiz.json`
- `src/content/strings.json`
- `src/content/SOURCES.md`
- `src/state/types.ts`
- `src/state/gameState.ts`
- `src/state/gameState.test.ts`
- `src/fixtures/chapterFixtures.ts`
- `src/styles.css`

M3 screenshot evidence:

- `/tmp/rock-to-rack-m3-ch2-grid.png`
- `/tmp/rock-to-rack-m3-ch2-complete.png`
- `/tmp/rock-to-rack-m3-ch2-mobile.png`

## M4 Implementation Summary

Chapter 3 is playable at `#ch3`.

Implemented:

- Czochralski pull stage with hold/release temperature control.
- Pure crystal simulation for pull quality, vibration penalty, retry, ingot profile, slicing, and wafer output.
- Diamond-wire slicing stage with eight visible guide lines and flawed-section discard support.
- Chapter 3 resources, HUD, stage status, temperature panel, action tray, intro dialogue, fact cards, event card, Field Check quiz, and completion modal.
- Chapter 3 save hydration and fixture state for `#ch3` and `#ch4+`.
- Completion transition from Chapter 3 to `#ch4`.
- Touch/click hardening for shared quiz and completion buttons.
- Responsive Chapter 3 overlay with desktop and mobile visual QA pass.

Key files:

- `src/scenes/Ch3CrystalScene.ts`
- `src/sim/crystal.ts`
- `src/sim/crystal.test.ts`
- `src/ui/chapterThreeOverlay.ts`
- `src/ui/chapterOneOverlay.ts`
- `src/content/balance.json`
- `src/content/events.json`
- `src/content/quiz.json`
- `src/content/strings.json`
- `src/content/SOURCES.md`
- `src/state/types.ts`
- `src/state/gameState.ts`
- `src/state/gameState.test.ts`
- `src/fixtures/chapterFixtures.ts`
- `src/styles.css`

M4 screenshot evidence:

- `/tmp/rock-to-rack-m4-ch3-pull.png`
- `/tmp/rock-to-rack-m4-ch3-slice.png`
- `/tmp/rock-to-rack-m4-ch3-smoke-complete.png`
- `/tmp/rock-to-rack-m4-ch3-mobile.png`

## M5 Implementation Summary

Chapter 4 is playable at `#ch4`.

Implemented:

- Four-station fab minigame: coat, expose, etch, and dope.
- Pure fabrication simulation for station scores, node difficulty, event penalties, die-map generation, wafer completion, and chip output.
- Three-node difficulty ramp: `90nm`, `28nm`, and `7nm`; player-facing copy treats these as node labels/generation shorthand, not exact transistor measurements.
- Die-yield review map with green good dies and red defective dies.
- Chapter 4 resources, HUD, stage status, station panel, action tray, intro dialogue, fact cards, event cards, Field Check quiz, and completion modal.
- Chapter 4 save hydration and fixture state for `#ch4` and `#ch5+`.
- Completion transition from Chapter 4 to `#ch5`.
- Responsive Chapter 4 overlay with desktop and mobile visual QA pass.

Key files:

- `src/scenes/Ch4FabScene.ts`
- `src/sim/fab.ts`
- `src/sim/fab.test.ts`
- `src/ui/chapterFourOverlay.ts`
- `src/content/balance.json`
- `src/content/events.json`
- `src/content/quiz.json`
- `src/content/strings.json`
- `src/content/SOURCES.md`
- `src/state/types.ts`
- `src/state/gameState.ts`
- `src/state/gameState.test.ts`
- `src/fixtures/chapterFixtures.ts`
- `src/styles.css`

M5 screenshot evidence:

- `/tmp/rock-to-rack-m5-ch4-coat.png`
- `/tmp/rock-to-rack-m5-ch4-expose.png`
- `/tmp/rock-to-rack-m5-ch4-die-map.png`
- `/tmp/rock-to-rack-m5-ch4-mobile.png`

## M6 Implementation Summary

Chapter 5 is playable at `#ch5`.

Implemented:

- Dicing and test-binning flow with separate `Dice wafer` and `Start sorting` actions.
- Pure package simulation for deterministic test dies, bin thresholds, sort downgrades, chip build costs, Nova lock state, and goal progress.
- Three bins: Perfect, Good, and Salvage.
- Chip roster from `chips.json`: CPU, GPU, DRAM, NAND, NIC, PMIC, and locked Nova.
- DOM roster panel with selectable chip cards, affordability/build/locked states, bin row, and lineup meter.
- Chapter 5 intro dialogue, fact cards, event cards, Field Check quiz, and completion modal.
- Chapter 5 save hydration and fixture state for `#ch5` and `#ch6+`.
- Completion transition from Chapter 5 to `#ch6`.
- Responsive Chapter 5 overlay with desktop and mobile visual QA pass.

Key files:

- `src/scenes/Ch5PackageScene.ts`
- `src/sim/package.ts`
- `src/sim/package.test.ts`
- `src/ui/chapterFiveOverlay.ts`
- `src/content/balance.json`
- `src/content/chips.json`
- `src/content/events.json`
- `src/content/quiz.json`
- `src/content/strings.json`
- `src/content/SOURCES.md`
- `src/state/types.ts`
- `src/state/gameState.ts`
- `src/state/gameState.test.ts`
- `src/fixtures/chapterFixtures.ts`
- `src/styles.css`

M6 screenshot evidence:

- `/tmp/rock-to-rack-m6-ch5-dice.png`
- `/tmp/rock-to-rack-m6-ch5-sort.png`
- `/tmp/rock-to-rack-m6-ch5-roster.png`
- `/tmp/rock-to-rack-m6-ch5-mobile.png`

## M7 Implementation Summary

Chapter 6 is playable at `#ch6`.

Implemented:

- Grid-based data-center finale with rack, power, cooling, network, and battery buildings.
- Pure data-center simulation for building placement, rack chip slots, live power/cooling/network constraints, contract readiness, heat/power crises, event deltas, Nova lock state, and goal progress.
- Chapter 6 save hydration and fixture state, including available chips derived from Chapter 5 plus support loaners for the finale.
- Contract ticker with Cartoon Stream, Weather AI, City Backup, and Hospital Nova jobs.
- Heatwave and brownout event chain with persistent sim effects.
- Nova recap challenge, Nova installation, hospital contract, Field Check quiz, and victory modal.
- Chapter 6 completion is gated behind the quiz; serving the final contract alone does not persist completion.
- Responsive Chapter 6 overlay with desktop, mobile portrait, and short-landscape visual QA.

Key files:

- `src/scenes/Ch6DatacenterScene.ts`
- `src/sim/datacenter.ts`
- `src/sim/datacenter.test.ts`
- `src/ui/chapterSixOverlay.ts`
- `src/content/balance.json`
- `src/content/events.json`
- `src/content/quiz.json`
- `src/content/strings.json`
- `src/content/SOURCES.md`
- `src/state/types.ts`
- `src/state/gameState.ts`
- `src/state/gameState.test.ts`
- `src/fixtures/chapterFixtures.ts`
- `src/styles.css`

M7 screenshot evidence:

- `/tmp/rock-to-rack-m7-ch6-build.png`
- `/tmp/rock-to-rack-m7-ch6-contracts.png`
- `/tmp/rock-to-rack-m7-ch6-crisis.png`
- `/tmp/rock-to-rack-m7-ch6-victory.png`
- `/tmp/rock-to-rack-m7-ch6-mobile.png`
- `/tmp/rock-to-rack-m7-ch6-landscape.png`

## Verification Evidence

After the Chapter 2 refinery implementation, all checks passed:

```bash
node_modules/.bin/vitest run
node_modules/.bin/tsc --noEmit
node_modules/.bin/vite build
```

Results:

- Vitest: 36/36 tests passed.
- TypeScript: passed.
- Vite production build: passed.
- Build warning remains: Phaser bundle chunk is over 500 KB after minification.

Browser smoke passed for Chapter 1 after the visual pass:

- `#ch1` loaded.
- Intro dismissed.
- Miner placement worked.
- Slot limit message appeared at 4/4 miners.
- Miner movement/removal worked.
- All five fact cards appeared.
- Mine flood and copper spike events appeared.
- Quiz emitted wrong and correct `quiz_answer` analytics events.
- Completion screen appeared.
- `Next: The Refinery` moved to `#ch2`.
- Persisted state showed Chapter 1 complete and Chapter 2 unlocked.
- No browser console errors.

Browser smoke passed for Chapter 2 after M3:

- `#ch2` loaded from fixture state with Chapter 1 complete and raw minerals available.
- Intro dismissed.
- Required module chains were placed on all four refinery lanes.
- Live store showed credits spent and refinery ticks consuming resources.
- Fact/event overlays could be dismissed and did not block progression once handled.
- Completion was accelerated through the live Vite module instance to avoid waiting several minutes.
- Field Check quiz appeared and accepted the correct "Tiny dirt can break tiny circuits" answer.
- Completion modal appeared.
- `Next: Grow and Slice` moved to `#ch3`.
- Live state showed `currentChapter = 3`, `activeScene = Ch3CrystalScene`, unlocked chapters `[1, 2, 3]`, `ch2.completed = true`, and `ch2.quizCorrect = true`.
- Browser console only reported Chromium WebGL `ReadPixels` performance warnings during screenshots; no app errors.

After the Chapter 3 grow-and-slice implementation, all fresh checks passed:

```bash
corepack pnpm test
corepack pnpm build
node -e "for (const file of ['src/content/balance.json','src/content/events.json','src/content/quiz.json','src/content/strings.json']) { JSON.parse(require('fs').readFileSync(file, 'utf8')); console.log(file + ' OK'); }"
```

Results:

- Vitest: 46/46 tests passed across 8 test files.
- TypeScript: passed via `tsc --noEmit` in the build.
- Vite production build: passed.
- Build warning remains: Phaser bundle chunk is over 500 KB after minification.
- Content JSON parse: all four edited JSON files parsed.

Browser smoke passed for Chapter 3 after M4:

- `#ch3` loaded from fixture state with Chapter 1 and Chapter 2 complete.
- Intro dismissed.
- Pull, slice, quiz, completion, and `Next: Print Circuits` transition were exercised in Chromium.
- Slice-stage smoke used a save-state resume to avoid waiting the full chapter pacing loop.
- Field Check quiz appeared and accepted the correct "They are sliced from a round crystal" answer.
- Completion modal appeared without stale quiz backdrops.
- `Next: Print Circuits` moved to `#ch4`.
- Live state showed `currentChapter = 4`, `activeScene = Ch4FabScene`, unlocked chapters `[1, 2, 3, 4]`, `resources.wafers = 8`, `ch3.completed = true`, `ch3.quizCorrect = true`, `wafersProduced = 8`, and `waferQuality = 86`.
- Desktop slice screenshot showed visible guide lines with no heat-panel overlap.
- Mobile screenshot at 390 x 844 showed HUD, status, heat panel, and action panel inside viewport with no overflow.
- Browser console only reported Chromium WebGL `ReadPixels` performance warnings during screenshots; no app errors.

After the Chapter 4 fab implementation, all fresh checks passed:

```bash
corepack pnpm test
corepack pnpm build
node -e "for (const file of ['src/content/balance.json','src/content/events.json','src/content/quiz.json','src/content/strings.json']) { JSON.parse(require('fs').readFileSync(file, 'utf8')); console.log(file + ' OK'); }"
```

Results:

- Vitest: 59/59 tests passed across 9 test files.
- TypeScript: passed via `tsc --noEmit` in the build.
- Vite production build: passed.
- Build warning remains: Phaser bundle chunk is over 500 KB after minification.
- Content JSON parse: all four edited JSON files parsed.

Browser smoke passed for Chapter 4 after M5:

- `#ch4` loaded from fixture state with Chapter 1, Chapter 2, and Chapter 3 complete.
- Intro and fact cards dismissed.
- Coat drag, expose alignment/Flash UV, etch hold/release, and dope zone clicks were exercised in Chromium.
- Dust and calibration event choices were exercised.
- Three wafers were processed through `90nm`, `28nm`, and `7nm`.
- Die-yield review map appeared with good and defective dies.
- Field Check quiz appeared and accepted the correct "Some tiny circuits come out broken" answer.
- Completion modal appeared and `Next: Package Chips` moved to `#ch5`.
- Live state showed `currentChapter = 5`, `activeScene = Ch5PackageScene`, unlocked chapters `[1, 2, 3, 4, 5]`, `resources.chips = 99`, `ch4.completed = true`, `ch4.quizCorrect = true`, `wafersProcessed = 3`, `chipsProduced = 99`, and `nodeYields.length = 3`.
- Mobile screenshot at 390 x 844 showed HUD, status, station panel, and action panel inside viewport with no overflow or panel overlap.
- Browser console only reported Chromium WebGL `ReadPixels` performance warnings during screenshots; no app errors.

After the Chapter 5 package/bin implementation, all fresh checks passed:

```bash
corepack pnpm test
corepack pnpm build
node -e "for (const file of ['src/content/balance.json','src/content/chips.json','src/content/events.json','src/content/quiz.json','src/content/strings.json']) { JSON.parse(require('fs').readFileSync(file, 'utf8')); console.log(file + ' OK'); }"
```

Results:

- Vitest: 70/70 tests passed across 10 test files.
- TypeScript: passed via `tsc --noEmit` in the build.
- Vite production build: passed.
- Build warning remains: Phaser bundle chunk is over 500 KB after minification.
- Content JSON parse: all five edited JSON files parsed.

Browser smoke passed for Chapter 5 after M6:

- `#ch5` loaded from fixture state with Chapter 4 complete and chip output available.
- Intro dismissed.
- `Dice wafer` and `Start sorting` actions worked.
- Packaging and binning fact cards appeared and dismissed.
- Dies were sorted by visible test score into Perfect, Good, and Salvage bins.
- Probe drift and substrate shortage event cards appeared and accepted choices.
- Roster stage appeared with DOM chip cards from `chips.json`.
- CPU and GPU were built from binned dies.
- Nova appeared locked.
- Field Check quiz appeared and accepted the correct `GPU / The Swarm` answer.
- Completion modal appeared and `Next: Build the Data Center` moved to `#ch6`.
- Live state showed `currentChapter = 6`, `activeScene = Ch6DatacenterScene`, unlocked chapters `[1, 2, 3, 4, 5, 6]`, `ch5.completed = true`, `ch5.quizCorrect = true`, `ch5.sortedDies = 18`, `selectedChipIds = ['cpu', 'gpu']`, and `triggeredEvents = ['probeDrift', 'substrateShortage']`.
- Mobile screenshot at 390 x 844 showed HUD, status, stage panel, roster panel, and all action buttons inside viewport. Measured mobile DOM boxes reported no overlaps.
- Browser console only reported the existing missing `favicon.ico` 404; no Chapter 5 app/runtime errors.

After the Chapter 6 data-center implementation, all fresh checks passed:

```bash
corepack pnpm test
corepack pnpm build
node --input-type=module -e "import fs from 'node:fs'; for (const file of ['src/content/balance.json','src/content/events.json','src/content/quiz.json','src/content/strings.json']) { JSON.parse(fs.readFileSync(file, 'utf8')); console.log('ok ' + file); }"
```

Results:

- Vitest: 104/104 tests passed across 11 test files.
- TypeScript: passed via `tsc --noEmit` in the build.
- Vite production build: passed.
- Build warning remains: Phaser bundle chunk is over 500 KB after minification.
- Content JSON parse: all four edited JSON files parsed.

Browser smoke passed for Chapter 6 after M7:

- `#ch6` loaded from a reset fixture path.
- Intro dismissed.
- Rack, power, cooling, network, battery, and a second rack were placed.
- CPU, NAND, GPU, DRAM, NIC, PMIC, and Nova were installed into racks.
- Cartoon Stream, Weather AI, City Backup, and Hospital Nova contracts were served.
- Heatwave and brownout event choices appeared and were accepted.
- Nova challenge unlocked Nova before the final hospital contract.
- Completion modal did not appear before the Field Check quiz (`completionBeforeQuiz = 0`).
- Field Check quiz appeared and accepted the correct heat/throttling answer.
- Victory modal appeared.
- Live state showed `currentChapter = 6`, `activeScene = Ch6DatacenterScene`, unlocked chapters `[1, 2, 3, 4, 5, 6]`, `ch6.completed = true`, `ch6.quizCorrect = true`, `stage = victory`, all four contracts served, `novaBuilt = true`, `cityLights = 100`, and triggered events `['heatwave', 'brownout']`.
- Mobile portrait at 390 x 844 and short landscape at 844 x 390 showed HUD, status, build, chip, contract, and action panels visible. Measured DOM boxes reported no overlaps, and action-button text had adequate width.
- Browser network failures were empty. Console still emitted one generic 404 resource message during desktop smoke; no Chapter 6 app/runtime errors were observed.

## M8 Implementation Summary

Codex, analytics, settings, and save polish are implemented and verified.

Implemented:

- `src/content/codex.json` with 24 Codex entries and conservative `realStat` fields.
- Pure Codex unlock/view-model logic in `src/sim/codex.ts`.
- HUD-level Codex and Settings buttons available in sandbox and Chapters 1-6.
- Menu-level Codex and Settings buttons.
- Codex overlay with locked/unlocked entries and scrollable desktop/mobile layout.
- Settings overlay with kid/nerd mode, mute, text size, reset save, and Teacher/Parent info.
- Version 2 save schema with v1 migration and future/corrupt reset handling.
- Browser analytics reporter with POST endpoint support, local debug fallback, PII-key filtering, and failure-safe transport.
- Central `chapter_start`, `chapter_end`, `factcard_opened`, `quiz_answer`, and `game_complete` reporting path.
- Duplicate `chapter_start` guard for repeated same-scene direct hash loads.

Key files:

- `src/content/codex.json`
- `src/sim/codex.ts`
- `src/sim/codex.test.ts`
- `src/analytics/analytics.ts`
- `src/analytics/analytics.test.ts`
- `src/ui/codexOverlay.ts`
- `src/ui/settingsOverlay.ts`
- `src/ui/globalPanels.ts`
- `src/ui/pipelineHud.ts`
- `src/state/gameState.ts`
- `src/state/gameStore.ts`
- `src/scenes/MenuScene.ts`
- `src/scenes/Ch1MineScene.ts`
- `src/scenes/Ch2RefineryScene.ts`
- `src/scenes/Ch3CrystalScene.ts`
- `src/scenes/Ch4FabScene.ts`
- `src/scenes/Ch5PackageScene.ts`
- `src/scenes/Ch6DatacenterScene.ts`
- `src/styles.css`

Fresh verification after M8:

```bash
corepack pnpm test
corepack pnpm build
```

Results:

- Vitest: 111/111 tests passed across 13 test files.
- TypeScript: passed via `tsc --noEmit` in the build.
- Vite production build: passed.
- Build warning remains: Phaser bundle chunk is over 500 KB after minification.

Browser smoke passed for M8:

- Dev server ran at `http://localhost:5174/` because port 5173 was already in use.
- Browser plugin was installed but no in-app browser backend was available (`agent.browsers.list()` returned `[]`), so QA used Playwright with local Chrome.
- `#ch1`, `#ch4`, and `#ch6` loaded through `?reset` and rendered nonblank pages with title `ROCK TO RACK`.
- Codex opened from the HUD and rendered `Codex x/24` on all checked routes.
- Settings opened from the HUD and text-size toggle set `body.text-large`.
- Mobile portrait `#ch6` at 390 x 844 showed Codex and Settings panels readable, scrollable, and closable.
- Analytics capture at `?reset&analyticsEndpoint=%2F__codex_analytics#ch1` recorded exactly one `chapter_start` and one `factcard_opened` after mining quartz.
- Screenshots:
  - `/tmp/rock-to-rack-m8-ch1-codex.png`
  - `/tmp/rock-to-rack-m8-ch1-settings.png`
  - `/tmp/rock-to-rack-m8-ch4-codex.png`
  - `/tmp/rock-to-rack-m8-ch4-settings.png`
  - `/tmp/rock-to-rack-m8-ch6-codex.png`
  - `/tmp/rock-to-rack-m8-ch6-settings.png`
  - `/tmp/rock-to-rack-m8-ch6-mobile-codex.png`
  - `/tmp/rock-to-rack-m8-ch6-mobile-settings.png`
  - `/tmp/rock-to-rack-m8-analytics-fact.png`

Known residual note:

- A generic browser console 404 appeared on `#ch1` during one smoke pass, with no captured app response and no page error. This matches the earlier missing default asset behavior and did not block gameplay or panels.

## M9 Implementation Summary

Balance pass and playtest instrumentation are implemented and verified.

Implemented:

- Pure pace math in `src/sim/pace.ts` with catch-up threshold and multiplier support.
- Headless six-chapter simulator in `src/sim/playthroughSimulator.ts`.
- `corepack pnpm simulate` script that prints a stable M9 simulation report.
- Balance tuning in `src/content/balance.json`, including top-level catch-up settings.
- Positive-only catch-up hooks in Chapters 1, 2, 3, and 6.
- Debug progress event wiring across Chapters 1-6.
- `?debug=1` overlay with chapter jump buttons, resource-rate rows, and bounded resource grants.
- Store-level `grantDebugResources()` helper.
- Mobile debug overlay responsive placement so Codex and Settings remain tappable.
- Economy helper regression fix so adding a partial delta no longer clamps unrelated over-cap resources.

Key files:

- `src/sim/pace.ts`
- `src/sim/pace.test.ts`
- `src/sim/playthroughSimulator.ts`
- `src/sim/playthroughSimulator.test.ts`
- `src/sim/economy.ts`
- `src/sim/economy.test.ts`
- `src/ui/debugOverlay.ts`
- `src/ui/debugOverlay.test.ts`
- `src/scenes/debugProgress.ts`
- `src/main.ts`
- `src/state/eventBus.ts`
- `src/state/gameStore.ts`
- `src/scenes/Ch1MineScene.ts`
- `src/scenes/Ch2RefineryScene.ts`
- `src/scenes/Ch3CrystalScene.ts`
- `src/scenes/Ch4FabScene.ts`
- `src/scenes/Ch5PackageScene.ts`
- `src/scenes/Ch6DatacenterScene.ts`
- `src/content/balance.json`
- `src/styles.css`
- `docs/superpowers/reports/2026-07-08-m9-simulation-report.md`

Fresh verification after M9:

```bash
corepack pnpm simulate
corepack pnpm test
corepack pnpm build
```

Results:

- Simulator: fast 63.2 min, average 84.0 min, slow 86.6 min; all profiles completed all six chapters.
- Vitest: 129/129 tests passed across 16 test files.
- TypeScript: passed via `tsc --noEmit` in the build.
- Vite production build: passed.
- Build warning remains: Phaser bundle chunk is over 500 KB after minification.

Browser smoke passed for M9:

- Dev server ran at `http://localhost:5173/`.
- `?reset&debug=1#ch1` showed the debug overlay, a nonblank canvas, and a working `+Credits` grant.
- Debug scene jump from Ch1 to Ch4 reloaded to `#ch4` and remounted the overlay as `Debug Ch4`.
- `?reset&debug=1#ch6` at 390 x 844 showed a readable mobile debug overlay without blocking Codex or Settings.
- Mobile Ch6 `+Chips` grant preserved unrelated credits at 1150.
- Codex and Settings opened and closed successfully on mobile with the debug overlay present.
- Screenshots:
  - `/tmp/rock-to-rack-m9-debug-ch1.png`
  - `/tmp/rock-to-rack-m9-debug-ch4.png`
  - `/tmp/rock-to-rack-m9-debug-ch6-mobile.png`
- The known missing `/favicon.ico` 404 was ignored; no app/runtime console errors or page errors were observed.

## M10 Local Ship Readiness Summary

Local M10 ship prep is implemented and verified. Public Vercel URL is live at `https://rock-to-rack.vercel.app/`.

Implemented:

- OpenGraph/Twitter metadata in `index.html`.
- Deterministic SVG cover image at `public/og-cover.svg`.
- SVG favicon plus real `/favicon.ico` fallback.
- `public/site.webmanifest`.
- Static `public/404.html` that redirects back to `/#menu`.
- `vercel.json` static fallback and cache headers.
- Loading screen with fun-fact rotator and Phaser post-boot hide callback.
- Production-gated service worker with navigation-only network-first fallback.
- Feedback helper and optional menu button; button stays hidden until `SITE_METADATA.feedbackHref` is set.
- M10 browser smoke script with console/page/network failure capture and menu-to-Ch1 transition.
- M10 performance smoke script with bundle-size and first-playable checks.
- README with pitch, demo routes, dev commands, ship checks, and deploy boundary.

Key files:

- `README.md`
- `index.html`
- `vercel.json`
- `public/favicon.svg`
- `public/favicon.ico`
- `public/og-cover.svg`
- `public/site.webmanifest`
- `public/404.html`
- `public/sw.js`
- `src/ship/siteMetadata.ts`
- `src/ship/siteMetadata.test.ts`
- `src/ship/staticFiles.test.ts`
- `src/ship/registerServiceWorker.ts`
- `src/ship/registerServiceWorker.test.ts`
- `src/ui/loadingScreen.ts`
- `src/ui/loadingScreen.test.ts`
- `src/ui/feedbackLink.ts`
- `src/ui/feedbackLink.test.ts`
- `src/ui/menuOverlay.ts`
- `src/scenes/MenuScene.ts`
- `src/game/createGame.ts`
- `src/main.ts`
- `tools/m10-browser-smoke.mjs`
- `tools/m10-performance-smoke.mjs`

Fresh verification after local M10:

```bash
corepack pnpm verify:static
corepack pnpm simulate
corepack pnpm test
corepack pnpm build
corepack pnpm perf:m10
corepack pnpm smoke:m10
curl -I http://localhost:4173/favicon.ico
```

Results:

- Static tests: 7/7 passed.
- Simulator: fast 63.2 min, average 84.0 min, slow 86.6 min; all profiles completed all six chapters.
- Vitest: 141/141 tests passed across 21 test files.
- TypeScript: passed via `tsc --noEmit` in the build.
- Vite production build: passed.
- Build warning remains: Phaser bundle chunk is over 500 KB after minification.
- Performance smoke: total dist bytes 1,805,649; first playable 862 ms on local preview.
- Browser smoke: Chrome desktop and mobile passed against `http://localhost:4173/`.
- `/favicon.ico`: HTTP 200, `Content-Type: image/x-icon`.

Vercel deploy results:

- One-off CLI: `corepack pnpm dlx vercel` with Vercel CLI 54.21.0.
- Created Vercel project: `rock-to-rack`.
- Linked local folder to Vercel; `.vercel/` and `.env.local` were created by Vercel and are ignored by `.gitignore`.
- Deploy command used: `corepack pnpm dlx vercel deploy --yes --target preview --logs`.
- Vercel result: deployment ready, `target: production`, public alias `https://rock-to-rack.vercel.app/`.
- Generated deployment URL `https://rock-to-rack-luh7pfvcg-omar-zafars-projects.vercel.app/` is SSO-protected and not suitable as the public preview URL.
- Public smoke passed against `https://rock-to-rack.vercel.app/`.
- Public `/favicon.ico` returns HTTP 200, `Content-Type: image/vnd.microsoft.icon`.

Browser smoke evidence:

- `/tmp/rock-to-rack-m10-menu.png`
- `/tmp/rock-to-rack-m10-ch1.png`
- `/tmp/rock-to-rack-m10-ch6-mobile.png`

Residual M10 checkpoints:

- Vercel deploy has been run. Although the command omitted `--prod`, Vercel returned a production target and aliased the public URL.
- No further production promotion command was run after this.
- Feedback link target is not configured; set `SITE_METADATA.feedbackHref` to a real mailto/form URL before public launch.
- Firefox/WebKit automated checks were skipped because local Playwright browser binaries are not installed.
- Safari and full 90-minute desktop/tablet playthrough are still manual verification items.
- Lighthouse was not run because that would require an approved Lighthouse install or available binary.

## Constraints for Future Agents

- Keep mechanics in `src/sim/` pure and covered by Vitest.
- Keep Phaser scenes focused on rendering, input, timing, and overlay mounting.
- Keep text and balance values in JSON content files.
- Do not make the Chapter 1 screen denser again; protect the playfield.
- Use screenshots for visual QA. DOM assertions alone missed layout quality issues.
- For Chapter 3 smoke tests, state-resume acceleration is acceptable after verifying boot/input surfaces; otherwise the natural pacing loop takes several minutes.
- For Chapter 4 smoke tests, exercise all four station input surfaces at least once before using any acceleration or fixture setup.
- For Chapter 5 smoke tests, use Chrome via Playwright `executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'` if the bundled Playwright browser is not installed.
- For Chapter 5 mobile QA, verify both screenshots and DOM bounding boxes because action-panel wrapping can create overlap even when desktop looks clean.
- For Chapter 6 QA, run at least one full desktop smoke from build placement through victory, then check both 390 x 844 portrait and 844 x 390 short landscape. Visual inspection caught action-button text collision that basic overlap checks missed.
- For M9 debug QA, run the app with `?debug=1` and verify the overlay after real scene mounts; direct DOM unit tests will not catch Phaser `replaceChildren()` wiping or mobile pointer interception.
- For M10 smoke, use `corepack pnpm preview -- --host localhost --port 4173`, then `corepack pnpm perf:m10` and `corepack pnpm smoke:m10`.
- For Vite browser verification, importing singleton modules from Playwright may require using the exact loaded resource URL from `performance.getEntriesByType('resource')`, because Vite hot-update query strings can create a different module instance.
- This directory is not currently a git repo, so commit-based workflow rules cannot be satisfied unless the project is initialized or moved into a repo.

## Likely Next Step

Proceed to post-M12 playability validation only after the user confirms the next target.

Recommended next checks:

1. Configure real feedback link if desired.
2. Run manual Safari/tablet and longer playthrough checks.
3. Playtest `#crisis` with a cold player and tune the score/completion loop from observed friction.
4. Decide whether to refresh the public Vercel deployment with M12.

## M11 Wide Playability Cut

M11 added a new `#crisis` Crisis Run path from the menu. It is separate from the six-chapter Learn Mode campaign, starts without mandatory dialogue, gives the player immediate datacenter placement input, records local Crisis Run score history, stores the best run in save metadata, and shows a compact result card with replay/menu actions.

Implemented:

- `src/sim/crisisRun.ts` pure score, grade, history, and best-run helpers.
- `GameState.meta` save schema for crisis run history and best run.
- Menu split between `Crisis Run` and `Learn Mode`.
- New `SceneKey.CrisisRun` and `#crisis` route.
- `src/scenes/CrisisRunScene.ts` compact playable datacenter crisis mode.
- `src/ui/crisisRunOverlay.ts` objective/build/result overlay.
- Dialogue skip support via `src/ui/dialogueOverlay.ts`.
- `tools/m11-browser-smoke.mjs` and `corepack pnpm smoke:m11`.
- `tools/m10-browser-smoke.mjs` updated to use `Learn Mode` for the campaign route.

Verification:

```bash
corepack pnpm simulate
corepack pnpm test
corepack pnpm verify:static
corepack pnpm build
corepack pnpm smoke:m10
corepack pnpm smoke:m11
```

Results:

- Simulator: 5/5 passed.
- Vitest: 163/163 passed across 26 files.
- Static verification: 7/7 passed.
- TypeScript and Vite production build passed.
- Existing build warning remains: Phaser bundle chunk is over 500 KB after minification.
- M10 Chrome desktop/mobile smoke passed after updating the campaign selector to `Learn Mode`; Firefox/WebKit optional checks still skipped because local Playwright browser binaries are not installed.
- M11 Chrome desktop/mobile smoke passed against `http://localhost:4173/`.

Screenshot evidence:

- `/tmp/rock-to-rack-m11-menu.png`
- `/tmp/rock-to-rack-m11-crisis.png`
- `/tmp/rock-to-rack-m11-result.png`
- `/tmp/rock-to-rack-m11-mobile.png`

Residual M11 risks:

- Crisis Run is a first replay spine, not a full economy or strategy redesign.
- Chapter 6 campaign finale still needs the separate dashboard/payoff redesign identified in the wide-playability audit.
- Keyboard coverage improves in Crisis Run, but all six campaign chapters still need a broader accessibility pass.
- M11 has not been deployed to the public Vercel URL in this pass.

## M12 Replay Loop

M12 tightened Crisis Run replay behavior. Result cards now show run number, best-score comparison copy, next target score, and a replay button labeled with the score to beat. Replay restarts into a fresh run, clears the previous result modal, keeps `Serve Nova` disabled until rebuilt, and returns to menu with the persisted best-run summary.

Implemented:

- `compareCrisisRunToBest` in `src/sim/crisisRun.ts`.
- Replay comparison tests in `src/sim/crisisRun.test.ts`.
- Run number, comparison summary, and next target UI in `src/ui/crisisRunOverlay.ts`.
- Result-card regression coverage in `src/ui/crisisRunOverlay.test.ts`.
- Timer/keyboard cleanup and replay metadata wiring in `src/scenes/CrisisRunScene.ts`.
- `tools/m12-replay-smoke.mjs` and `corepack pnpm smoke:m12`.

Verification:

```bash
corepack pnpm vitest run src/sim/crisisRun.test.ts src/ui/crisisRunOverlay.test.ts
corepack pnpm simulate
corepack pnpm test
corepack pnpm verify:static
corepack pnpm build
corepack pnpm smoke:m12
```

Results:

- Focused replay tests: 11/11 passed.
- Simulator: 5/5 passed.
- Vitest: 167/167 passed across 26 files.
- Static verification: 7/7 passed.
- TypeScript and Vite production build passed.
- Existing build warning remains: Phaser bundle chunk is over 500 KB after minification.
- M12 Chrome replay smoke completed two Crisis Runs in one browser session against `http://localhost:4173/`.

Screenshot evidence:

- `/tmp/rock-to-rack-m12-replay-result.png`

Residual M12 risks:

- Replay is now explicit, but score tuning is still shallow; cold-player testing should determine whether the target feels motivating.
- M12 has not been deployed to the public Vercel URL in this pass.
