# Award Submission Checklist

This checklist is the manual gate before any award submission. It does not
authorize autonomous deployment, outreach, or form submission.

## Local Evidence

- Run `corepack pnpm test`.
- Run `corepack pnpm simulate`.
- Run `corepack pnpm verify:static`.
- Run `corepack pnpm build`.
- Serve the production build with `corepack pnpm preview --host 127.0.0.1`.
- Run `corepack pnpm smoke:m10`, `corepack pnpm smoke:m11`, `corepack pnpm smoke:m12`, and `corepack pnpm smoke:m13`.
- Run `corepack pnpm perf:m10` by itself.
- Confirm the build output keeps app-owned chunks split from Phaser.
- Confirm Firefox, WebKit, mobile, and iPad smoke paths report pass.

## Public Surface

- Confirm the live URL opens directly into Crisis Run.
- Confirm `/#menu` shows the pitch, Play Crisis Run, Learn Mode, credits, and accuracy note.
- Confirm the finale reaches the completion payoff after serving Nova.
- Confirm `SITE_METADATA.feedbackHref` is either intentionally blank or set to an approved feedback URL.
- Confirm production deployment target is approved by Umar before any production promotion.

## Cold Playtest Gate

- Run `docs/playtests/2026-07-09-cold-playtest-script.md` with 3-5 cold testers.
- Record anonymized notes using `docs/playtests/2026-07-09-cold-playtest-notes-template.md`.
- Do not commit tester names, contact details, raw recordings, or private feedback.
- Triage findings into blocker, warning, and polish.
- Fix every blocker before submission.
- Re-run local evidence checks after blocker fixes.

## Manual Submission Boundary

- Umar reviews the live build, source notes, playtest summary, and submission copy.
- Umar performs any award form submission manually.
- Agents may prepare copy and checklists, but must not submit forms, send messages, or promote production without explicit approval in the current session.
