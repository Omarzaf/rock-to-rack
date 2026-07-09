# Fable 5 Project Report - Rock to Rack

Date: 2026-07-09
Workspace: `/Users/omar/Downloads/Game`
Audience: Fable 5 or any future agent that needs complete project context before acting.

## Executive Summary

Rock to Rack is a Phaser 3.90, Vite, TypeScript browser game about the semiconductor supply chain. It is currently locally shippable for a YC demo from the built surface. The fast pitch path is Crisis Run first, then Learn Mode as proof that the same system teaches the full supply chain.

The most important caveat: this workspace is not a git repository. Do not assume commits, branches, tags, PR review, or push are possible from `/Users/omar/Downloads/Game` until the project is copied into or initialized as the canonical repository.

## Product Concept

The player builds a chip pipeline from minerals to a working data center:

1. Mine minerals.
2. Refine silicon and other inputs.
3. Grow and slice wafers.
4. Fabricate circuits.
5. Package and bin chips.
6. Power a data center.
7. Run the timed Crisis Run challenge.

The game has two primary player paths:

- `Crisis Run`: fast 5-minute challenge and best YC demo hook.
- `Learn Mode`: guided campaign through the full semiconductor supply chain.

## Demo Routes

- Main menu: `/#menu`
- Chapter 1: `/?reset#ch1`
- Chapter 4 fab demo: `/?reset#ch4`
- Chapter 6 data-center finale: `/?reset#ch6`
- Crisis Run: `/?reset#crisis`
- Debug overlay: `/?reset&debug=1#ch6`

Recommended YC demo sequence:

1. Open `/#menu`.
2. Click `Crisis Run`.
3. Place rack, power, cooling, and network.
4. Click `Serve Nova`.
5. Show the result card.
6. Replay once to show the loop.
7. Switch to Learn Mode or deep link to `/?reset#ch1`.

## Current Implementation State

Implemented and verified:

- M1: shared resource, HUD, dialogue, fact-card, event, and save foundations.
- M2: Chapter 1 Mine.
- M3: Chapter 2 Refinery.
- M4: Chapter 3 Grow and Slice.
- M5: Chapter 4 Fab.
- M6: Chapter 5 Package.
- M7: Chapter 6 Rack Up / Data Center Integration.
- M8: Codex, analytics, settings, and save polish.
- M9: balance simulation and debug playtest instrumentation.
- M10: ship-prep assets, metadata, service worker, README, browser smoke, and performance smoke.
- M11: Crisis Run mode.
- M12: Crisis Run replay loop.

Current handoff source: `docs/agent-context.md`.
Final readiness source: `docs/audits/2026-07-09-yc-readiness-check/report.md`.

## Architecture Map

Top-level stack:

- Runtime: Phaser 3.90.
- Build: Vite 6.
- Language: TypeScript strict mode.
- Package manager: pnpm through Corepack.
- Tests: Vitest plus Playwright-driven smoke scripts.
- Deployment target: Vercel preview by default.

Important directories:

- `src/scenes/`: Phaser scenes and chapter runtime logic.
- `src/sim/`: pure simulation modules with tests. Prefer changing these before scene code when tuning rules.
- `src/ui/`: DOM overlays, HUDs, menus, settings, Codex, dialogue, result cards.
- `src/state/`: central game state, save/hydration, event bus.
- `src/content/`: balance, strings, chips, quiz, events, Codex content, sources.
- `src/ship/`: metadata and production service-worker registration checks.
- `tools/`: browser smoke and performance scripts.
- `docs/audits/`: product, UX, polish, and readiness reports.
- `docs/superpowers/`: milestone plans and simulation report.

Main files:

- `src/main.ts`: app entrypoint, analytics transport, loading screen, debug overlay, game boot.
- `src/game/createGame.ts`: Phaser game config.
- `src/scenes/index.ts`: registered scene list.
- `src/scenes/MenuScene.ts`: main menu.
- `src/scenes/CrisisRunScene.ts`: timed challenge.
- `src/state/gameState.ts`: state transitions and persistence model.
- `src/content/balance.json`: tuning source for chapter pacing and mechanics.
- `src/content/strings.json`: player-facing copy.
- `README.md`: current development and ship commands.

## Verification Snapshot

Fresh final-check results:

- `corepack pnpm test`: passed, 34 test files and 187 tests.
- `corepack pnpm simulate`: passed; fast, average, and slow profiles complete all six chapters.
- `corepack pnpm verify:static`: passed, 2 files and 7 tests.
- `corepack pnpm build`: passed TypeScript and Vite production build.
- `corepack pnpm smoke:m10`: passed in Chromium.
- `corepack pnpm smoke:m11`: passed in Chromium.
- `corepack pnpm smoke:m12`: passed in Chromium.
- `corepack pnpm perf:m10`: passed when run alone, `totalBytes` 1,861,250 and latest `firstPlayableMs` 725.

Known verification constraints:

- Firefox and WebKit optional Playwright checks were skipped because those browser binaries are not installed.
- The production bundle is one large JS chunk: about `1,800.62 kB` minified and `428.78 kB` gzip.
- Vite preview rewrites arbitrary paths to `index.html`; that is expected because `vercel.json` defines SPA fallback routing.

## How To Run The Project

Install dependencies:

```bash
corepack pnpm install
```

Develop locally:

```bash
corepack pnpm dev
```

Run deterministic checks:

```bash
corepack pnpm test
corepack pnpm simulate
corepack pnpm build
corepack pnpm verify:static
```

Run browser checks:

```bash
corepack pnpm preview --host 127.0.0.1
```

In another terminal:

```bash
corepack pnpm smoke:m10
corepack pnpm smoke:m11
corepack pnpm smoke:m12
corepack pnpm perf:m10
```

Important: run `perf:m10` by itself, not in parallel with browser smokes.

## What Not To Do

- Do not promote a Vercel deployment to production without explicit current-session approval.
- Do not submit forms, send email, or make external outreach from this project.
- Do not assume this folder can be committed or pushed; it is not currently a git repository.
- Do not refactor the large chapter scenes before the YC demo unless there is a direct blocking bug.
- Do not run `perf:m10` concurrently with the smoke tests.
- Do not expose `.env.local`, `.vercel/`, `.playwright-mcp/`, screenshots, or generated build output as source context.

## Mistakes Made During The Final Check

These are the concrete mistakes or near-mistakes from the final readiness pass. Future agents should avoid repeating them.

1. I attempted `git status` and `git log` before confirming this directory was a git repository.
   - Result: both commands failed with `fatal: not a git repository`.
   - Lesson: first treat this workspace as source files plus build artifacts, not as a checked-out repo.

2. I started Vite preview inside the sandbox first.
   - Result: `listen EPERM` on `127.0.0.1:4173`.
   - Fix used: reran preview with the required local-server permission.
   - Lesson: local server binding may require escalation in this environment.

3. I ran Playwright smoke scripts inside the sandbox first.
   - Result: Chromium failed before reaching the app because macOS browser IPC registration was denied.
   - Fix used: reran browser smoke scripts with browser-process permission.
   - Lesson: a browser-launch failure is not an app failure; verify whether the error occurs before navigation.

4. I ran the performance smoke concurrently with three browser smoke scripts.
   - Result: `firstPlayableMs` falsely measured 12,076 ms against a 5,000 ms threshold.
   - Fix used: reran `perf:m10` alone; it passed, latest `firstPlayableMs` 725.
   - Lesson: performance smoke must run alone to avoid local contention.

5. A post-build perf rerun briefly hit `page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE`.
   - Result: the check failed before an app assertion.
   - Fix used: confirmed `curl -I` returned 200 for both `localhost:4173` and `127.0.0.1:4173`, then reran successfully.
   - Lesson: after rebuilds, confirm the preview endpoint is healthy before interpreting Playwright navigation failures.

6. I initially wrote README ship commands as a single command block containing `preview` followed by smoke commands.
   - Problem: `corepack pnpm preview --host 127.0.0.1` is a blocking server process, so the commands cannot run sequentially in one terminal.
   - Fix used: split README into deterministic checks, preview server terminal, and browser-check terminal.
   - Lesson: handoff docs must be executable as written.

## Important Issues Identified

Operational:

- Not a git repo. This is the main blocker for source-control shipping.
- Production bundle is large and not code-split.
- Firefox/WebKit Playwright browsers are missing.
- `.env.local` exists locally; it is ignored, but future agents must not reveal or copy it.

Product and UX:

- Crisis Run is the best demo hook and should be shown before Learn Mode.
- Chapter 6 remains a dense dashboard relative to the rest of the game; do not expand it further without staged disclosure.
- Mobile Crisis Run currently passes smoke, but grid prominence and cognitive load remain design risks from earlier audits.
- Keyboard and screen-reader completeness across all chapter canvas interactions is not fully verified.
- Feedback plumbing exists but is hidden until `SITE_METADATA.feedbackHref` is configured.

Code maintainability:

- The architecture is understandable, but several scene files are large:
  - `src/scenes/Ch5PackageScene.ts`
  - `src/scenes/Ch6DatacenterScene.ts`
  - `src/scenes/Ch4FabScene.ts`
- Future work should extract shared scene helpers only when adding real features or fixing real bugs.
- Keep simulation rules in `src/sim/` and presentation in `src/ui/` where possible.

## Ship Readiness Verdict

Ready for a local YC demo:

- Build passes.
- Tests pass.
- Browser smoke passes in Chromium.
- Replay loop passes.
- First playable is below the smoke threshold when measured correctly.
- Demo path is clear.

Not fully ready for source-control/public release until:

1. The workspace is under git or copied into the canonical repo.
2. The full ship checks are rerun from that canonical repo.
3. Any deploy target is verified after the copy.
4. Optional cross-browser Playwright binaries are installed and checked.

## Next Agent Instructions

If you are Fable 5 reading this:

1. Start with `README.md`, this file, and `docs/agent-context.md`.
2. Check whether `/Users/omar/Downloads/Game` has become a git repo before using any git workflow.
3. Run `corepack pnpm test` and `corepack pnpm build` before touching implementation.
4. If doing browser QA, start `corepack pnpm preview --host 127.0.0.1` and run smoke scripts from another terminal.
5. Keep edits narrow. This project is already demo-ready; avoid broad redesigns before YC.
6. If asked to ship publicly, first solve the canonical-repo/git problem and re-verify from that location.
