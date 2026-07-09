# YC Readiness Check - Rock to Rack

Date: 2026-07-09
Workspace: `/Users/omar/Downloads/Game`
Preview checked: `http://127.0.0.1:4173/`

## Verdict

The game is locally shippable for a YC demo from the current built surface. Unit tests, static checks, TypeScript, production build, Chromium browser smokes, replay smoke, and isolated first-playable performance all pass.

The two material readiness risks are operational:

1. This workspace is not a git repository, so it cannot be committed, tagged, pushed, or PR-reviewed from this folder until it is placed under version control.
2. The production JS bundle is still a single large chunk: `1,800.62 kB` minified, `428.78 kB` gzip. First playable passed locally, but code splitting remains the main performance hardening item before broader traffic.

## Verification

Fresh checks run in this pass:

| Check | Result |
|---|---|
| `corepack pnpm test` | Pass: 34 test files, 187 tests. |
| `corepack pnpm simulate` | Pass: fast, average, and slow profiles complete all six chapters; totals stay around the 10-minute target. |
| `corepack pnpm verify:static` | Pass: 2 static test files, 7 tests. |
| `corepack pnpm build` | Pass: `tsc --noEmit` and Vite production build. |
| `corepack pnpm smoke:m10` | Pass in Chromium; desktop menu, CH1, mobile CH6, metadata. Firefox/WebKit optional checks skipped because those Playwright browsers are not installed. |
| `corepack pnpm smoke:m11` | Pass in Chromium; Crisis Run placement and result path. |
| `corepack pnpm smoke:m12` | Pass in Chromium; replay loop and best-run return to menu. |
| `corepack pnpm perf:m10` | Pass when run alone: `totalBytes` 1,861,250; latest `firstPlayableMs` 725. |
| HTTP preview checks | `/`, `/site.webmanifest`, and `/404.html` returned 200 from Vite preview. |

One concurrent performance run measured `firstPlayableMs` at 12,076 ms while three Playwright browser smokes were running at the same time. A transient rerun immediately after rebuild also hit an HTTP navigation error before a successful rerun. The isolated final rerun passed, so keep the preview server healthy and do not run the performance smoke in parallel with other browser tests.

## Codebase Hygiene

Findings from source scans:

- No `TODO`, `FIXME`, `HACK`, `debugger`, `@ts-ignore`, or `@ts-expect-error` markers in `src/`, `tools/`, `public/`, `index.html`, or README.
- No apparent committed secrets in source. `.env.local` exists locally and is excluded by `.gitignore`; `.codexignore` now excludes `.env*`, `.vercel/`, `.playwright-mcp/`, and `.DS_Store`.
- No non-build, non-`node_modules` files larger than 1 MB were found.
- The shipped `dist/` contains only expected public assets: `index.html`, `404.html`, `favicon` files, `og-cover.svg`, `site.webmanifest`, `sw.js`, and one built JS/CSS pair.
- `vercel.json` intentionally rewrites all routes to `/index.html`; Vite preview returning the app shell for arbitrary paths is expected SPA behavior.

Maintainability notes:

- The architecture is understandable: pure simulation modules live under `src/sim/`, presentation overlays under `src/ui/`, Phaser scenes under `src/scenes/`, and ship metadata under `src/ship/`.
- The main long-term complexity is scene size. `Ch5PackageScene.ts`, `Ch6DatacenterScene.ts`, and `Ch4FabScene.ts` are each about 1,000 lines. Do not refactor them before the YC demo, but future feature work should extract repeated scene helpers instead of adding more scene-local logic.
- README now lists the current full ship-check sequence, including the M11 and M12 browser smokes.

## Demo Recommendation

For YC, lead with `Crisis Run` as the fast hook, then show `Learn Mode` as proof that the same system teaches the full supply chain. The smoke-tested pitch path is:

1. Main menu at `/#menu`.
2. `Crisis Run`, place rack, power, cooling, and network.
3. Serve Nova and show the result card.
4. Replay once to show the retention loop.
5. Switch to `Learn Mode` or deep link `/?reset#ch1` for the educational campaign.

## Remaining Before Public Push

1. Put this workspace under git or copy it into the canonical repository before shipping from source control.
2. Re-run the full ship checks after any copy, deploy, or environment change.
3. Consider code splitting after the YC demo path is stable.
4. Optional: install Firefox/WebKit Playwright browsers and rerun optional cross-browser smoke coverage.
