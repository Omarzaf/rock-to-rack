# Rock to Rack

Rock to Rack is an interactive browser game about the semiconductor supply chain: mine minerals, refine silicon, grow wafers, print circuits, package chips, and power a data center.

## Demo Routes

- Main menu: `/#menu`
- Crisis Run: `/?reset#crisis`
- Chapter 1: `/?reset#ch1`
- Chapter 4 fab demo: `/?reset#ch4`
- Chapter 6 data-center finale: `/?reset#ch6`
- Debug overlay: `/?reset&debug=1#ch6`

## Development

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm test
corepack pnpm simulate
corepack pnpm build
```

## Ship Checks

```bash
corepack pnpm test
corepack pnpm simulate
corepack pnpm build
corepack pnpm verify:static
```

In a second terminal, serve the production build:

```bash
corepack pnpm preview --host 127.0.0.1
```

Then run the browser checks against `http://127.0.0.1:4173/`:

```bash
corepack pnpm smoke:m10
corepack pnpm smoke:m11
corepack pnpm smoke:m12
corepack pnpm perf:m10
```

Run `perf:m10` by itself, not in parallel with the browser smokes, so
first-playable timing is not distorted by local contention.

The browser smoke scripts keep running even if Firefox or WebKit are not
installed. When those binaries are missing, the scripts report them as
unavailable instead of making installation a hidden prerequisite for the
normal local ship path.

## Pitch

10 minutes, kids to CTOs, browser tab. Players feel the tradeoffs behind chips: resource constraints, yield, binning, heat, power, and data-center demand.

## Feedback

Feedback plumbing is implemented but hidden until `SITE_METADATA.feedbackHref` is configured with a real mailto or form URL.

## Deployment

Build output lives in `dist/`. Vercel preview deploy is the default shipping target. Production promotion requires explicit human approval.
