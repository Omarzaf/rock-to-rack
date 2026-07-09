# Chapter 6 Datacenter Finale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Chapter 6 stub with a playable data-center finale at `#ch6` where the player installs the Chapter 5 chip lineup into racks, manages power/cooling/network constraints, serves contracts, handles a heatwave/brownout crisis, builds Nova, and reaches the victory flow.

**Architecture:** Keep the established chapter pattern. Put deterministic data-center mechanics in `src/sim/datacenter.ts` with Vitest coverage, keep Phaser rendering and pointer input in `src/scenes/Ch6DatacenterScene.ts`, put dense controls in `src/ui/chapterSixOverlay.ts`, and keep player-facing text/balance/contracts in JSON content files. Chapter 6 consumes `chapters.ch5.selectedChipIds`, `builtChips`, `perfect7nmDies`, and `resources.credits`, persists `chapters.ch6`, and ends the current MVP run without starting M8 systems.

**Tech Stack:** Phaser 3.90, TypeScript strict, Vite 6, Vitest, DOM overlays, existing `gameStore`, `pipelineHud`, `dialogueOverlay`, `factCard`, `eventCard`, and shared quiz/completion modal patterns.

---

## Classification

TYPE: `NEW_FEATURE`

COMPLEXITY: `COMPLEX`

SCOPE:
- `src/sim/datacenter.ts`
- `src/sim/datacenter.test.ts`
- `src/state/types.ts`
- `src/state/gameState.ts`
- `src/state/gameState.test.ts`
- `src/fixtures/chapterFixtures.ts`
- `src/scenes/Ch6DatacenterScene.ts`
- `src/ui/chapterSixOverlay.ts`
- `src/content/balance.json`
- `src/content/events.json`
- `src/content/quiz.json`
- `src/content/strings.json`
- `src/content/SOURCES.md`
- `src/styles.css`
- `docs/agent-context.md`

RISK: `MEDIUM`

Risk notes:
- Save-state schema expands again with `ch6`; old saves must hydrate safely.
- `#ch6` is the pitch-deck payoff scene, so the first-screen composition matters.
- Chapter 6 depends on the Chapter 5 chip-lineup contract; avoid changing existing Ch5 outputs unless a test proves the need.

Human checkpoint before step: implementation of Task 1. This plan is the required checkpoint.

Estimated token cost: 90k-140k for implementation plus review/playtest.

Workspace constraint:
- `/Users/omar/Downloads/Game` is not currently a git repo. Skip commit steps in this workspace. If the project is later moved into a git repo, commit after each green task using the messages shown below.

## Existing Context

- `#ch6` currently routes to `src/scenes/Ch6DatacenterScene.ts`, which only extends `ChapterStubScene`.
- `src/fixtures/chapterFixtures.ts` already creates a Ch6 fixture with completed Ch5 progress and selected chips.
- `src/state/types.ts` currently stops `ChapterProgressState` at `ch5`.
- `src/content/chips.json` already has CPU, GPU, DRAM, NAND, NIC, PMIC, and locked Nova with `effectKey` and `ch6Hint` fields.
- Verification commands use `corepack pnpm test` and `corepack pnpm build`.
- Browser QA should use local Chrome if Playwright bundled browsers are missing:

```ts
executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

## Target Player Flow

1. `#ch6` loads from a Ch5-complete fixture with CPU, GPU, DRAM, and PMIC selected by default.
2. Intro dialogue frames the empty lot: chips matter only when installed in racks with power, cooling, and network.
3. Player places buildings on an 8 x 5 grid:
   - Rack
   - Power substation
   - Cooling unit
   - Network spine
   - Backup battery
4. Player selects a rack and installs available chips from Ch5.
5. Contracts arrive on a ticker. The player serves at least three non-final contracts:
   - `cartoonStream`: CPU + NAND, teaches baseline services and storage.
   - `weatherAi`: GPU + DRAM, teaches AI/parallel memory needs.
   - `cityBackup`: CPU + NIC + PMIC plus network/battery, teaches reliability.
6. Heat and power update on ticks. Overheated or underpowered racks throttle output.
7. Crisis chain appears after two contracts:
   - Heatwave: invest in cooling or throttle.
   - Grid brownout: use battery or buy emergency power.
8. Nova finale unlocks. Player completes a quick fab-recap challenge, installs Nova, and serves `hospitalNova`.
9. Chapter 6 Field Check appears before the victory modal.
10. Victory modal shows city lights, Sam tablet boot message, medal, total stats, and placeholder photo-montage captions.

## Data Model

Add these types to `src/state/types.ts`:

```ts
export type DatacenterBuildingType = 'rack' | 'power' | 'cooling' | 'network' | 'battery';
export type DatacenterStage = 'build' | 'contracts' | 'crisis' | 'nova' | 'victory';
export type DatacenterContractId = 'cartoonStream' | 'weatherAi' | 'cityBackup' | 'hospitalNova';

export interface DatacenterGridPosition {
  column: number;
  row: number;
}

export interface DatacenterBuildingProgress {
  id: string;
  type: DatacenterBuildingType;
  column: number;
  row: number;
  installedChipIds: ChipTypeId[];
}

export interface ChapterSixProgress {
  completed: boolean;
  completedAtSeconds: number | null;
  quizCorrect: boolean | null;
  stage: DatacenterStage;
  buildings: DatacenterBuildingProgress[];
  servedContracts: DatacenterContractId[];
  availableChipIds: ChipTypeId[];
  installedChipIds: ChipTypeId[];
  novaBuilt: boolean;
  heat: number;
  powerCapacity: number;
  powerLoad: number;
  cooling: number;
  networkLinks: number;
  batteryCharge: number;
  cityLights: number;
  triggeredEvents: string[];
  firstFacts: string[];
}
```

Update `ChapterProgressState`:

```ts
export interface ChapterProgressState {
  ch1: ChapterOneProgress;
  ch2: ChapterTwoProgress;
  ch3: ChapterThreeProgress;
  ch4: ChapterFourProgress;
  ch5: ChapterFiveProgress;
  ch6: ChapterSixProgress;
}
```

Initial Ch6 defaults:

```ts
{
  completed: false,
  completedAtSeconds: null,
  quizCorrect: null,
  stage: 'build',
  buildings: [],
  servedContracts: [],
  availableChipIds: [],
  installedChipIds: [],
  novaBuilt: false,
  heat: 0,
  powerCapacity: 0,
  powerLoad: 0,
  cooling: 0,
  networkLinks: 0,
  batteryCharge: 0,
  cityLights: 0,
  triggeredEvents: [],
  firstFacts: []
}
```

## Content Contracts

Add `ch6` to `src/content/balance.json`:

```json
"ch6": {
  "tickSeconds": 0.5,
  "grid": { "columns": 8, "rows": 5 },
  "rackChipSlots": 3,
  "contractsToUnlockNova": 3,
  "heatWarning": 65,
  "heatThrottle": 85,
  "maxHeat": 100,
  "startingPowerCapacity": 20,
  "startingCooling": 12,
  "startingNetworkLinks": 0,
  "startingBatteryCharge": 0,
  "buildingCosts": {
    "rack": { "credits": 90 },
    "power": { "credits": 120 },
    "cooling": { "credits": 85, "water": 4 },
    "network": { "credits": 75 },
    "battery": { "credits": 80, "lithium": 3, "cobalt": 2 }
  },
  "buildingStats": {
    "rack": { "powerLoad": 14, "heatRate": 10, "compute": 18 },
    "power": { "powerCapacity": 34 },
    "cooling": { "cooling": 24, "waterLoad": 2 },
    "network": { "networkLinks": 2 },
    "battery": { "batteryCharge": 35 }
  },
  "chipEffects": {
    "cpu": { "computeMultiplier": 1.1 },
    "gpu": { "aiEnabled": true, "computeBonus": 18, "powerLoad": 6, "heatRate": 8 },
    "dram": { "rewardMultiplier": 1.2, "powerLoad": 3, "heatRate": 3 },
    "nand": { "blackoutProtection": 40, "powerLoad": 2, "heatRate": 2 },
    "nic": { "networkMultiplier": 1.25, "powerLoad": 3, "heatRate": 2 },
    "pmic": { "powerMultiplier": 0.7 },
    "nova": { "aiEnabled": true, "computeBonus": 42, "powerLoad": 8, "heatRate": 9 }
  },
  "novaChallenge": {
    "requiredAverageScore": 82,
    "perfectDieCost": 1
  },
  "pacingTargetSeconds": {
    "min": 1020,
    "max": 1200
  }
}
```

Add `ch6Contracts` and `ch6` crisis cards to `src/content/events.json`:

```json
"ch6Contracts": [
  {
    "id": "cartoonStream",
    "title": { "kid": "Cartoon Stream", "nerd": "Low-latency media service" },
    "description": {
      "kid": "Stream cartoons to 10,000 kids after school.",
      "nerd": "A media workload needs general compute and durable storage to serve many users reliably."
    },
    "requiredChipIds": ["cpu", "nand"],
    "requiredCompute": 24,
    "requiredNetworkLinks": 0,
    "rewardCredits": 120,
    "cityLights": 25
  },
  {
    "id": "weatherAi",
    "title": { "kid": "Weather AI", "nerd": "Parallel forecast training job" },
    "description": {
      "kid": "Train a weather AI before the next storm.",
      "nerd": "Model training benefits from GPUs and fast memory because many math operations run in parallel."
    },
    "requiredChipIds": ["gpu", "dram"],
    "requiredCompute": 42,
    "requiredNetworkLinks": 0,
    "rewardCredits": 175,
    "cityLights": 25
  },
  {
    "id": "cityBackup",
    "title": { "kid": "City Backup", "nerd": "Resilient municipal services" },
    "description": {
      "kid": "Keep city services online during a storm warning.",
      "nerd": "Reliability workloads need power management, networking, and backup energy."
    },
    "requiredChipIds": ["cpu", "nic", "pmic"],
    "requiredCompute": 38,
    "requiredNetworkLinks": 2,
    "rewardCredits": 160,
    "cityLights": 25
  },
  {
    "id": "hospitalNova",
    "title": { "kid": "Hospital Nova", "nerd": "Urgent medical imaging inference" },
    "description": {
      "kid": "A hospital needs help reading X-rays overnight.",
      "nerd": "Medical imaging inference needs specialized acceleration, high throughput, and reliable infrastructure."
    },
    "requiredChipIds": ["nova", "gpu", "dram"],
    "requiredCompute": 70,
    "requiredNetworkLinks": 2,
    "rewardCredits": 260,
    "cityLights": 25
  }
],
"ch6Heatwave": {
  "id": "ch6-heatwave",
  "title": { "kid": "Heatwave", "nerd": "Ambient-temperature excursion" },
  "scenario": {
    "kid": "The city is hot and your racks are hotter. Add cooling or slow the jobs down.",
    "nerd": "Higher ambient temperatures reduce cooling headroom and can force throttling unless cooling capacity rises."
  },
  "choices": [
    {
      "id": "add-cooling",
      "label": { "kid": "Add cooling", "nerd": "Increase cooling capacity" },
      "effects": { "credits": -70, "water": -4 }
    },
    {
      "id": "throttle-racks",
      "label": { "kid": "Slow racks", "nerd": "Throttle workloads" },
      "timePenaltySeconds": 30,
      "effects": { "credits": -20 }
    }
  ]
},
"ch6Brownout": {
  "id": "ch6-brownout",
  "title": { "kid": "Grid Brownout", "nerd": "Utility voltage sag" },
  "scenario": {
    "kid": "The power grid dips. Use batteries or buy emergency power.",
    "nerd": "Data centers use backup power systems to ride through grid instability without dropping workloads."
  },
  "choices": [
    {
      "id": "use-battery",
      "label": { "kid": "Use battery", "nerd": "Discharge backup battery" },
      "effects": { "credits": -10 }
    },
    {
      "id": "buy-emergency-power",
      "label": { "kid": "Buy power", "nerd": "Purchase emergency power" },
      "effects": { "credits": -80 }
    }
  ]
}
```

Add `ch6FieldCheck` to `src/content/quiz.json`:

```json
"ch6FieldCheck": {
  "id": "ch6-field-check",
  "question": {
    "kid": "Why does a data center need cooling?",
    "nerd": "Why do dense compute racks need active cooling infrastructure?"
  },
  "answers": [
    {
      "id": "cooling-stops-throttle",
      "label": {
        "kid": "Hot chips slow down",
        "nerd": "Heat forces throttling and can damage equipment"
      },
      "correct": true,
      "explanation": {
        "kid": "Yes. Chips make heat when they work. Cooling keeps them fast and safe.",
        "nerd": "Correct. Dense compute produces heat; without cooling, equipment throttles, fails, or requires shutdown."
      }
    },
    {
      "id": "cooling-makes-data",
      "label": {
        "kid": "Cold air makes data",
        "nerd": "Cooling creates compute directly"
      },
      "correct": false,
      "explanation": {
        "kid": "Cooling does not make data. It helps the chips keep working.",
        "nerd": "Cooling is support infrastructure. It preserves usable compute by keeping hardware inside thermal limits."
      }
    },
    {
      "id": "cooling-replaces-power",
      "label": {
        "kid": "Cooling replaces electricity",
        "nerd": "Cooling eliminates power demand"
      },
      "correct": false,
      "explanation": {
        "kid": "Cooling uses power too. The racks still need electricity.",
        "nerd": "Cooling systems consume additional power; they manage thermals rather than replacing electrical supply."
      }
    }
  ]
}
```

Add `ch6` to `src/content/strings.json` with these sections:

```json
"ch6": {
  "title": { "kid": "Rack Up", "nerd": "Chapter 6: Data Center Integration" },
  "subtitle": {
    "kid": "Put your chips to work.",
    "nerd": "Install packaged chips into powered, cooled, networked racks."
  },
  "labels": {
    "stage": { "kid": "Stage", "nerd": "Operational phase" },
    "credits": { "kid": "Credits", "nerd": "Operating budget" },
    "heat": { "kid": "Heat", "nerd": "Thermal load" },
    "power": { "kid": "Power", "nerd": "Power load/capacity" },
    "cooling": { "kid": "Cooling", "nerd": "Cooling capacity" },
    "network": { "kid": "Network", "nerd": "Network links" },
    "battery": { "kid": "Battery", "nerd": "Backup energy" },
    "compute": { "kid": "Compute", "nerd": "Effective compute" },
    "contracts": { "kid": "Jobs", "nerd": "Contracts" },
    "cityLights": { "kid": "City lights", "nerd": "Service coverage" },
    "buildRack": { "kid": "Rack", "nerd": "Build rack" },
    "buildPower": { "kid": "Power", "nerd": "Build substation" },
    "buildCooling": { "kid": "Cooling", "nerd": "Build cooling unit" },
    "buildNetwork": { "kid": "Network", "nerd": "Build network spine" },
    "buildBattery": { "kid": "Battery", "nerd": "Build backup battery" },
    "installChip": { "kid": "Install chip", "nerd": "Install selected chip" },
    "serveContract": { "kid": "Serve job", "nerd": "Serve selected contract" },
    "novaChallenge": { "kid": "Build Nova", "nerd": "Run Nova recap challenge" },
    "nextChapter": { "kid": "Finish the Run", "nerd": "Complete Rock to Rack" },
    "quizTitle": { "kid": "Field Check", "nerd": "Concept Check" },
    "stats": { "kid": "Stats", "nerd": "Run metrics" },
    "menu": { "kid": "Menu", "nerd": "Return to menu" },
    "toggleMode": { "kid": "Nerd Mode", "nerd": "Kid Mode" }
  },
  "stageNames": {
    "build": { "kid": "Build the Lot", "nerd": "Infrastructure buildout" },
    "contracts": { "kid": "Serve Jobs", "nerd": "Contract service" },
    "crisis": { "kid": "Crisis", "nerd": "Resilience event chain" },
    "nova": { "kid": "Nova Finale", "nerd": "Accelerator final workload" },
    "victory": { "kid": "City Online", "nerd": "Run complete" }
  },
  "messages": {
    "buildHint": {
      "kid": "Build racks, power, cooling, network, and battery before taking big jobs.",
      "nerd": "Balance rack capacity against power capacity, cooling headroom, network links, and backup energy."
    },
    "selectRack": {
      "kid": "Pick a rack, then install a chip.",
      "nerd": "Select a rack with open slots before installing available packaged chips."
    },
    "contractReady": {
      "kid": "This job is ready.",
      "nerd": "Current installed chips and infrastructure satisfy this contract."
    },
    "contractBlocked": {
      "kid": "This job needs more chips or infrastructure.",
      "nerd": "Requirements are not met: check chip IDs, compute, power, cooling, and network links."
    },
    "heatWarning": {
      "kid": "The racks are getting hot.",
      "nerd": "Thermal load is approaching the throttle threshold."
    },
    "powerWarning": {
      "kid": "Power is overloaded.",
      "nerd": "Power load exceeds capacity; effective compute is throttled."
    },
    "novaLocked": {
      "kid": "Nova needs one perfect 7nm die.",
      "nerd": "The accelerator recap requires one perfect 7nm-class die from Chapter 5."
    },
    "victoryReady": {
      "kid": "The city is online.",
      "nerd": "The final workload is served; the supply chain has become useful compute."
    }
  },
  "intro": [
    {
      "speaker": "Sam",
      "portrait": "sam",
      "text": {
        "kid": "We made chips. Why do we need a whole building now?",
        "nerd": "We have packaged chips. Why does compute require so much facility infrastructure?"
      }
    },
    {
      "speaker": "Dr. Vega",
      "portrait": "vega",
      "text": {
        "kid": "A chip is powerful, but a data center is a team: racks, power, cooling, and network.",
        "nerd": "Compute only becomes a service when chips are integrated with power delivery, thermal control, networking, and redundancy."
      }
    },
    {
      "speaker": "Sam",
      "portrait": "sam",
      "text": {
        "kid": "So the last step is keeping the team alive?",
        "nerd": "So the final constraint is system integration, not just transistor performance?"
      }
    },
    {
      "speaker": "Dr. Vega",
      "portrait": "vega",
      "text": {
        "kid": "Exactly. Build the lot, serve real jobs, and bring the city online.",
        "nerd": "Exactly. Meet workload requirements while staying inside power and thermal envelopes."
      }
    }
  ],
  "facts": {
    "datacenterAnatomy": {
      "id": "ch6-datacenter-anatomy",
      "title": { "kid": "A Data Center Is a Team", "nerd": "Data Center System Integration" },
      "kid": "Racks hold many computers. Power feeds them. Cooling carries heat away. Networks let them work together.",
      "nerd": "Modern data centers combine compute racks, power distribution, thermal systems, storage, networking, backup power, and monitoring. The chips are essential, but the facility turns chips into reliable services."
    },
    "cooling": {
      "id": "ch6-cooling",
      "title": { "kid": "Chips Make Heat", "nerd": "Thermal Management" },
      "kid": "Busy chips get hot. If they get too hot, they slow down to protect themselves.",
      "nerd": "High utilization converts electrical energy into heat. Servers throttle or shut down when cooling cannot maintain safe operating temperatures."
    },
    "network": {
      "id": "ch6-network",
      "title": { "kid": "The Messenger Connects Racks", "nerd": "Data Center Networking" },
      "kid": "One rack is useful. Connected racks can act like one bigger computer.",
      "nerd": "Low-latency networking lets workloads span machines, storage, and accelerators. Network bottlenecks can limit useful compute even when chips are available."
    }
  },
  "completion": {
    "title": { "kid": "Rock to Rack Complete", "nerd": "Supply Chain Complete" },
    "body": {
      "kid": "You turned rocks into chips, chips into racks, and racks into a city service. Sam's tablet turns on.",
      "nerd": "The run connected mineral extraction, refining, crystal growth, fabrication, packaging, and data-center integration into delivered compute."
    },
    "tablet": {
      "kid": "Powered by YOUR chip",
      "nerd": "Powered by your completed semiconductor supply chain"
    },
    "epilogue": [
      {
        "title": { "kid": "Mine", "nerd": "Critical-mineral extraction" },
        "caption": { "kid": "The journey started underground.", "nerd": "Mineral supply constrains the semiconductor stack before any wafer exists." }
      },
      {
        "title": { "kid": "Refinery", "nerd": "Purification" },
        "caption": { "kid": "Raw rocks became clean materials.", "nerd": "Purity, energy, and waste determine usable inputs." }
      },
      {
        "title": { "kid": "Wafer", "nerd": "Crystal and wafer production" },
        "caption": { "kid": "A crystal became shiny wafers.", "nerd": "Wafer quality sets up the fab yield curve." }
      },
      {
        "title": { "kid": "Fab", "nerd": "Lithography and yield" },
        "caption": { "kid": "Tiny circuits were printed.", "nerd": "Process control determines how many good dies survive." }
      },
      {
        "title": { "kid": "Data Center", "nerd": "Compute service delivery" },
        "caption": { "kid": "The city finally used the chips.", "nerd": "Power, cooling, networking, and software turn chips into delivered services." }
      }
    ]
  }
}
```

## Task 1: Chapter 6 State, Hydration, and Fixture Contract

**Files:**
- Modify: `src/state/types.ts`
- Modify: `src/state/gameState.ts`
- Modify: `src/state/gameState.test.ts`
- Modify: `src/fixtures/chapterFixtures.ts`

- [ ] **Step 1: Write failing state tests**

Append these tests to `src/state/gameState.test.ts`:

```ts
it('initializes Chapter 6 progress', () => {
  const state = createInitialGameState();

  expect(state.chapters.ch6).toEqual({
    completed: false,
    completedAtSeconds: null,
    quizCorrect: null,
    stage: 'build',
    buildings: [],
    servedContracts: [],
    availableChipIds: [],
    installedChipIds: [],
    novaBuilt: false,
    heat: 0,
    powerCapacity: 0,
    powerLoad: 0,
    cooling: 0,
    networkLinks: 0,
    batteryCharge: 0,
    cityLights: 0,
    triggeredEvents: [],
    firstFacts: []
  });
});

it('hydrates old saves without Chapter 6 progress', () => {
  const state = hydrateGameState(JSON.stringify({
    version: SAVE_VERSION,
    preferences: { textMode: 'kid', muted: true },
    progress: { currentChapter: 6, unlockedChapters: [1, 2, 3, 4, 5, 6], activeScene: 'Ch6DatacenterScene' },
    resources: {
      minerals: { quartz: 120, copper: 72, lithium: 48, cobalt: 36, rareEarths: 24 },
      wafers: 8,
      chips: 109,
      energy: 100,
      water: 100,
      credits: 1000
    },
    chapters: {
      ch5: {
        completed: true,
        completedAtSeconds: 1020,
        quizCorrect: true,
        sortedDies: 18,
        bins: { perfect: 2, good: 4, salvage: 2 },
        selectedChipIds: ['cpu', 'gpu', 'dram', 'pmic'],
        builtChips: [
          { chipId: 'cpu', builtAtSeconds: 610 },
          { chipId: 'gpu', builtAtSeconds: 640 }
        ],
        perfect7nmDies: 1,
        triggeredEvents: [],
        firstFacts: []
      }
    },
    updatedAt: new Date(0).toISOString()
  }));

  expect(state.chapters.ch6.completed).toBe(false);
  expect(state.chapters.ch6.stage).toBe('build');
  expect(state.chapters.ch6.availableChipIds).toEqual([]);
});

it('hydrates Chapter 6 progress', () => {
  const state = hydrateGameState(JSON.stringify({
    version: SAVE_VERSION,
    preferences: { textMode: 'kid', muted: true },
    progress: { currentChapter: 6, unlockedChapters: [1, 2, 3, 4, 5, 6], activeScene: 'Ch6DatacenterScene' },
    resources: {
      minerals: { quartz: 120, copper: 72, lithium: 48, cobalt: 36, rareEarths: 24 },
      wafers: 8,
      chips: 109,
      energy: 100,
      water: 100,
      credits: 1000
    },
    chapters: {
      ch6: {
        completed: false,
        completedAtSeconds: null,
        quizCorrect: null,
        stage: 'contracts',
        buildings: [
          { id: 'rack-1', type: 'rack', column: 2, row: 2, installedChipIds: ['cpu', 'gpu'] }
        ],
        servedContracts: ['cartoonStream'],
        availableChipIds: ['cpu', 'gpu', 'dram', 'pmic'],
        installedChipIds: ['cpu', 'gpu'],
        novaBuilt: false,
        heat: 44,
        powerCapacity: 54,
        powerLoad: 28,
        cooling: 36,
        networkLinks: 2,
        batteryCharge: 35,
        cityLights: 25,
        triggeredEvents: ['heatwave'],
        firstFacts: ['ch6-datacenter-anatomy']
      }
    },
    updatedAt: new Date(0).toISOString()
  }));

  expect(state.chapters.ch6.stage).toBe('contracts');
  expect(state.chapters.ch6.buildings[0].installedChipIds).toEqual(['cpu', 'gpu']);
  expect(state.chapters.ch6.servedContracts).toEqual(['cartoonStream']);
  expect(state.chapters.ch6.triggeredEvents).toEqual(['heatwave']);
});

it('creates a chapter six fixture with Chapter 6 available chips derived from Chapter 5', () => {
  const state = createFixtureStateForScene(SceneKey.Ch6Datacenter);

  expect(state.chapters.ch5.completed).toBe(true);
  expect(state.chapters.ch6.availableChipIds).toEqual(state.chapters.ch5.selectedChipIds);
  expect(state.chapters.ch6.stage).toBe('build');
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
corepack pnpm test src/state/gameState.test.ts
```

Expected: FAIL because `ch6` and Chapter 6 hydration helpers do not exist.

- [ ] **Step 3: Add state types and defaults**

Implement the data model from this plan in `src/state/types.ts` and `createInitialGameState()` in `src/state/gameState.ts`.

- [ ] **Step 4: Add hydration helpers**

In `src/state/gameState.ts`, add these helpers and call them from `chaptersOr()`:

```ts
function isDatacenterStage(value: unknown): value is import('./types').DatacenterStage {
  return value === 'build' || value === 'contracts' || value === 'crisis' || value === 'nova' || value === 'victory';
}

function isDatacenterBuildingType(value: unknown): value is import('./types').DatacenterBuildingType {
  return value === 'rack' || value === 'power' || value === 'cooling' || value === 'network' || value === 'battery';
}

function isDatacenterContractId(value: unknown): value is import('./types').DatacenterContractId {
  return value === 'cartoonStream' || value === 'weatherAi' || value === 'cityBackup' || value === 'hospitalNova';
}

function datacenterBuildingsOr(
  value: unknown,
  fallback: GameState['chapters']['ch6']['buildings']
): GameState['chapters']['ch6']['buildings'] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .filter((item) => typeof item.id === 'string' && isDatacenterBuildingType(item.type))
    .map((item) => ({
      id: String(item.id),
      type: item.type as GameState['chapters']['ch6']['buildings'][number]['type'],
      column: numberOr(item.column, 0),
      row: numberOr(item.row, 0),
      installedChipIds: chipTypeListOr(item.installedChipIds, [])
    }));
}

function datacenterContractListOr(
  value: unknown,
  fallback: GameState['chapters']['ch6']['servedContracts']
): GameState['chapters']['ch6']['servedContracts'] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.filter((item): item is GameState['chapters']['ch6']['servedContracts'][number] => isDatacenterContractId(item));
}
```

The `ch6` object in `chaptersOr()` must hydrate every field listed in the data model, using the safe helpers for arrays.

- [ ] **Step 5: Update Ch6 fixture**

In `src/fixtures/chapterFixtures.ts`, set `chapters.ch6.availableChipIds` for `chapter >= 6`:

```ts
ch6: {
  ...state.chapters.ch6,
  availableChipIds: chapter >= 6 ? ['cpu', 'gpu', 'dram', 'pmic'] : state.chapters.ch6.availableChipIds
}
```

- [ ] **Step 6: Run state tests to verify GREEN**

Run:

```bash
corepack pnpm test src/state/gameState.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit if in a git repo**

```bash
git add src/state/types.ts src/state/gameState.ts src/state/gameState.test.ts src/fixtures/chapterFixtures.ts
git commit -m "feat(state): add chapter six progress"
```

## Task 2: Pure Data-Center Simulation

**Files:**
- Create: `src/sim/datacenter.ts`
- Create: `src/sim/datacenter.test.ts`

- [ ] **Step 1: Write failing simulation tests**

Create `src/sim/datacenter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyDatacenterEvent,
  canServeContract,
  completeNovaChallenge,
  createInitialDatacenterChapter,
  getDatacenterGoalProgress,
  installChip,
  placeDatacenterBuilding,
  serveContract,
  tickDatacenter,
  type DatacenterBalance,
  type DatacenterContractDefinition
} from './datacenter';
import type { ChapterFiveProgress, ResourceState } from '../state/types';

const balance: DatacenterBalance = {
  tickSeconds: 0.5,
  grid: { columns: 8, rows: 5 },
  rackChipSlots: 3,
  contractsToUnlockNova: 3,
  heatWarning: 65,
  heatThrottle: 85,
  maxHeat: 100,
  startingPowerCapacity: 20,
  startingCooling: 12,
  startingNetworkLinks: 0,
  startingBatteryCharge: 0,
  buildingCosts: {
    rack: { credits: 90 },
    power: { credits: 120 },
    cooling: { credits: 85, water: 4 },
    network: { credits: 75 },
    battery: { credits: 80, minerals: { lithium: 3, cobalt: 2 } }
  },
  buildingStats: {
    rack: { powerLoad: 14, heatRate: 10, compute: 18 },
    power: { powerCapacity: 34 },
    cooling: { cooling: 24, waterLoad: 2 },
    network: { networkLinks: 2 },
    battery: { batteryCharge: 35 }
  },
  chipEffects: {
    cpu: { computeMultiplier: 1.1 },
    gpu: { aiEnabled: true, computeBonus: 18, powerLoad: 6, heatRate: 8 },
    dram: { rewardMultiplier: 1.2, powerLoad: 3, heatRate: 3 },
    nand: { blackoutProtection: 40, powerLoad: 2, heatRate: 2 },
    nic: { networkMultiplier: 1.25, powerLoad: 3, heatRate: 2 },
    pmic: { powerMultiplier: 0.7 },
    nova: { aiEnabled: true, computeBonus: 42, powerLoad: 8, heatRate: 9 }
  },
  novaChallenge: { requiredAverageScore: 82, perfectDieCost: 1 },
  pacingTargetSeconds: { min: 1020, max: 1200 }
};

const contracts: DatacenterContractDefinition[] = [
  {
    id: 'cartoonStream',
    title: { kid: 'Cartoon Stream', nerd: 'Low-latency media service' },
    description: { kid: 'Stream cartoons.', nerd: 'Media workload.' },
    requiredChipIds: ['cpu', 'nand'],
    requiredCompute: 24,
    requiredNetworkLinks: 0,
    rewardCredits: 120,
    cityLights: 25
  },
  {
    id: 'weatherAi',
    title: { kid: 'Weather AI', nerd: 'Parallel forecast training job' },
    description: { kid: 'Train weather AI.', nerd: 'AI workload.' },
    requiredChipIds: ['gpu', 'dram'],
    requiredCompute: 42,
    requiredNetworkLinks: 0,
    rewardCredits: 175,
    cityLights: 25
  },
  {
    id: 'cityBackup',
    title: { kid: 'City Backup', nerd: 'Resilient municipal services' },
    description: { kid: 'Keep city online.', nerd: 'Reliability workload.' },
    requiredChipIds: ['cpu', 'nic', 'pmic'],
    requiredCompute: 38,
    requiredNetworkLinks: 2,
    rewardCredits: 160,
    cityLights: 25
  },
  {
    id: 'hospitalNova',
    title: { kid: 'Hospital Nova', nerd: 'Urgent medical imaging inference' },
    description: { kid: 'Read X-rays.', nerd: 'Medical imaging inference.' },
    requiredChipIds: ['nova', 'gpu', 'dram'],
    requiredCompute: 70,
    requiredNetworkLinks: 2,
    rewardCredits: 260,
    cityLights: 25
  }
];

const ch5: ChapterFiveProgress = {
  completed: true,
  completedAtSeconds: 1020,
  quizCorrect: true,
  sortedDies: 18,
  bins: { perfect: 2, good: 4, salvage: 2 },
  selectedChipIds: ['cpu', 'gpu', 'dram', 'nand', 'nic', 'pmic'],
  builtChips: [],
  perfect7nmDies: 1,
  triggeredEvents: [],
  firstFacts: []
};

const resources: ResourceState = {
  minerals: { quartz: 100, copper: 70, lithium: 12, cobalt: 8, rareEarths: 4 },
  wafers: 8,
  chips: 109,
  energy: 100,
  water: 100,
  credits: 1000
};

describe('datacenter simulation', () => {
  it('starts from the Chapter 5 selected chip lineup', () => {
    const chapter = createInitialDatacenterChapter(ch5, balance);

    expect(chapter.stage).toBe('build');
    expect(chapter.availableChipIds).toEqual(['cpu', 'gpu', 'dram', 'nand', 'nic', 'pmic']);
    expect(chapter.perfect7nmDies).toBe(1);
  });

  it('places buildings by spending resources and blocks occupied cells', () => {
    const chapter = createInitialDatacenterChapter(ch5, balance);
    const first = placeDatacenterBuilding(chapter, resources, 'rack', { column: 2, row: 2 }, balance);
    const second = placeDatacenterBuilding(first.chapter, first.resources, 'power', { column: 2, row: 2 }, balance);

    expect(first.ok).toBe(true);
    expect(first.resources.credits).toBe(910);
    expect(first.chapter.buildings[0]).toMatchObject({ type: 'rack', column: 2, row: 2 });
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('occupied');
  });

  it('installs available chips into rack slots only once', () => {
    const chapter = placeDatacenterBuilding(createInitialDatacenterChapter(ch5, balance), resources, 'rack', { column: 2, row: 2 }, balance).chapter;
    const installed = installChip(chapter, 'rack-1', 'cpu', balance);
    const duplicate = installChip(installed.chapter, 'rack-1', 'cpu', balance);

    expect(installed.ok).toBe(true);
    expect(installed.chapter.installedChipIds).toEqual(['cpu']);
    expect(duplicate.ok).toBe(false);
    expect(duplicate.reason).toBe('already installed');
  });

  it('computes heat, power, cooling, and effective compute from buildings and chips', () => {
    let chapter = createInitialDatacenterChapter(ch5, balance);
    let nextResources = resources;
    for (const [type, column] of [['rack', 1], ['power', 2], ['cooling', 3], ['network', 4], ['battery', 5]] as const) {
      const result = placeDatacenterBuilding(chapter, nextResources, type, { column, row: 2 }, balance);
      chapter = result.chapter;
      nextResources = result.resources;
    }
    chapter = installChip(chapter, 'rack-1', 'cpu', balance).chapter;
    chapter = installChip(chapter, 'rack-1', 'gpu', balance).chapter;
    chapter = installChip(chapter, 'rack-1', 'pmic', balance).chapter;

    const ticked = tickDatacenter(chapter, 5, balance);

    expect(ticked.powerCapacity).toBe(54);
    expect(ticked.networkLinks).toBe(2);
    expect(ticked.powerLoad).toBeLessThan(28);
    expect(ticked.effectiveCompute).toBeGreaterThan(35);
    expect(ticked.heat).toBeLessThan(30);
  });

  it('requires contract chips and infrastructure before serving', () => {
    let chapter = createInitialDatacenterChapter(ch5, balance);
    let nextResources = resources;
    for (const [type, column] of [['rack', 1], ['power', 2], ['cooling', 3], ['network', 4]] as const) {
      const result = placeDatacenterBuilding(chapter, nextResources, type, { column, row: 2 }, balance);
      chapter = result.chapter;
      nextResources = result.resources;
    }
    chapter = installChip(chapter, 'rack-1', 'cpu', balance).chapter;
    chapter = installChip(chapter, 'rack-1', 'nand', balance).chapter;
    chapter = tickDatacenter(chapter, 1, balance);

    expect(canServeContract(chapter, contracts[0], balance).ok).toBe(true);
    expect(canServeContract(chapter, contracts[1], balance).ok).toBe(false);
  });

  it('serves contracts, rewards credits, advances city lights, and unlocks Nova stage after three contracts', () => {
    let chapter = createReadyChapter();
    let nextResources = resources;

    for (const contract of contracts.slice(0, 3)) {
      const result = serveContract(chapter, nextResources, contract, balance);
      expect(result.ok).toBe(true);
      chapter = result.chapter;
      nextResources = result.resources;
    }

    expect(chapter.servedContracts).toEqual(['cartoonStream', 'weatherAi', 'cityBackup']);
    expect(chapter.cityLights).toBe(75);
    expect(chapter.stage).toBe('nova');
    expect(nextResources.credits).toBeGreaterThan(resources.credits);
  });

  it('applies crisis events only once', () => {
    const chapter = createReadyChapter();
    const first = applyDatacenterEvent(chapter, 'heatwave', 'add-cooling', balance);
    const second = applyDatacenterEvent(first, 'heatwave', 'add-cooling', balance);

    expect(first.triggeredEvents).toEqual(['heatwave']);
    expect(first.cooling).toBeGreaterThan(chapter.cooling);
    expect(second).toBe(first);
  });

  it('builds Nova from a successful recap challenge and one perfect die', () => {
    const chapter = createReadyChapter();
    const result = completeNovaChallenge(chapter, { mask: 86, etch: 84, cooling: 82 }, balance);

    expect(result.ok).toBe(true);
    expect(result.chapter.novaBuilt).toBe(true);
    expect(result.chapter.availableChipIds).toContain('nova');
    expect(result.chapter.perfect7nmDies).toBe(0);
  });

  it('marks goal complete only after the final Nova contract', () => {
    let chapter = createReadyChapter();
    let nextResources = resources;
    for (const contract of contracts.slice(0, 3)) {
      const result = serveContract(chapter, nextResources, contract, balance);
      chapter = result.chapter;
      nextResources = result.resources;
    }
    chapter = completeNovaChallenge(chapter, { mask: 90, etch: 88, cooling: 86 }, balance).chapter;
    chapter = installChip(chapter, 'rack-1', 'nova', balance).chapter;
    chapter = tickDatacenter(chapter, 1, balance);
    chapter = serveContract(chapter, nextResources, contracts[3], balance).chapter;

    expect(getDatacenterGoalProgress(chapter, contracts).complete).toBe(true);
    expect(chapter.stage).toBe('victory');
    expect(chapter.cityLights).toBe(100);
  });
});

function createReadyChapter() {
  let chapter = createInitialDatacenterChapter(ch5, balance);
  let nextResources = resources;
  for (const [type, column] of [['rack', 1], ['power', 2], ['cooling', 3], ['network', 4], ['battery', 5]] as const) {
    const result = placeDatacenterBuilding(chapter, nextResources, type, { column, row: 2 }, balance);
    chapter = result.chapter;
    nextResources = result.resources;
  }
  for (const chip of ['cpu', 'nand', 'gpu', 'dram', 'nic', 'pmic'] as const) {
    const rackId = chip === 'nic' || chip === 'pmic' ? 'rack-2' : 'rack-1';
    if (rackId === 'rack-2' && !chapter.buildings.some((building) => building.id === 'rack-2')) {
      const result = placeDatacenterBuilding(chapter, nextResources, 'rack', { column: 6, row: 2 }, balance);
      chapter = result.chapter;
      nextResources = result.resources;
    }
    chapter = installChip(chapter, rackId, chip, balance).chapter;
  }
  return tickDatacenter(chapter, 1, balance);
}
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
corepack pnpm test src/sim/datacenter.test.ts
```

Expected: FAIL because `src/sim/datacenter.ts` does not exist.

- [ ] **Step 3: Implement `src/sim/datacenter.ts`**

Implement these exported types and functions:

```ts
import type {
  ChapterFiveProgress,
  ChapterSixProgress,
  ChipTypeId,
  DatacenterBuildingType,
  DatacenterContractId,
  DatacenterGridPosition,
  ResourceState
} from '../state/types';
import type { ResourceCost } from './economy';
import type { TextModeText } from '../ui/text';

export interface DatacenterBalance {
  tickSeconds: number;
  grid: { columns: number; rows: number };
  rackChipSlots: number;
  contractsToUnlockNova: number;
  heatWarning: number;
  heatThrottle: number;
  maxHeat: number;
  startingPowerCapacity: number;
  startingCooling: number;
  startingNetworkLinks: number;
  startingBatteryCharge: number;
  buildingCosts: Record<DatacenterBuildingType, ResourceCost>;
  buildingStats: {
    rack: { powerLoad: number; heatRate: number; compute: number };
    power: { powerCapacity: number };
    cooling: { cooling: number; waterLoad: number };
    network: { networkLinks: number };
    battery: { batteryCharge: number };
  };
  chipEffects: Record<ChipTypeId, {
    computeMultiplier?: number;
    computeBonus?: number;
    rewardMultiplier?: number;
    powerLoad?: number;
    heatRate?: number;
    powerMultiplier?: number;
    networkMultiplier?: number;
    aiEnabled?: boolean;
    blackoutProtection?: number;
  }>;
  novaChallenge: { requiredAverageScore: number; perfectDieCost: number };
  pacingTargetSeconds: { min: number; max: number };
}

export interface DatacenterContractDefinition {
  id: DatacenterContractId;
  title: TextModeText;
  description: TextModeText;
  requiredChipIds: ChipTypeId[];
  requiredCompute: number;
  requiredNetworkLinks: number;
  rewardCredits: number;
  cityLights: number;
}

export interface DatacenterChapterState extends ChapterSixProgress {
  elapsedSeconds: number;
  perfect7nmDies: number;
  effectiveCompute: number;
  selectedBuildingId: string | null;
  selectedContractId: DatacenterContractId | null;
}

export interface DatacenterBuildResult {
  ok: boolean;
  chapter: DatacenterChapterState;
  resources: ResourceState;
  reason?: 'out of bounds' | 'occupied' | 'insufficient resources';
}

export interface DatacenterChipResult {
  ok: boolean;
  chapter: DatacenterChapterState;
  reason?: 'building not found' | 'not a rack' | 'chip unavailable' | 'already installed' | 'rack full';
}

export interface DatacenterContractCheck {
  ok: boolean;
  reasons: string[];
}

export interface DatacenterContractResult {
  ok: boolean;
  chapter: DatacenterChapterState;
  resources: ResourceState;
  reason?: 'already served' | 'requirements unmet';
}

export interface NovaChallengeScores {
  mask: number;
  etch: number;
  cooling: number;
}

export interface NovaChallengeResult {
  ok: boolean;
  chapter: DatacenterChapterState;
  reason?: 'needs perfect die' | 'score too low' | 'already built';
}

export function createInitialDatacenterChapter(ch5: ChapterFiveProgress, balance: DatacenterBalance): DatacenterChapterState;
export function placeDatacenterBuilding(chapter: DatacenterChapterState, resources: ResourceState, type: DatacenterBuildingType, position: DatacenterGridPosition, balance: DatacenterBalance): DatacenterBuildResult;
export function installChip(chapter: DatacenterChapterState, buildingId: string, chipId: ChipTypeId, balance: DatacenterBalance): DatacenterChipResult;
export function tickDatacenter(chapter: DatacenterChapterState, seconds: number, balance: DatacenterBalance): DatacenterChapterState;
export function canServeContract(chapter: DatacenterChapterState, contract: DatacenterContractDefinition, balance: DatacenterBalance): DatacenterContractCheck;
export function serveContract(chapter: DatacenterChapterState, resources: ResourceState, contract: DatacenterContractDefinition, balance: DatacenterBalance): DatacenterContractResult;
export function applyDatacenterEvent(chapter: DatacenterChapterState, event: 'heatwave' | 'brownout', choiceId: string, balance: DatacenterBalance): DatacenterChapterState;
export function completeNovaChallenge(chapter: DatacenterChapterState, scores: NovaChallengeScores, balance: DatacenterBalance): NovaChallengeResult;
export function getDatacenterGoalProgress(chapter: DatacenterChapterState, contracts: DatacenterContractDefinition[]): { complete: boolean; servedContracts: number; cityLights: number };
```

Implementation rules:
- No DOM, Phaser, localStorage, or JSON imports in `src/sim/datacenter.ts`.
- Building IDs must be deterministic: first rack is `rack-1`, first power is `power-1`.
- `placeDatacenterBuilding()` must validate grid bounds, occupied cells, and resource cost through `canSpendResources()` / `spendResources()` from `src/sim/economy.ts`.
- `installChip()` must only install chips that are in `availableChipIds`, not already installed, and only into racks with fewer than `rackChipSlots`.
- `tickDatacenter()` must derive `powerCapacity`, `powerLoad`, `cooling`, `networkLinks`, `batteryCharge`, `effectiveCompute`, and `heat` from buildings and installed chips.
- PMIC must reduce total power load using `powerMultiplier`.
- NIC must multiply effective compute only when at least one network spine exists.
- Overloaded power or heat above `heatThrottle` must reduce `effectiveCompute` by 35%.
- `serveContract()` must add reward credits, mark contract served once, add city lights, set `stage` to `nova` after three non-final contracts, and set `stage` to `victory` after `hospitalNova`.
- `completeNovaChallenge()` must require one perfect 7nm die and average score at least `requiredAverageScore`.

- [ ] **Step 4: Run simulation tests to verify GREEN**

Run:

```bash
corepack pnpm test src/sim/datacenter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit if in a git repo**

```bash
git add src/sim/datacenter.ts src/sim/datacenter.test.ts
git commit -m "feat(sim): add datacenter finale mechanics"
```

## Task 3: Chapter 6 Content

**Files:**
- Modify: `src/content/balance.json`
- Modify: `src/content/events.json`
- Modify: `src/content/quiz.json`
- Modify: `src/content/strings.json`
- Modify: `src/content/SOURCES.md`

- [ ] **Step 1: Add content JSON**

Add the `ch6`, `ch6Contracts`, `ch6Heatwave`, `ch6Brownout`, and `ch6FieldCheck` content blocks from the Content Contracts section.

- [ ] **Step 2: Parse JSON**

Run:

```bash
node -e "for (const file of ['src/content/balance.json','src/content/events.json','src/content/quiz.json','src/content/strings.json']) { JSON.parse(require('fs').readFileSync(file, 'utf8')); console.log(file + ' OK'); }"
```

Expected:

```text
src/content/balance.json OK
src/content/events.json OK
src/content/quiz.json OK
src/content/strings.json OK
```

- [ ] **Step 3: Add source notes**

Append to `src/content/SOURCES.md`:

```md
## M7 Chapter 6 Data Center Content

- Chapter 6 data-center content uses conservative, non-numeric educational statements about racks, power, cooling, networking, backup power, and throttling.
- The M7 implementation intentionally avoids volatile current market stats. M8/M10 should fact-check any specific data-center power draw, cooling, or facility-size statistic before adding it to player-facing copy.
```

- [ ] **Step 4: Run full tests**

Run:

```bash
corepack pnpm test
```

Expected: PASS.

- [ ] **Step 5: Commit if in a git repo**

```bash
git add src/content/balance.json src/content/events.json src/content/quiz.json src/content/strings.json src/content/SOURCES.md
git commit -m "feat(content): add chapter six datacenter content"
```

## Task 4: Chapter 6 DOM Overlay

**Files:**
- Create: `src/ui/chapterSixOverlay.ts`

- [ ] **Step 1: Create overlay API**

Create `src/ui/chapterSixOverlay.ts` exporting:

```ts
import type {
  DatacenterBuildingType,
  DatacenterContractId,
  ChipTypeId,
  ResourceState,
  TextMode
} from '../state/types';
import type {
  DatacenterBalance,
  DatacenterChapterState,
  DatacenterContractDefinition
} from '../sim/datacenter';
import {
  mountQuizOverlay,
  type MountedModal,
  type QuizAnswerDefinition,
  type QuizDefinition
} from './chapterOneOverlay';
import type { TextModeText } from './text';

export interface ChapterSixLabels {
  stage: TextModeText;
  credits: TextModeText;
  heat: TextModeText;
  power: TextModeText;
  cooling: TextModeText;
  network: TextModeText;
  battery: TextModeText;
  compute: TextModeText;
  contracts: TextModeText;
  cityLights: TextModeText;
  buildRack: TextModeText;
  buildPower: TextModeText;
  buildCooling: TextModeText;
  buildNetwork: TextModeText;
  buildBattery: TextModeText;
  installChip: TextModeText;
  serveContract: TextModeText;
  novaChallenge: TextModeText;
  nextChapter: TextModeText;
  quizTitle: TextModeText;
  stats: TextModeText;
  menu: TextModeText;
  toggleMode: TextModeText;
}

export interface ChapterSixOverlayOptions {
  chapter: DatacenterChapterState;
  resources: ResourceState;
  balance: DatacenterBalance;
  contracts: DatacenterContractDefinition[];
  labels: ChapterSixLabels;
  stageNames: Record<DatacenterChapterState['stage'], TextModeText>;
  textMode: TextMode;
  message: TextModeText | null;
  selectedBuildType: DatacenterBuildingType | null;
  selectedBuildingId: string | null;
  selectedChipId: ChipTypeId | null;
  selectedContractId: DatacenterContractId | null;
  canInstallSelectedChip: boolean;
  canServeSelectedContract: boolean;
  canRunNovaChallenge: boolean;
  onSelectBuildType: (type: DatacenterBuildingType) => void;
  onSelectChip: (chipId: ChipTypeId) => void;
  onInstallSelectedChip: () => void;
  onSelectContract: (contractId: DatacenterContractId) => void;
  onServeSelectedContract: () => void;
  onRunNovaChallenge: () => void;
  onToggleMode: () => void;
  onMenu: () => void;
}

export interface MountedChapterSixOverlay {
  update: (options: ChapterSixOverlayOptions) => void;
  cleanup: () => void;
}
export function mountChapterSixOverlay(root: HTMLElement, options: ChapterSixOverlayOptions): MountedChapterSixOverlay;
export function mountChapterSixQuiz(root: HTMLElement, options: { quiz: QuizDefinition; labels: ChapterSixLabels; textMode: TextMode; onAnswer: (answer: QuizAnswerDefinition) => void }): MountedModal;
export function mountChapterSixComplete(root: HTMLElement, options: { title: TextModeText; body: TextModeText; tablet: TextModeText; epilogue: Array<{ title: TextModeText; caption: TextModeText }>; labels: ChapterSixLabels; textMode: TextMode; elapsedSeconds: number; servedContracts: number; cityLights: number; medal: string; onNext: () => void }): MountedModal;
```

Use existing imports from `chapterOneOverlay.ts` for quiz and modal types, and `textForMode()` from `src/ui/text.ts`.

- [ ] **Step 2: Implement overlay sections**

`mountChapterSixOverlay()` must render:
- `.ch6-status-panel`: stage, heat, power, cooling, network, battery, city lights.
- `.ch6-build-panel`: five build buttons, disabled when resources are insufficient.
- `.ch6-chip-panel`: available chip chips, installed state, selected chip install action.
- `.ch6-contract-panel`: contract ticker with ready/blocked state and serve button.
- `.ch6-action-panel`: Nova challenge, text mode toggle, menu.

Callbacks:

```ts
onSelectBuildType(type: DatacenterBuildingType): void;
onSelectChip(chipId: ChipTypeId): void;
onInstallSelectedChip(): void;
onSelectContract(contractId: DatacenterContractId): void;
onServeSelectedContract(): void;
onRunNovaChallenge(): void;
onToggleMode(): void;
onMenu(): void;
```

- [ ] **Step 3: Reuse shared quiz bridge**

Implement `chapterOneLabelBridge(labels)` like Chapters 2-5. Map:
- `quizTitle` to `quizTitle`
- `toggleMode` to `toggleMode`
- `menu` to `menu`
- `nextChapter` to `chapterComplete` and `nextChapter`

- [ ] **Step 4: Type-check overlay**

Run:

```bash
corepack pnpm build
```

Expected: TypeScript passes. Vite build may retain the known Phaser chunk-size warning.

- [ ] **Step 5: Commit if in a git repo**

```bash
git add src/ui/chapterSixOverlay.ts
git commit -m "feat(ui): add chapter six overlay"
```

## Task 5: Replace Chapter 6 Stub Scene

**Files:**
- Modify: `src/scenes/Ch6DatacenterScene.ts`

- [ ] **Step 1: Replace stub with Phaser scene shell**

`Ch6DatacenterScene` must extend `Phaser.Scene`, not `ChapterStubScene`.

Required imports:
- `balance.json`, `chips.json`, `events.json`, `quiz.json`, `strings.json`
- `applyEventChoice` from `src/sim/events.ts`
- all Chapter 6 functions from `src/sim/datacenter.ts`
- `gameStore`
- `mountChapterSixOverlay`, `mountChapterSixQuiz`, `mountChapterSixComplete`
- shared `mountPipelineHud`, `mountDialogue`, `mountFactCard`, `mountEventCard`

Scene constants:

```ts
const GRID_ORIGIN = { x: 244, y: 156 };
const CELL = { width: 92, height: 72 };
const GRID_COLUMNS = 8;
const GRID_ROWS = 5;
```

- [ ] **Step 2: Implement lifecycle**

`create()` must:
1. `gameStore.enterScene(SceneKey.Ch6Datacenter, 6)`
2. create runtime chapter state from `createChapterSixState()`
3. reset transient scene fields
4. draw backdrop and grid
5. mount HUD and Chapter 6 overlay
6. show intro dialogue
7. start tick timer from `BALANCE.ch6.tickSeconds`
8. register shutdown cleanup

`createChapterSixState()` must:
- If `gameStore.getState().chapters.ch6.buildings.length > 0`, resume from `ch6`.
- Otherwise call `createInitialDatacenterChapter(gameStore.getState().chapters.ch5, BALANCE.ch6)`.
- Use `ch5.selectedChipIds` as `availableChipIds`.

- [ ] **Step 3: Implement grid input and building placement**

Pointer handling:
- Convert pointer world position into `{ column, row }`.
- Ignore clicks outside the 8 x 5 grid.
- If a build type is selected, call `placeDatacenterBuilding()`.
- If an existing building is clicked, set `selectedBuildingId`.
- Persist progress after every successful building placement.

- [ ] **Step 4: Implement chip installation and contracts**

Overlay callbacks must:
- select chip
- install chip into selected rack through `installChip()`
- select contract
- serve contract through `serveContract()`
- run Nova challenge through `completeNovaChallenge()` with deterministic scores `{ mask: 86, etch: 84, cooling: 83 }`

Persist progress after every successful chip install, contract serve, or Nova challenge.

- [ ] **Step 5: Implement fact cards and crisis cards**

Fact cards:
- Show `ch6-datacenter-anatomy` after first rack is placed.
- Show `ch6-cooling` after first cooling unit is placed or heat reaches warning.
- Show `ch6-network` after first network spine is placed.

Crisis events:
- After two served contracts, show `ch6Heatwave` if not triggered.
- After three served contracts, show `ch6Brownout` if not triggered.
- Use `mountEventCard()` and `applyEventChoice()` for resource effects.
- Also call `applyDatacenterEvent()` to mark and adjust the chapter simulation.

- [ ] **Step 6: Implement completion path**

After `hospitalNova` is served:
1. Set `chapter.stage = 'victory'`.
2. Persist `chapters.ch6.completed = false` until quiz is answered.
3. Show Chapter 6 Field Check.
4. Correct answer opens completion modal.
5. Completion modal sets `chapters.ch6.completed = true`, `completedAtSeconds`, `quizCorrect = true`, `progress.currentChapter = 6`, and keeps `unlockedChapters` through 6.

Wrong answer behavior:
- Reuse the existing retry pattern from Chapter 5.
- Store a scene-local timeout ID.
- Clear the timeout on cleanup.

- [ ] **Step 7: Draw world**

Canvas drawing must include:
- top-down empty lot background
- 8 x 5 isometric-flavored grid
- building shapes with clear icons:
  - rack: dark cabinet with chip slots
  - power: yellow substation block
  - cooling: blue fan block
  - network: green spine node
  - battery: purple battery block
- rack glow red when heat is above `heatWarning`
- city skyline at top or side lighting up by `cityLights`
- bottom miniature supply-chain pipeline with six labeled nodes: Mine, Refine, Grow, Fab, Package, Rack

Do not use dense in-canvas text for controls; keep controls in DOM.

- [ ] **Step 8: Type-check scene**

Run:

```bash
corepack pnpm build
```

Expected: TypeScript passes.

- [ ] **Step 9: Commit if in a git repo**

```bash
git add src/scenes/Ch6DatacenterScene.ts
git commit -m "feat(scene): build chapter six datacenter finale"
```

## Task 6: Styling and Responsive Layout

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add Ch6 CSS**

Add `.ch6-*` classes for:
- `.ch6-overlay`
- `.ch6-status-panel`
- `.ch6-build-panel`
- `.ch6-chip-panel`
- `.ch6-contract-panel`
- `.ch6-action-panel`
- `.ch6-chip-card`
- `.ch6-chip-card.installed`
- `.ch6-contract-card`
- `.ch6-contract-card.ready`
- `.ch6-meter`
- `.ch6-complete-card`
- `.ch6-epilogue`

Design constraints:
- Data-center accent color: blue, with secondary green/yellow warning colors.
- Keep center playfield visible on desktop.
- Cards radius 8px or less.
- Mobile 390 x 844 must keep HUD, status, build/chip/contract/action panels inside viewport without overlap.
- Avoid a one-note dark-blue-only palette by using yellow power, green network, blue cooling, and magenta/purple battery accents.

- [ ] **Step 2: Build**

Run:

```bash
corepack pnpm build
```

Expected: PASS.

- [ ] **Step 3: Commit if in a git repo**

```bash
git add src/styles.css
git commit -m "style(ch6): add datacenter responsive layout"
```

## Task 7: End-to-End Verification

**Files:**
- Modify: `docs/agent-context.md`

- [ ] **Step 1: Run automated verification**

Run:

```bash
corepack pnpm test
corepack pnpm build
node -e "for (const file of ['src/content/balance.json','src/content/chips.json','src/content/events.json','src/content/quiz.json','src/content/strings.json']) { JSON.parse(require('fs').readFileSync(file, 'utf8')); console.log(file + ' OK'); }"
```

Expected:
- Vitest passes.
- TypeScript passes through `corepack pnpm build`.
- Vite production build passes with only the known Phaser chunk-size warning.
- JSON parse reports all five files OK.

- [ ] **Step 2: Browser smoke test**

Start or reuse Vite:

```bash
corepack pnpm dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5174/?reset#ch6
```

Smoke path:
1. Dismiss intro.
2. Verify fixture starts with completed Ch5 and available chip cards.
3. Build rack, power, cooling, network, and battery.
4. Select rack and install CPU, GPU, DRAM, and PMIC if available.
5. Serve available contracts; if a contract needs NAND/NIC and the default fixture lacks it, verify the blocked state is explicit and use the fixture/default lineup that includes the needed chips for the smoke path.
6. Trigger heatwave and brownout cards.
7. Run Nova challenge.
8. Install Nova.
9. Serve Hospital Nova.
10. Answer Field Check correctly.
11. Verify victory modal appears with city/tablet/epilogue content.
12. Verify live state:
    - `currentChapter = 6`
    - `activeScene = Ch6DatacenterScene`
    - `ch6.completed = true`
    - `ch6.quizCorrect = true`
    - `ch6.servedContracts` includes `hospitalNova`
    - `ch6.cityLights = 100`

Capture screenshots:
- `/tmp/rock-to-rack-m7-ch6-build.png`
- `/tmp/rock-to-rack-m7-ch6-contracts.png`
- `/tmp/rock-to-rack-m7-ch6-crisis.png`
- `/tmp/rock-to-rack-m7-ch6-victory.png`
- `/tmp/rock-to-rack-m7-ch6-mobile.png`

- [ ] **Step 3: Mobile layout check**

At 390 x 844, capture bounding boxes for:
- `.pipeline-hud`
- `.ch6-status-panel`
- `.ch6-build-panel`
- `.ch6-chip-panel`
- `.ch6-contract-panel`
- `.ch6-action-panel`

Expected:
- no overlapping boxes
- no panel extends beyond viewport
- all action buttons are visible
- canvas grid remains visible behind or between panels

- [ ] **Step 4: Console check**

Expected:
- no app/runtime errors
- existing missing `favicon.ico` 404 may remain until M10
- WebGL screenshot performance warnings are acceptable if only emitted during screenshot capture

- [ ] **Step 5: Update handoff**

Update `docs/agent-context.md`:
- Current state: M1-M7 implemented and verified.
- `#ch6` playable and completes the current run.
- M8 is the next milestone: Codex, analytics, save polish.
- Add M7 key files.
- Add M7 verification results.
- Add screenshot paths.
- Add future-agent constraints learned during Ch6 QA.

- [ ] **Step 6: Moderator Review**

Use the required template:

```text
╔══════════════════════════════════════╗
║         MODERATOR REVIEW             ║
╠══════════════════════════════════════╣
║ Scope: M7 Chapter 6 sim/state/content/UI/scene/CSS/tests/browser QA
╠══════════════════════════════════════╣
║ [BLOCK] None if no critical issue was found; otherwise one concrete issue
║ [WARN]  Existing favicon.ico 404 may remain until M10 if it is the only console warning
║ [NIT]   None if no minor issue was found; otherwise one concrete issue
║ [IDEA]  Record one optional M8/M9/M10 improvement without acting on it during M7
╠══════════════════════════════════════╣
║ Verdict: PASS | NEEDS_FIXES | REDESIGN
╚══════════════════════════════════════╝
```

If verdict is `NEEDS_FIXES`, fix every `[BLOCK]`, rerun verification, and repeat Moderator Review.

- [ ] **Step 7: Retrospective**

Use:

```text
╔══════════════════════════════════╗
║         RETROSPECTIVE            ║
╠══════════════════════════════════╣
║ ✓ Worked:    One concrete practice that improved M7 execution
║ ✗ Didn't:    One concrete friction point or escaped issue from M7
║ → Rule:      One concrete future rule proposal
╚══════════════════════════════════╝
```

- [ ] **Step 8: Commit if in a git repo**

```bash
git add docs/agent-context.md
git commit -m "docs: update handoff for chapter six"
```

## Execution Notes

- Use at most two parallel implementation subagents unless the user explicitly approves more.
- Recommended split:
  - `@architect` or `@data`: Tasks 1-2, state and pure sim.
  - `@frontend`: Tasks 4-6, overlay/scene/CSS.
  - Coordinator: Task 3 content integration, Task 7 verification, Moderator, Retrospective.
- Keep each new pure function under test before writing production code.
- Do not add new dependencies.
- Do not promote or deploy anything for M7.
- Keep M8 out of scope: no Codex UI, analytics endpoint, save version migration redesign, service worker, favicon, or production deploy.

## Self-Review

Spec coverage:
- Grid data-center buildout: Tasks 2, 5, 6.
- Racks, power, cooling, network, battery: Tasks 2, 3, 4, 5.
- Contracts from `events.json`: Task 3 and Task 5.
- Chip superpowers visibly matter: Task 2 sim effects, Task 4 chip panel, Task 5 rendering.
- Heat/power constraints: Task 2 tests and Task 5 world rendering.
- Supply-chain pipeline signature image: Task 5 draw world.
- Heatwave + brownout crisis: Task 3 content, Task 5 event cards.
- Nova finale: Task 2 tests, Task 5 completion path.
- Victory cinematic/modal and epilogue placeholders: Task 4 completion modal, Task 5 completion path.
- Browser/mobile verification: Task 7.

Placeholder scan:
- No unresolved task names or unassigned content blocks remain.

Type consistency:
- `DatacenterContractId` values match `ch6Contracts` IDs.
- `DatacenterBuildingType` values match balance keys and overlay callbacks.
- `ChapterSixProgress` fields match hydration, fixture, and sim chapter state expectations.
