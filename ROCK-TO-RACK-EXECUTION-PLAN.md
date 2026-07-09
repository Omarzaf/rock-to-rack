# ROCK TO RACK
### A 2D strategy game about the journey of a chip — from critical minerals to your own data center.
**Execution Plan v1.0 — Design Doc + Coding-Agent Pipeline + YC Framing**

---

# PART 1 — THE PITCH (read this first, it drives every decision below)

**One-liner:** *Kerbal Space Program taught a generation orbital mechanics by accident. Rock to Rack does the same for the semiconductor supply chain — the most important industrial story of this decade — in a single 90-minute sitting.*

**Why now:** AI boom → everyone has heard "chips" and "data centers" but almost nobody, including adults, can explain how sand becomes a GPU. CHIPS Act, export controls, and workforce shortages make this a funded education problem, not just a curiosity.

**Who it's for (dual-audience is the product, not a compromise):**
- 5th grader: bright colors, characters, one-tap actions, simple words.
- 40-year-old: the same mechanics ARE the real economics — yield curves, purity nines, fab economics, geopolitics events. A "Nerd Mode" toggle deepens every text box without changing the game.

**Demo constraint for YC:** the whole game must run in a browser tab, no install, no login, loads in <5 seconds, and the first "wow" happens within 60 seconds (first mineral mined → fact card). Partners will play for 2 minutes; the golden path must be legible instantly.

---

# PART 2 — GAME DESIGN DOCUMENT

## 2.1 Core fantasy & story

You are **Sam**, a kid who finds a broken tablet and asks: *"Where do chips even come from?"* A retired chip engineer, **Dr. Vega**, becomes your guide: *"I'll show you. But you're going to build it all yourself — starting with a rock."*

Six chapters. Each chapter = one real stage of the supply chain. The game ends when your own small data center comes online and lights up a city's AI services — and the tablet from the opening scene finally turns on, running on a chip **you** made.

Story is delivered in short comic-panel dialogue (3–5 lines max per beat, skippable).

## 2.2 The six chapters (≈90 min total)

| Ch | Stage | Core verb | Time | What it teaches |
|----|-------|-----------|------|-----------------|
| 1 | **Mine** | Place miners, manage extraction | ~12 min | Critical minerals: quartz (silicon), copper, lithium, cobalt, rare earths, gallium. Where they come from on a world map. |
| 2 | **Refine** | Route ore through purification chain | ~12 min | Purity! Silicon must reach 99.9999999% ("nine nines"). Waste, energy, and water costs. |
| 3 | **Grow & Slice** | Crystal-growing timing game + wafer slicing | ~13 min | Czochralski ingot pulling, wafer slicing, why wafers are round and shiny. |
| 4 | **Fabricate** | Photolithography puzzle: print patterns, manage yield | ~15 min | Litho, etching, doping, cleanrooms, defects, yield %. Smaller nanometers = harder = more powerful. |
| 5 | **Package & Choose** | Bin chips, assemble your chip lineup | ~13 min | Testing/binning, and the CHIP TYPES roster (see 2.3). Different chips, different jobs. |
| 6 | **Rack Up** | Build the data center: racks, power, cooling, network | ~20 min | Data center anatomy. Chips only matter together. Final crisis event + victory. |

Buffer/credits ≈ 5 min. Each chapter ends with a **one-question Field Check** (fun quiz, can't fail — wrong answers get explained) and unlocks a Codex page.

## 2.3 The chip roster — "each with its own superpower"

Chips are collectible **characters** with stats and personalities. This is the merch/brand layer AND the education layer.

| Chip | Persona | Superpower (game effect) | Real lesson |
|------|---------|--------------------------|-------------|
| **CPU — "The Captain"** | Calm all-rounder | Every building works +10% | General-purpose compute; the conductor |
| **GPU — "The Swarm"** | Thousands of tiny workers | Unlocks AI Contracts (biggest revenue) | Parallel processing; why AI needs GPUs |
| **DRAM — "Flash the Librarian"** | Fast but forgetful | Doubles job speed, but needs constant power | Volatile memory; speed vs. persistence |
| **NAND — "The Vault"** | Slow, never forgets | Stores earnings safely through blackout events | Persistent storage |
| **NIC/Network ASIC — "The Messenger"** | Hyperactive courier | Racks share power — multiplies whole-datacenter output | Networking; a data center is one big computer |
| **PMIC — "The Guardian"** | Frugal grandma energy | Cuts energy cost 30% | Power management; electricity is the real cost |
| **AI Accelerator — "Nova"** (endgame) | Mysterious prodigy | Wins the final contract; requires your best yield wafer | Cutting-edge nodes; why 3nm is hard |

Design rule: **every superpower is the chip's real-world function, exaggerated into a game mechanic.** A 10-year-old remembers "The Vault never forgets"; a 40-year-old recognizes NAND persistence. Same sentence.

## 2.4 Core strategy loop (the resource spine that runs through all chapters)

```
MINE minerals → REFINE (purity %) → GROW ingots → SLICE wafers
→ FAB (yield %) → PACKAGE & BIN chips → INSTALL in data center OR SELL
→ data center earns Compute Credits → reinvest in better tech → repeat
```

Four resources on the top bar at all times: **Minerals** (per-type icons), **Purity/Wafers**, **Chips** (per-type), **⚡Energy + 💧Water** (shared constraint), **Credits** (money).

**Strategy pressure comes from three dials:**
1. **Yield** — fab minigame performance sets % of good chips per wafer. Bad run = teachable moment ("real fabs throw away chips too — this is why they cost so much").
2. **Energy/water budget** — every stage consumes it; teaches sustainability without preaching.
3. **Event cards** (2–3 per chapter, 15 seconds each) — real-world curveballs: *"Export ban! Gallium price ×3."* / *"Drought — fab water rationed."* / *"Earthquake near your fab — production halted 60s."* Player picks one of two responses. This is the geopolitics curriculum smuggled in as gameplay.

**Tech tree (small, 9 nodes):** 90nm → 28nm → 7nm → 3nm process nodes on one axis; automation upgrades (auto-miners, auto-refiners) on the other. Later chapters auto-run earlier stages so the player never grinds — the supply chain literally becomes a visible, animated pipeline across the bottom of the screen by Chapter 6. **That growing pipeline visualization is the game's signature image** (and your pitch-deck money shot).

## 2.5 Win/lose & the 90-minute guarantee

- No fail states that end the run — setbacks cost time/credits only. (Educational game: frustration kills completion.)
- Soft timer: contracts have deadlines; missing one downgrades your medal (bronze/silver/gold), never blocks progress.
- **Hard pacing guarantee:** each chapter has a "Dr. Vega helps out" catch-up mechanic — if the player is >20% behind the pace curve, subsidies kick in silently. Playtime clamps to 75–90 min.
- Victory: final AI contract served → cinematic: the city lights up, Sam's tablet boots, credits roll over a real photo montage of actual mines → fabs → data centers ("everything you did is real — here's the real version").
- Post-game: printable **"Chip Engineer Certificate"** + shareable stats card (yield %, minerals mined, chips built) + full Codex unlocked as a re-readable mini-textbook.

## 2.6 Educational architecture (this is the YC moat — make it explicit)

- **Two-register text system.** Every fact card has `kid` and `nerd` strings. Toggle in settings, default kid. Nothing else changes. One codebase, two audiences.
- **Codex** — 24 entries, one unlocked per milestone. Each entry: 1 picture, 3 kid sentences, 1 "Go Deeper" paragraph, 1 real-world stat.
- **Field Checks** — 6 one-question quizzes (one per chapter). Instrumented: log answer correctness anonymously → this is your learning-outcomes data for the YC pitch ("83% of players can explain photolithography after one session").
- **Teacher mode (post-MVP, mention in pitch):** classroom dashboard, curriculum-aligned worksheets (NGSS MS-PS1, MS-ETS1). The game is the wedge; the classroom SaaS is the business.

## 2.7 Art direction (cheap, fast, distinctive)

- Flat vector 2D, bold outlines, warm palette ("Kurzgesagt meets Mini Metro").
- Everything is drawn as **SVG-style geometric shapes generated in code or simple sprite sheets** — no artist dependency for MVP. Chips are rounded squares with faces. Minerals are colored gems. This is a feature: it ships in weeks, not months.
- One font: Nunito (round, friendly, free). One accent color per chapter (mine=amber, refine=teal, fab=violet, datacenter=blue).
- Sound: free SFX packs + one looping track per chapter (or none for MVP — muted-by-default web game is fine).

---

# PART 3 — TECHNICAL DECISIONS (locked; do not let the agent re-litigate)

| Decision | Choice | Why |
|---|---|---|
| Engine | **Phaser 3 + TypeScript + Vite** | Browser-native, huge docs (agents code it well), scene system maps 1:1 to chapters, zero-install demo |
| Rendering | Phaser scenes + DOM overlay for UI (HTML/CSS for menus, dialogue, codex) | HTML UI is 10× faster to build/iterate than canvas UI |
| State | Single TypeScript `GameState` object + event bus; save to `localStorage` every 10s and on chapter end | Simple, debuggable, refresh-proof |
| Content | **All text, chip stats, events, quiz questions, balance numbers in `/src/content/*.json`** | Educators/you can edit without touching code; enables kid/nerd dual text |
| Structure | One Phaser Scene per chapter + `BootScene`, `MenuScene`, `PipelineHUD` shared component | Chapters are independently buildable/testable milestones |
| Deploy | Vercel (or itch.io) static build | Shareable link for YC application & demo day |
| Analytics | Plausible or a 20-line custom endpoint: chapter start/end timestamps, quiz answers, completion | Learning-outcome + engagement metrics for the pitch |
| Testing | Vitest for economy/balance logic (pure functions); manual playtest script per milestone | The economy must be unit-tested or balancing will eat you alive |
| Out of scope for MVP | Multiplayer, accounts, mobile app stores, localization, teacher dashboard | Say no now, pitch later |

**Non-negotiable engineering rules to give the agent (repeat in every milestone):**
1. All game balance numbers live in `content/balance.json` — never hardcode.
2. All player-facing text lives in `content/strings.json` with `{ kid, nerd }` pairs.
3. Economy logic = pure functions in `src/sim/` with unit tests; scenes only render and forward input.
4. Every scene must be reachable via URL hash for testing (e.g. `#ch4` jumps straight to fab with a valid mid-game state fixture).
5. 60fps on a 2020 Chromebook; total bundle < 5MB.

---

# PART 4 — THE PIPELINE: COPY-PASTE PROMPTS FOR YOUR CODING AGENT

Run these in order. Each milestone is one agent session. **Verify the acceptance criteria yourself in the browser before starting the next milestone** — do not stack unverified work.

---

### M0 — Project scaffold
> Create a new Phaser 3 + TypeScript + Vite project called "rock-to-rack". Set up: `src/scenes/` (BootScene, MenuScene, plus empty stubs Ch1MineScene…Ch6DatacenterScene), `src/sim/` for pure game-logic functions, `src/content/` with empty `strings.json`, `balance.json`, `chips.json`, `events.json`, `quiz.json`, `src/ui/` for DOM overlay components. Wire a global `GameState` object with an event-bus (simple pub/sub), autosave to localStorage every 10 seconds and on scene transitions, and a `?reset` URL param to clear saves. Add URL-hash scene jumping (`#ch3` loads Ch3 with a fixture state from `src/fixtures/`). Add Vitest and one passing dummy test. MenuScene shows the title "ROCK TO RACK", a Play button, a kid/nerd mode toggle, and a mute toggle, built as DOM overlay (HTML/CSS, font: Nunito), not canvas text. Acceptance: `npm run dev` shows the menu, Play transitions to an empty Ch1 scene, `npm test` passes, refresh restores state.

### M1 — Shared systems: resources, HUD, dialogue, fact cards
> Build the shared game systems. (1) `src/sim/economy.ts`: pure functions for resource add/spend/convert with per-resource caps, driven entirely by `content/balance.json`. Unit-test them. (2) A top HUD bar (DOM overlay) showing Minerals (5 types with icons — draw simple colored SVG gems inline), Wafers, Chips, Energy, Water, Credits, animating on change. (3) A dialogue system: comic-panel style bottom sheet showing a character portrait (colored circle + name is fine for now), name, and text; advances on click; content from `strings.json`, every string as `{kid, nerd}` — render per the mode toggle. (4) A FactCard component: a card that slides in with a title, one image slot, kid text, and a "Go Deeper" expandable nerd paragraph; dismissible; fires an analytics event when opened. (5) `src/sim/events.ts`: an event-card system that pauses gameplay, shows a scenario with 2 choice buttons from `events.json`, applies resource effects. Acceptance: a dev sandbox scene at `#sandbox` demonstrates HUD updates, a dialogue exchange, a fact card, and one event card, all text switching correctly between kid and nerd modes.

### M2 — Chapter 1: The Mine
> Build Ch1MineScene. Layout: a 2D side-view terrain (drawn with Phaser graphics — layered colored strata) containing deposits of 5 minerals: quartz, copper, lithium, cobalt, rare-earths (colored gem clusters). Player clicks a deposit to place a Miner (costs Credits) which extracts that mineral over time into the HUD. Strategy: limited Miner slots (4), deposits deplete, deeper strata richer but miners there cost Energy upkeep — player must choose what to mine for the chapter goal: a target basket of minerals shown as a checklist. Include: intro dialogue (Sam + Dr. Vega, 4 lines, from strings.json), a world-map fact card when each mineral type is first mined ("Most cobalt comes from the DR Congo…" etc. — write kid+nerd text for all 5), 2 event cards (mine flood: pay credits or lose time; price spike: sell surplus copper for bonus), background auto-tick so the scene runs at a satisfying pace (~10–12 min to goal; put all pacing numbers in balance.json). Chapter ends with a 1-question Field Check quiz from quiz.json ("Which mineral becomes the chip itself? → Quartz/silicon"), wrong answers get a friendly explanation, then a chapter-complete screen with stats and a "Next: The Refinery" button. Write all needed content into the JSON files (kid text ≈ 4th–5th grade reading level, nerd text genuinely informative for adults). Acceptance: chapter playable start-to-finish in 10–12 min at `#ch1`, all five fact cards correct and dual-register, quiz logged to analytics, state persists into Ch2 stub.

### M3 — Chapter 2: The Refinery
> Build Ch2RefineryScene: a routing/flow puzzle. Left side: raw mineral silos (from Ch1 inventory). Right side: purity targets. Player builds a chain by placing processing modules (Crusher → Furnace → Chemical Bath → Zone Refiner) on a grid; conveyor lines auto-connect adjacent modules. Each pass raises silicon purity one "nine" (99% → 99.9% → …), displayed as a big satisfying purity meter counting nines toward 9N ("nine nines — the purest material humans mass-produce"). Twist: each module consumes Energy and Water per tick and produces Slag (waste) that must be managed (recycle for credits or store). Copper/lithium/cobalt refine in fewer steps in parallel lanes. 2 event cards (energy price spike: teaches why refining happens where electricity is cheap; environmental inspection: slag stored properly = bonus). Fact cards: "nine nines" purity, why refining is energy-hungry, recycling e-waste. Field Check: "Why does chip silicon need to be SO pure?" End screen previews the ingot. Pacing ~12 min, all numbers in balance.json. Acceptance: playable at `#ch2` with a Ch1-complete fixture, purity meter reaches 9N, energy/water visibly constrain choices, quiz + analytics fire.

### M4 — Chapter 3: Grow & Slice
> Build Ch3CrystalScene, two mini-stages. Stage A — Czochralski pull: a timing/dexterity minigame. A seed crystal dips into a glowing crucible of molten silicon; player holds to pull, releasing to manage a temperature needle that drifts; keeping the needle in the green zone while pulling grows a wide even ingot, wobbling makes narrow/flawed sections. The grown ingot's quality is computed from time-in-green-zone (pure function in sim/, unit-tested). Stage B — Slicing: the ingot moves through a diamond wire saw; player clicks to slice at guide lines; accurate slices = more wafers, flawed ingot sections auto-discard (visibly — teaches waste). Output: N wafers with a base quality score carried into Ch4. Fact cards: Czochralski method (a Polish chemist's 1915 accident!), why wafers are round, diamond wire saws. One event card (vibration from a passing truck — re-center the needle quickly). Field Check: "Why are wafers round?" Pacing ~13 min including one free retry of the pull. Acceptance: playable at `#ch3`, ingot quality visibly reflects player skill, wafer count+quality persist to state, minigame feels good with mouse AND touch.

### M5 — Chapter 4: The Fab (the signature chapter — spend the most polish here)
> Build Ch4FabScene: photolithography as a pattern-printing puzzle. The player processes wafers through 4 stations shown as a cleanroom cross-section: (1) Coat — click-drag to spread photoresist evenly (coverage % scored); (2) Expose — align a mask over the wafer using arrow keys/drag against a slowly drifting target, then flash UV; alignment accuracy scored; (3) Etch — hold in acid bath, release at the right moment (over/under-etch penalty); (4) Dope — quick color-match of implant zones. Each wafer's final YIELD % = f(wafer quality from Ch3, station scores) via a unit-tested pure function; show the wafer as a grid of dies with defective dies visibly marked red — this is the money visual. Process 3 wafers, each on a smaller node (90nm → 28nm → 7nm) with tighter tolerances and higher chip value — teaches why smaller is harder and pricier. Cleanroom fact cards: why bunny suits, a dust speck vs. a transistor size comparison, EUV machines cost $200M+ and come from one company (ASML). 2 event cards (dust contamination: scrap or rework; tool calibration drift). Field Check: "Why do chipmakers throw away some chips from every wafer?" Pacing ~15 min. Acceptance: playable at `#ch4`, yield math unit-tested, defect-map visual reads clearly, three-node difficulty ramp works, all content dual-register.

### M6 — Chapter 5: Package, Bin & Meet the Chips
> Build Ch5PackageScene. Stage A — dicing & packaging: wafer dies from Ch4 get diced (satisfying auto-animation), then a quick sorting game: dies fall down a testing chute, player sorts into Bins (Perfect / Good / Salvage) based on a visible test-meter — teaches binning ("the same wafer makes fast and slow chips; the slow ones are sold cheaper, not thrown out"). Stage B — THE CHIP ROSTER: with binned dies as currency, the player assembles their chip lineup by choosing which chip types to build from `chips.json`: CPU "The Captain", GPU "The Swarm", DRAM "Flash the Librarian", NAND "The Vault", NIC "The Messenger", PMIC "The Guardian". Each chip gets a collectible-card reveal animation: portrait (rounded-square chip with a simple face — code-drawn), superpower text, real-world lesson line (kid+nerd). Player has enough dies for ~4 of 6 types — a real strategic choice with visible consequences in Ch6 (surface hints: "AI contracts need The Swarm…"). The endgame chip Nova (AI accelerator) is shown locked: requires a 7nm Perfect bin die. Field Check: "Which chip would a video game need most?" Pacing ~13 min. Acceptance: playable at `#ch5`, roster choice persists to state, card reveals feel collectible, binning game teaches the concept legibly.

### M7 — Chapter 6: Rack to Riches (the strategy payoff)
> Build Ch6DatacenterScene: a grid-based build-and-manage finale (~20 min), isometric-flavored 2D top-down. Player builds on an empty lot: Racks (install your chips from Ch5 into slots), Power substation, Cooling units, Network spine, Backup battery. Contracts arrive on a ticker (from events.json): "Stream cartoons to 10,000 kids" (needs CPU+NAND), "Train a weather AI" (needs GPU+DRAM), etc. — served contracts earn Credits; chip superpowers apply their effects (Guardian cuts energy cost, Messenger multiplies linked racks…). Heat and power are live constraints: overloaded racks glow red and throttle — place cooling. The bottom-of-screen supply-chain pipeline (auto-running miniature versions of Ch1–5 feeding new chips in) is now fully visible and animated — this is the game's signature image. Mid-chapter: crisis event chain — heatwave + grid brownout, player must respond (battery, throttle, or pay). Finale: the NOVA contract ("a hospital needs an AI to read X-rays overnight") requiring the Nova chip — player fabs one 7nm perfect die via a single quick fab-recap challenge, installs Nova, serves the contract. Victory cinematic: city lights up window by window, Sam's tablet boots showing "powered by YOUR chip", medal + stats screen (total yield, minerals mined, playtime), then a photo-montage epilogue with 5 real-world images (placeholder rects + captions for now) and the Codex unlock-all. Acceptance: playable at `#ch6` from a Ch5 fixture, chip choices from Ch5 visibly matter, heat/power management creates real decisions, full run Ch1→Ch6 completes in 75–90 min, victory flow lands emotionally.

### M8 — Codex, analytics, save polish
> Build the Codex: a book UI accessible from the HUD anytime, 24 entries defined in a new `content/codex.json` (write all 24: minerals ×5, purity, energy/water, Czochralski, wafers, cleanroom, lithography, EUV/ASML, doping, yield, binning, each chip type ×7, data center anatomy, cooling, the global supply chain map). Each entry: title, emoji/icon, kid text (3 sentences), nerd paragraph, one real stat. Entries unlock at the milestones where their topic appears; locked entries show a silhouette + hint. Add the analytics layer: POST (or Plausible custom events) for chapter_start, chapter_end (with duration), quiz_answer (question id, correct bool), factcard_opened, game_complete. Add a settings pane: kid/nerd toggle, mute, text size, reset save, and a "Teacher/Parent" info screen explaining the learning goals per chapter. Harden saves: version the save schema, migrate or reset gracefully on version mismatch. Acceptance: all 24 codex entries written and unlockable, analytics events verified in network tab, corrupt/old saves handled without crashes.

### M9 — Balance pass & playtest instrumentation
> Create `npm run simulate`: a headless Vitest-driven simulation that runs the economy of all six chapters with three bot profiles (fast/average/slow player) using the pure sim functions, and prints per-chapter durations and resource curves. Tune `balance.json` until: fast bot ≈ 60 min, average ≈ 80 min, slow ≈ 90 min with catch-up subsidies triggering. Implement the catch-up system: if a player's chapter progress is >20% behind the pace curve (pace targets in balance.json), silently boost passive income 25%. Add a debug overlay (`?debug=1`): current pace vs target, resource rates, scene jump buttons, "grant resources" cheat. Acceptance: simulation report committed, three profiles land in the 60–90 min window, debug overlay works, no balance numbers hardcoded outside balance.json.

### M10 — Ship it
> Production build and deploy to Vercel as a static site. Add: OpenGraph/social meta tags with a generated cover image, favicon, loading screen with a fun fact rotator, offline-capable service worker (optional, skip if >1 day), a feedback link (mailto or tally.so form), and a 404→menu redirect. Performance pass: bundle <5MB, first playable <5s on throttled 4G, 60fps on a low-end laptop profile in Chrome DevTools. Cross-check: full playthrough on Chrome, Safari, Firefox, and one touch device — fix input issues. Write a README with the pitch one-liner, a GIF of the Ch6 pipeline view, and dev instructions. Acceptance: public URL, full 90-min playthrough clean on desktop + tablet, Lighthouse performance >85.

---

### How to run this pipeline day-to-day
1. One milestone per agent session; paste the prompt verbatim, plus: *"Follow the engineering rules in ROCK-TO-RACK-EXECUTION-PLAN.md Part 3."* (Keep this file in the repo root — the agent will read it.)
2. After each milestone, YOU playtest against the acceptance list before continuing. Fix-it prompts are cheaper than rework three milestones later.
3. Expect M5 (fab) and M7 (data center) to need 2–3 iteration rounds on feel — budget for it.
4. Rough calendar with a capable agent: M0–M1 in a day, one chapter per 1–2 days, M8–M10 in 2–3 days → **playable pitch demo in ~2 weeks, polished in ~4.**

---

# PART 5 — YC-SPECIFIC PREP

**Framing:** you're not pitching "an educational game." You're pitching **interactive curriculum for the technologies that matter, with a hit first title.** Rock to Rack is title #1; the engine (dual-register content system, chapter pipeline, analytics) is reusable for "journey of a battery," "journey of a vaccine," "journey of a rocket."

**Demo choreography (2½ min):**
1. 15s — open the live URL, hit Play. (No slides while the game is on screen.)
2. 45s — Chapter 1: mine cobalt, fact card pops with the DR Congo stat. Toggle Nerd Mode live on that card — the dual-audience trick lands instantly.
3. 45s — jump via `#ch4` to the fab: print a wafer, show the red defective dies. "Every partner here has read about yield. Your players *feel* it."
4. 45s — jump to `#ch6` endgame: the full animated mine-to-rack pipeline running under a live data center. Serve the Nova hospital contract. City lights up.
5. Close: "90 minutes, kids to CTOs, browser tab, and our quiz telemetry shows X% concept retention."

**Metrics to have before the interview** (all instrumented in M8): completion rate, median playtime, quiz correctness pre-vs-post (add an optional 3-question pre-quiz at Play for a learning-gain number), share/replay rate. Get 50–100 playtests: one 5th-grade classroom (a teacher contact) + posting to r/hardware & HN gets you the 40-year-olds.

**Business narrative (one slide):** Free viral web game → school licenses w/ teacher dashboard ($) → corporate onboarding for semis/defense/consulting ($$$, they already pay for supply-chain training) → franchise engine for other "journey of" titles.

**Anticipated YC questions & your answers:**
- *"Games are hits-driven."* → We're curriculum-driven; distribution is teachers and the AI news cycle, not app stores.
- *"Why you?"* → You built the entire product with AI agents in weeks for ~$0 — that IS the demo of your execution speed. Say this explicitly.
- *"Moat?"* → Dual-register content system + learning-outcome telemetry + the franchise pipeline. Content is easy to copy; measured learning outcomes and school relationships are not.

---

# APPENDIX — Fact-check list before shipping content
Verify these against current sources when writing final copy (M2–M8): cobalt/DRC share, silicon purity nines, EUV machine cost & ASML monopoly status, water usage per fab per day, largest data center power draws, current leading process node. Keep every stat sourced in a `content/SOURCES.md` — teachers will ask, and YC partners might too.
