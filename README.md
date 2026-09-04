# Rock to Rack

Rock to Rack is a browser game about the semiconductor supply chain. Players mine minerals, refine silicon, grow wafers, print circuits, package chips, and power a data center while trying to bring a public-interest AI workload online.

![Rock to Rack social cover](public/og-cover.svg)

## Status

Rock to Rack is a publicly viewable, playable prototype with a live demo at `https://rock-to-rack.vercel.app`. The current repository is maintained as a reproducible game build and evaluation surface, not as reusable open-source software.

## Play

- Live build: `https://rock-to-rack.vercel.app`
- Fast challenge: `/` or `/?reset#crisis`
- Guided campaign: `/#menu`

The game is designed for a quick demo path and a fuller six-chapter learning path. It runs in a modern browser and saves progress locally.

## Game Modes

- Crisis Run: a timed rescue challenge where players balance racks, power, cooling, chips, and city lights.
- Learn the Chain: a six-chapter campaign that follows the path from raw minerals to a running data center.
- Kid and Nerd text modes: simplified or more technical wording for different audiences.

## Supply Chain Covered

```text
Mine -> Refine -> Grow -> Fab -> Package -> Power
```

The chapters cover mining, refining, crystal growth and wafer slicing, fabrication, packaging/binning, and data-center deployment.

## Demo Routes

- Crisis Run front door: `/` or `/?reset#crisis`
- Main menu: `/#menu`
- Chapter 1: `/?reset#ch1`
- Chapter 4 fab demo: `/?reset#ch4`
- Chapter 6 data-center finale: `/?reset#ch6`
- Debug overlay: `/?reset&debug=1#ch6`

## Setup

Rock to Rack targets Node 22 and the repo-pinned `pnpm@11.10.0`.

If `pnpm` is not already available on your `PATH`, run `corepack enable` once for your local Node installation. On some systems that step may require elevated write access to the Node shim directory.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

## Documentation

- User manual: `docs/USER_MANUAL.md`
- Agent context: `docs/agent-context.md`
- Cold playtest script: `docs/playtests/2026-07-09-cold-playtest-script.md`
- Cold playtest notes template: `docs/playtests/2026-07-09-cold-playtest-notes-template.md`
- Award submission checklist: `docs/submission/2026-07-09-award-submission-checklist.md`

## Verification

```bash
corepack pnpm build
corepack pnpm test
corepack pnpm verify:static
corepack pnpm simulate
```

For the existing browser smoke path, serve the production build in a second terminal:

```bash
corepack pnpm preview --host 127.0.0.1
```

Then run the existing Chromium smoke against `http://127.0.0.1:4173/`:

```bash
corepack pnpm smoke:m11
```

Additional browser and performance checks remain available when needed:

```bash
corepack pnpm smoke:m10
corepack pnpm smoke:m12
corepack pnpm smoke:m13
corepack pnpm perf:m10
```

Run `perf:m10` by itself, not in parallel with the browser smokes, so first-playable timing is not distorted by local contention.

The browser smoke scripts keep running even if Firefox or WebKit are not installed. When those binaries are missing, the scripts report them as unavailable instead of making installation a hidden prerequisite for the normal local ship path.

## Public Pitch

10 minutes, kids to CTOs, browser tab. Players feel the tradeoffs behind chips: resource constraints, yield, binning, heat, power, and data-center demand.

## Limitations

- The game is built for modern desktop and tablet browsers; unsupported browsers or low-powered devices may degrade the experience.
- Progress is stored locally in the browser rather than synced across devices.
- Feedback submission is disabled until `SITE_METADATA.feedbackHref` is configured with a real contact endpoint.
- The repository contains code, assets, audio, artwork, and prose under restricted rights; public visibility does not grant reuse permission.

## Feedback

Feedback plumbing is implemented but hidden until `SITE_METADATA.feedbackHref` is configured with a real mailto or form URL.

## Support

Open a GitHub issue for reproducible bugs, factual corrections, or documentation gaps. This repository inherits the owner's account-level support, issue, pull-request, and security guidance. There is no response-time guarantee or security support promise for external operators.

## Cold Playtests

Use `docs/playtests/2026-07-09-cold-playtest-script.md` for the human-run 3-5 player pass before award submission. Keep tester names, contact details, and recordings out of the repo unless they are explicitly anonymized. Use `docs/playtests/2026-07-09-cold-playtest-notes-template.md` for private, anonymous observer notes.

## Award Submission

Use `docs/submission/2026-07-09-award-submission-checklist.md` as the manual gate before any award submission. Agents may prepare evidence and copy, but Umar performs any production promotion or submission.

## Deployment

Build output lives in `dist/`. Vercel preview deploy is the default shipping target. Production promotion requires explicit human approval.

## Maintainer

Maintained by Muhammad Umar Zafar. For project context and operating notes, start with `docs/agent-context.md` and `docs/USER_MANUAL.md`.

## License

All rights reserved. See `LICENSE`. The repository is publicly viewable, but no reuse, redistribution, or modification rights are granted.
