# Gameplay Audit Agent Report

Read-only audit. No edits. No network.

## Findings

### [BLOCK] No Durable Reason To Return After Chapter 6

Player experience: the campaign ends, shows an epilogue, and drops the player back to the menu. There is no postgame loop, score chase, daily run, New Game+, or alternate mode that would make a completed file worth revisiting.

Evidence: `src/scenes/Ch6DatacenterScene.ts:582-607` sends the player back to `SceneKey.Menu`; `src/scenes/ChapterStubScene.ts:28-45` only offers linear next-chapter or menu navigation; `src/state/gameState.ts:7-102` stores chapter completion and resources, but no lasting meta-progression or replay framework; `src/scenes/sceneRouting.ts:3-16` only routes among menu, sandbox, and chapters 1-6.

Owner: progression/state/menu flow.

Fix direction: add a repeatable endgame layer or mastery loop that survives a full clear, so completion unlocks another reason to play rather than the end of the experience.

### [WARN] The Onboarding Cadence Is Hard-Gated And Stop-Start In Every Chapter

Player experience: each chapter begins with a mandatory dialogue pause before any interaction, and completion is always gated by a quiz that can re-open on wrong answers. That means the player spends a lot of time dismissing overlays instead of learning through play.

Evidence: `src/scenes/Ch1MineScene.ts:452-463` and `535-569`; `src/scenes/Ch2RefineryScene.ts:396-407` and `510-543`; `src/scenes/Ch3CrystalScene.ts:508-544`; `src/scenes/Ch4FabScene.ts:808-844`; `src/scenes/Ch6DatacenterScene.ts:419-439` and `531-577`.

Owner: chapter UI/overlay flow.

Fix direction: keep first-run teaching, but make later intros and quizzes lighter, optional, or one-time so repeat sessions get to the mechanics faster.

### [WARN] The Core Loop Is Mostly A Checklist Of Fixed Solutions, Not A System With Competing Strategies

Player experience: Chapter 1 lets you swap miners with a full refund, Chapter 2 only advances when the exact module chain is installed, Chapter 5 sorts a precomputed die sample into fixed bins, and Chapter 6 mostly validates fixed chip/compute/network requirements before serving contracts. That structure teaches the supply chain, but it leaves little room for different viable approaches or meaningful recovery after mistakes.

Evidence: `src/sim/mining.ts:222-259` refunds miner removal; `src/sim/refinery.ts:148-171` and `193-258` require exact ordered lane modules and then tick deterministic progress; `src/sim/package.ts:118-245` precomputes die bins and gates chip building on bin counts; `src/sim/datacenter.ts:256-335` checks contract requirements against installed chips and infrastructure.

Owner: sim/mechanics design.

Fix direction: introduce at least one persistent tradeoff per chapter, so players can choose between multiple viable builds instead of following a single obvious path.

### [WARN] The Full Campaign Is Long For A Browser Game, But The Stakes Stay Soft

Player experience: the shipped simulation reports full-run times of 63.2 minutes for fast, 84.0 minutes for average, and 86.6 minutes for slow, with catch-up triggered in every chapter for the slow profile. Meanwhile the actual gameplay mostly surfaces misses as retry prompts or blocked-state messages rather than hard consequences, so the session is long without being tense.

Evidence: local `corepack pnpm simulate` output; `src/content/balance.json:18-23` and `63-66`, `138-141`, `234-237` set long pacing windows; `src/sim/pace.ts:33-53` only boosts catch-up when behind; chapter scenes repeatedly handle blocked actions by setting `lastMessage` and refreshing overlays rather than changing the run state.

Owner: pacing/balance across sim and chapter scenes.

Fix direction: shorten the first completion path or split the experience into smaller runnable chunks, and give players clearer success/failure pressure so runtime feels intentional instead of merely long.

## Coverage

- Scenes: `src/scenes/Ch1MineScene.ts`, `src/scenes/Ch2RefineryScene.ts`, `src/scenes/Ch3CrystalScene.ts`, `src/scenes/Ch4FabScene.ts`, `src/scenes/Ch5PackageScene.ts`, `src/scenes/Ch6DatacenterScene.ts`, `src/scenes/MenuScene.ts`, `src/scenes/ChapterStubScene.ts`, `src/scenes/sceneRouting.ts`
- Sim: `src/sim/mining.ts`, `src/sim/refinery.ts`, `src/sim/crystal.ts`, `src/sim/fab.ts`, `src/sim/package.ts`, `src/sim/datacenter.ts`, `src/sim/pace.ts`, `src/sim/economy.ts`, `src/sim/events.ts`, `src/sim/playthroughSimulator.ts`
- Content: `src/content/balance.json`, `src/content/events.json`, `src/content/strings.json`, `src/content/chips.json`
- State/docs/tests: `src/state/gameState.ts`, `src/state/types.ts`, `README.md`, `docs/agent-context.md`, `src/sim/playthroughSimulator.test.ts`, `src/scenes/sceneRouting.test.ts`, `src/content/contentCoherence.test.ts`
