# Rock to Rack User Manual

Date: 2026-07-09

Rock to Rack is a browser game about the semiconductor supply chain. You move from raw minerals to a working data center by mining, refining, growing wafers, fabricating circuits, packaging chips, and powering Nova, a public-interest AI workload for a city in crisis.

## 1. Getting Started

### Play Paths

Rock to Rack has two main ways to play:

- Crisis Run: the fast challenge. Bring Nova online before the city goes dark and try to beat your best result.
- Learn the Chain: the guided six-chapter campaign. Follow the full chip supply chain from mine to data center.

The bare game URL opens Crisis Run. Use the menu if you want to choose a mode.

### Useful Routes

- Main menu: `/#menu`
- Fresh Crisis Run: `/?reset#crisis`
- Fresh Chapter 1: `/?reset#ch1`
- Fresh Chapter 4 fab demo: `/?reset#ch4`
- Fresh Chapter 6 data-center finale: `/?reset#ch6`

Add `?reset` when you want to clear local progress before opening a route.

### Running Locally

From the project folder:

```bash
corepack pnpm install
corepack pnpm dev
```

For a production-style local preview:

```bash
corepack pnpm build
corepack pnpm preview --host 127.0.0.1
```

Open the printed local URL in a modern browser.

## 2. Main Menu

The menu presents the supply-chain pipeline:

```text
Mine -> Refine -> Grow -> Fab -> Package -> Power
```

Use:

- Play Crisis Run to start the five-minute rescue challenge.
- Learn the Chain to begin the six-chapter campaign.
- Mode to switch between Kid and Nerd wording.
- Sound On or Muted to control audio.
- Codex to review unlocked supply-chain cards.
- Settings to change text mode, sound, text size, or reset the save.

Progress and preferences are saved in the browser. Use Settings -> Reset save or a `?reset` route to start over.

## 3. Common Interface

Most scenes share the same patterns:

- Resource HUD: shows minerals, wafers, chips, energy, water, credits, or chapter-specific stats.
- Dialogue: introduces a chapter or concept. Use Next, Done, or Skip when available.
- Fact cards: connect game actions to real semiconductor concepts.
- Event cards: pause the game and ask you to make a supply-chain decision.
- Field Checks: short quizzes that explain missed answers and let you retry.
- Completion card: shows chapter stats and the next step in the chain.

Keyboard shortcuts usually pause while a dialogue, quiz, fact card, event card, or completion card is open. Use the visible buttons inside those overlays.

## 4. Crisis Run

Goal: bring Nova online before the city goes dark.

You build a small data center under pressure. Watch time, city lights, heat, and power. Place buildings, install chips, and serve Nova when the system is ready.

Core actions:

1. Pick a building type: Rack, Power, Cooling, Network, or Battery.
2. Tap or click a grid cell to place it.
3. Select a rack and install an available campaign chip.
4. Balance power and cooling so the city can stay online.
5. Click Serve Nova when the button becomes available.
6. Review the result card, copy the result if needed, and replay to improve your score.

Keyboard shortcuts:

- `1` to `5`: select Rack, Power, Cooling, Network, or Battery.
- Click or tap grid cell: place selected building.
- `I`: install selected chip.
- `C`: select the next chip.
- `Space`: try to Serve Nova.

Your result card tracks score, grade, time, lights, heat peak, run number, best-score comparison, and next replay target.

## 5. Learn the Chain Campaign

### Chapter 1: The Mine

Goal: place miners, fill the goal basket, and learn what chips are made from.

What to do:

- Select a gem cluster to inspect mineral type, depth, remaining material, and cost.
- Place miners on useful deposits.
- Move miners if you need a different mineral mix.
- Watch credits and energy while the goal basket fills.
- Complete the Field Check to move to the refinery.

Keyboard shortcuts:

- Arrow keys: select a deposit.
- `Enter` or `Space`: place or move a miner on the selected deposit.
- `Backspace` or `Delete`: remove the selected miner.

### Chapter 2: The Refinery

Goal: turn rough minerals into pure material while managing energy, water, and slag.

What to do:

- Choose machines: Crusher, Furnace, Chemical Bath, and Zone Refiner.
- Place machines in the right order across processing lanes.
- Recycle or safely store slag before waste blocks progress.
- Reach refined-output targets and the required silicon purity.

Keyboard shortcuts:

- `1` to `4`: select a machine.
- Arrow keys: move the lane/grid cursor.
- `Enter` or `Space`: place the selected machine.
- `R`: recycle slag.
- `S`: store slag safely.

### Chapter 3: Grow and Slice

Goal: grow a clean silicon crystal and slice it into wafers.

What to do:

- Hold to pull the crystal seed.
- Release to cool and stabilize the pull.
- Retry if quality falls too low.
- Slice the ingot at guide lines to make good wafers.

Keyboard shortcuts:

- Hold `Enter` or `Space`: pull during the crystal stage.
- Release `Enter` or `Space`: cool during the crystal stage.
- `R`: retry the pull.
- Arrow keys: move between slice guides.
- Number keys: select a slice guide directly.
- `Enter` or `Space`: slice at the selected guide.

### Chapter 4: The Fab

Goal: print circuits on wafers and keep the good dies.

What to do:

- Move through the fab stations: Coat, Expose, Etch, and Dope.
- Tune each station carefully to protect yield.
- Review the die map and keep good chips.
- Advance through node difficulty as the chapter ramps up.

Keyboard shortcuts:

- Arrow keys: tune the active station or move the fab cursor.
- `Enter` or `Space`: activate the current station.
- Number keys during Dope: select a doping zone.
- `N`: move to the next station or wafer when available.

### Chapter 5: Package and Choose

Goal: dice wafers, sort dies, and build a chip lineup for the data center.

What to do:

- Dice the wafer into dies.
- Test and sort each die into Perfect, Good, or Salvage bins.
- Build chips from the available bins.
- Choose a lineup that will matter in the data-center chapter.

Keyboard shortcuts:

- `C` or `Enter` or `Space`: dice the wafer when ready.
- `S`: start sorting from the dice stage.
- `1`, `2`, `3`: sort into Perfect, Good, or Salvage.
- `P`, `G`, `S`: sort into Perfect, Good, or Salvage.
- Arrow keys: cycle chip selection in the roster.
- Number keys in the roster: select a chip.
- `Enter` or `Space`: build the selected chip.
- `N`: continue when the chapter is ready.

### Chapter 6: Rack Up

Goal: install your finished chips into powered, cooled, networked racks.

What to do:

- Build racks, power, cooling, network, and batteries.
- Install campaign chips into racks.
- Serve jobs/contracts to raise city lights.
- Run the Nova recap challenge.
- Finish the run and see the full rock-to-rack journey.

Keyboard shortcuts:

- `1` to `5`: select Rack, Power, Cooling, Network, or Battery.
- Arrow keys: move the grid cursor.
- `Enter` or `Space`: place or select a grid cell.
- `I`: install selected chip.
- `S`: serve selected contract.
- `C`: cycle contracts.
- `V`: cycle chips.
- `N`: run the Nova challenge.

## 6. Codex, Settings, and Saves

### Codex

The Codex unlocks cards as you play. Each card connects a game action to the real-world supply-chain concept behind it.

### Settings

Settings include:

- Kid/Nerd text mode.
- Sound on/off.
- Normal/Large text.
- Reset save.

### Saves

The game autosaves locally in the browser. This save is useful for campaign progress, settings, unlocked Codex entries, and Crisis Run best results. It does not submit external forms or send messages.

## 7. Troubleshooting

- I want a fresh start: use Settings -> Reset save, or open a route with `?reset`.
- I cannot hear audio: check Sound On in the menu or settings, then check the browser tab and system volume.
- A button is disabled: read the nearby message. Most disabled actions are waiting for a required rack, chip, power/cooling balance, resource target, or Field Check.
- I am stuck in a chapter: return to the menu and reopen the chapter with `?reset#chN`, replacing `N` with the chapter number.
- The game feels too text-heavy: switch to Kid mode or Large text in Settings.
- A keyboard shortcut does not work: close any open dialogue, quiz, fact card, event card, Codex panel, or settings panel first.

## 8. Planning and Methodology Behind the Game

Rock to Rack was planned around one core product goal: make the semiconductor supply chain playable in a browser tab without turning it into a static explainer. The design uses a fast Crisis Run as the hook, then a six-chapter Learn the Chain campaign as the deeper educational path.

The methodology was chapter-first and systems-first:

1. Map the real supply chain into six playable transformations: mine, refine, grow, fab, package, and power.
2. Give each chapter one concrete player action that represents the industrial step.
3. Keep simulation rules in testable modules under `src/sim/`.
4. Keep player-facing copy and educational content in JSON under `src/content/`.
5. Render each chapter through Phaser scenes and DOM overlays under `src/scenes/` and `src/ui/`.
6. Add accessibility-minded supports: visible buttons, keyboard shortcuts, text modes, larger text, modal focus handling, and resettable local saves.
7. Verify the playable path with unit tests, simulation tests, static checks, production build, and browser smoke tests.

The result is a game structure where every chapter produces the next artifact in the chain: raw rock becomes sorted minerals, sorted minerals become super-pure silicon, silicon becomes wafers, wafers become printed chips, printed chips become finished chips, and finished chips power the city.
