import { bestCrisisRun } from '../sim/crisisRun';
import balanceJson from '../content/balance.json';
import type {
  CrisisRunResult,
  DatacenterBuildingType,
  DatacenterContractId,
  DatacenterStage,
  GameState,
  MineDepositProgress,
  MetaProgressState,
  MineralType,
  PlacedMinerProgress,
  TextMode,
  TextSize
} from './types';

export const SAVE_VERSION = 5;

const MINERALS: MineralType[] = ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'];
const BALANCE = balanceJson as { ch1: { deposits: MineDepositProgress[] } };

export function createInitialGameState(): GameState {
  return {
    version: SAVE_VERSION,
    preferences: {
      textMode: 'kid',
      muted: true,
      textSize: 'normal'
    },
    progress: {
      currentChapter: 1,
      unlockedChapters: [1],
      activeScene: 'MenuScene'
    },
    resources: {
      minerals: Object.fromEntries(MINERALS.map((mineral) => [mineral, 0])) as Record<MineralType, number>,
      wafers: 0,
      chips: 0,
      energy: 100,
      water: 100,
      credits: 250
    },
    chapters: {
      ch1: {
        firstMined: [],
        deposits: initialChapterOneDeposits(),
        miners: [],
        elapsedSeconds: 0,
        triggeredEvents: [],
        completed: false,
        completedAtSeconds: null,
        quizCorrect: null
      },
      ch2: {
        completed: false,
        completedAtSeconds: null,
        quizCorrect: null,
        siliconPurityNines: 2,
        refinedOutputs: {},
        slag: 0,
        storedSlag: 0,
        firstFacts: []
      },
      ch3: {
        completed: false,
        completedAtSeconds: null,
        quizCorrect: null,
        ingotQuality: 0,
        waferQuality: 0,
        wafersProduced: 0,
        retryUsed: false,
        firstFacts: []
      },
      ch4: {
        completed: false,
        completedAtSeconds: null,
        quizCorrect: null,
        wafersProcessed: 0,
        averageYield: 0,
        bestYield: 0,
        chipsProduced: 0,
        nodeYields: [],
        firstFacts: []
      },
      ch5: {
        completed: false,
        completedAtSeconds: null,
        quizCorrect: null,
        sortedDies: 0,
        bins: { perfect: 0, good: 0, salvage: 0 },
        selectedChipIds: [],
        builtChips: [],
        perfect7nmDies: 0,
        triggeredEvents: [],
        firstFacts: []
      },
      ch6: {
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
        eventDeltas: { powerCapacity: 0, cooling: 0, batteryCharge: 0 },
        triggeredEvents: [],
        firstFacts: []
      }
    },
    meta: {
      crisisRuns: [],
      bestCrisisRun: null,
      totalCrisisRuns: 0
    },
    updatedAt: new Date(0).toISOString()
  };
}

export function hydrateGameState(raw: string | null): GameState {
  if (!raw) {
    return createInitialGameState();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return createInitialGameState();
    }

    const parsedVersion = numberOr(parsed.version, 0);
    if (parsedVersion < 1 || parsedVersion > SAVE_VERSION) {
      return createInitialGameState();
    }

    const base = createInitialGameState();
    const preferences = isRecord(parsed.preferences) ? parsed.preferences : {};
    const progress = isRecord(parsed.progress) ? parsed.progress : {};
    const resources = isRecord(parsed.resources) ? parsed.resources : {};
    const chapters = isRecord(parsed.chapters) ? parsed.chapters : {};
    const meta = isRecord(parsed.meta) ? parsed.meta : {};

    return {
      ...base,
      preferences: {
        textMode: isTextMode(preferences.textMode) ? preferences.textMode : base.preferences.textMode,
        muted: typeof preferences.muted === 'boolean' ? preferences.muted : base.preferences.muted,
        textSize: isTextSize(preferences.textSize) ? preferences.textSize : base.preferences.textSize
      },
      progress: {
        currentChapter: numberOr(progress.currentChapter, base.progress.currentChapter),
        unlockedChapters: chapterListOr(progress.unlockedChapters, base.progress.unlockedChapters),
        activeScene: stringOr(progress.activeScene, base.progress.activeScene)
      },
      resources: {
        minerals: mineralsOr(resources.minerals, base.resources.minerals),
        wafers: numberOr(resources.wafers, base.resources.wafers),
        chips: numberOr(resources.chips, base.resources.chips),
        energy: numberOr(resources.energy, base.resources.energy),
        water: numberOr(resources.water, base.resources.water),
        credits: numberOr(resources.credits, base.resources.credits)
      },
      chapters: chaptersOr(chapters, base.chapters),
      meta: metaOr(meta, base.meta),
      updatedAt: stringOr(parsed.updatedAt, new Date().toISOString())
    };
  } catch {
    return createInitialGameState();
  }
}

export function serializeGameState(state: GameState): string {
  return JSON.stringify({
    ...state,
    updatedAt: new Date().toISOString()
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTextMode(value: unknown): value is TextMode {
  return value === 'kid' || value === 'nerd';
}

function isTextSize(value: unknown): value is TextSize {
  return value === 'normal' || value === 'large';
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function chapterListOr(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const chapters = value.filter((chapter): chapter is number => Number.isInteger(chapter) && chapter >= 1 && chapter <= 6);
  return chapters.length > 0 ? [...new Set(chapters)].sort((a, b) => a - b) : fallback;
}

function mineralsOr(value: unknown, fallback: Record<MineralType, number>): Record<MineralType, number> {
  if (!isRecord(value)) {
    return fallback;
  }

  return Object.fromEntries(
    MINERALS.map((mineral) => [mineral, numberOr(value[mineral], fallback[mineral])])
  ) as Record<MineralType, number>;
}

function chaptersOr(value: unknown, fallback: GameState['chapters']): GameState['chapters'] {
  if (!isRecord(value)) {
    return fallback;
  }

  const ch1 = isRecord(value.ch1) ? value.ch1 : {};
  const ch2 = isRecord(value.ch2) ? value.ch2 : {};
  const ch3 = isRecord(value.ch3) ? value.ch3 : {};
  const ch4 = isRecord(value.ch4) ? value.ch4 : {};
  const ch5 = isRecord(value.ch5) ? value.ch5 : {};
  const ch6 = isRecord(value.ch6) ? value.ch6 : {};
  return {
    ch1: {
      firstMined: mineralListOr(ch1.firstMined, fallback.ch1.firstMined),
      deposits: depositsOr(ch1.deposits, fallback.ch1.deposits),
      miners: minersOr(ch1.miners, fallback.ch1.miners),
      elapsedSeconds: numberOr(ch1.elapsedSeconds, fallback.ch1.elapsedSeconds),
      triggeredEvents: stringListOr(ch1.triggeredEvents, fallback.ch1.triggeredEvents),
      completed: typeof ch1.completed === 'boolean' ? ch1.completed : fallback.ch1.completed,
      completedAtSeconds: nullableNumberOr(ch1.completedAtSeconds, fallback.ch1.completedAtSeconds),
      quizCorrect: nullableBooleanOr(ch1.quizCorrect, fallback.ch1.quizCorrect)
    },
    ch2: {
      completed: typeof ch2.completed === 'boolean' ? ch2.completed : fallback.ch2.completed,
      completedAtSeconds: nullableNumberOr(ch2.completedAtSeconds, fallback.ch2.completedAtSeconds),
      quizCorrect: nullableBooleanOr(ch2.quizCorrect, fallback.ch2.quizCorrect),
      siliconPurityNines: numberOr(ch2.siliconPurityNines, fallback.ch2.siliconPurityNines),
      refinedOutputs: refinedOutputsOr(ch2.refinedOutputs, fallback.ch2.refinedOutputs),
      slag: numberOr(ch2.slag, fallback.ch2.slag),
      storedSlag: numberOr(ch2.storedSlag, fallback.ch2.storedSlag),
      firstFacts: stringListOr(ch2.firstFacts, fallback.ch2.firstFacts)
    },
    ch3: {
      completed: typeof ch3.completed === 'boolean' ? ch3.completed : fallback.ch3.completed,
      completedAtSeconds: nullableNumberOr(ch3.completedAtSeconds, fallback.ch3.completedAtSeconds),
      quizCorrect: nullableBooleanOr(ch3.quizCorrect, fallback.ch3.quizCorrect),
      ingotQuality: numberOr(ch3.ingotQuality, fallback.ch3.ingotQuality),
      waferQuality: numberOr(ch3.waferQuality, fallback.ch3.waferQuality),
      wafersProduced: numberOr(ch3.wafersProduced, fallback.ch3.wafersProduced),
      retryUsed: typeof ch3.retryUsed === 'boolean' ? ch3.retryUsed : fallback.ch3.retryUsed,
      firstFacts: stringListOr(ch3.firstFacts, fallback.ch3.firstFacts)
    },
    ch4: {
      completed: typeof ch4.completed === 'boolean' ? ch4.completed : fallback.ch4.completed,
      completedAtSeconds: nullableNumberOr(ch4.completedAtSeconds, fallback.ch4.completedAtSeconds),
      quizCorrect: nullableBooleanOr(ch4.quizCorrect, fallback.ch4.quizCorrect),
      wafersProcessed: numberOr(ch4.wafersProcessed, fallback.ch4.wafersProcessed),
      averageYield: numberOr(ch4.averageYield, fallback.ch4.averageYield),
      bestYield: numberOr(ch4.bestYield, fallback.ch4.bestYield),
      chipsProduced: numberOr(ch4.chipsProduced, fallback.ch4.chipsProduced),
      nodeYields: nodeYieldsOr(ch4.nodeYields, fallback.ch4.nodeYields),
      firstFacts: stringListOr(ch4.firstFacts, fallback.ch4.firstFacts)
    },
    ch5: {
      completed: typeof ch5.completed === 'boolean' ? ch5.completed : fallback.ch5.completed,
      completedAtSeconds: nullableNumberOr(ch5.completedAtSeconds, fallback.ch5.completedAtSeconds),
      quizCorrect: nullableBooleanOr(ch5.quizCorrect, fallback.ch5.quizCorrect),
      sortedDies: numberOr(ch5.sortedDies, fallback.ch5.sortedDies),
      bins: binsOr(ch5.bins, fallback.ch5.bins),
      selectedChipIds: chipTypeListOr(ch5.selectedChipIds, fallback.ch5.selectedChipIds),
      builtChips: builtChipsOr(ch5.builtChips, fallback.ch5.builtChips),
      perfect7nmDies: numberOr(ch5.perfect7nmDies, fallback.ch5.perfect7nmDies),
      triggeredEvents: stringListOr(ch5.triggeredEvents, fallback.ch5.triggeredEvents),
      firstFacts: stringListOr(ch5.firstFacts, fallback.ch5.firstFacts)
    },
    ch6: {
      completed: typeof ch6.completed === 'boolean' ? ch6.completed : fallback.ch6.completed,
      completedAtSeconds: nullableNumberOr(ch6.completedAtSeconds, fallback.ch6.completedAtSeconds),
      quizCorrect: nullableBooleanOr(ch6.quizCorrect, fallback.ch6.quizCorrect),
      stage: isDatacenterStage(ch6.stage) ? ch6.stage : fallback.ch6.stage,
      buildings: datacenterBuildingsOr(ch6.buildings, fallback.ch6.buildings),
      servedContracts: datacenterContractListOr(ch6.servedContracts, fallback.ch6.servedContracts),
      availableChipIds: chipTypeListOr(ch6.availableChipIds, fallback.ch6.availableChipIds),
      installedChipIds: chipTypeListOr(ch6.installedChipIds, fallback.ch6.installedChipIds),
      novaBuilt: typeof ch6.novaBuilt === 'boolean' ? ch6.novaBuilt : fallback.ch6.novaBuilt,
      heat: numberOr(ch6.heat, fallback.ch6.heat),
      powerCapacity: numberOr(ch6.powerCapacity, fallback.ch6.powerCapacity),
      powerLoad: numberOr(ch6.powerLoad, fallback.ch6.powerLoad),
      cooling: numberOr(ch6.cooling, fallback.ch6.cooling),
      networkLinks: numberOr(ch6.networkLinks, fallback.ch6.networkLinks),
      batteryCharge: numberOr(ch6.batteryCharge, fallback.ch6.batteryCharge),
      cityLights: numberOr(ch6.cityLights, fallback.ch6.cityLights),
      eventDeltas: datacenterEventDeltasOr(ch6.eventDeltas, fallback.ch6.eventDeltas),
      triggeredEvents: stringListOr(ch6.triggeredEvents, fallback.ch6.triggeredEvents),
      firstFacts: stringListOr(ch6.firstFacts, fallback.ch6.firstFacts)
    }
  };
}

function initialChapterOneDeposits(): MineDepositProgress[] {
  return BALANCE.ch1.deposits.map((deposit) => ({ ...deposit }));
}

function depositsOr(value: unknown, fallback: MineDepositProgress[]): MineDepositProgress[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const deposits = value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      id: stringOr(item.id, ''),
      mineral: isMineralType(item.mineral) ? item.mineral : 'quartz',
      x: numberOr(item.x, 0),
      y: numberOr(item.y, 0),
      depth: numberOr(item.depth, 1),
      richness: numberOr(item.richness, 1),
      remaining: numberOr(item.remaining, 0)
    }))
    .filter((deposit) => deposit.id.length > 0);

  return deposits.length > 0 ? deposits : fallback;
}

function minersOr(value: unknown, fallback: PlacedMinerProgress[]): PlacedMinerProgress[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      id: stringOr(item.id, ''),
      depositId: stringOr(item.depositId, ''),
      mineral: isMineralType(item.mineral) ? item.mineral : 'quartz',
      depth: numberOr(item.depth, 1)
    }))
    .filter((miner) => miner.id.length > 0 && miner.depositId.length > 0);
}

function nodeYieldsOr(
  value: unknown,
  fallback: GameState['chapters']['ch4']['nodeYields']
): GameState['chapters']['ch4']['nodeYields'] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      node: isFabNodeId(item.node) ? item.node : '90nm',
      yieldPercent: numberOr(item.yieldPercent, 0),
      goodDies: numberOr(item.goodDies, 0),
      defectiveDies: numberOr(item.defectiveDies, 0)
    }));
}

function isFabNodeId(value: unknown): value is '90nm' | '28nm' | '7nm' {
  return value === '90nm' || value === '28nm' || value === '7nm';
}

function refinedOutputsOr(
  value: unknown,
  fallback: Partial<Record<'copper' | 'lithium' | 'cobalt', number>>
): Partial<Record<'copper' | 'lithium' | 'cobalt', number>> {
  if (!isRecord(value)) {
    return fallback;
  }

  const outputs: Partial<Record<'copper' | 'lithium' | 'cobalt', number>> = {};
  for (const lane of ['copper', 'lithium', 'cobalt'] as const) {
    const amount = numberOr(value[lane], fallback[lane] ?? 0);
    if (amount > 0) {
      outputs[lane] = amount;
    }
  }
  return outputs;
}

function stringListOr(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function metaOr(value: unknown, fallback: MetaProgressState): MetaProgressState {
  if (!isRecord(value)) {
    return fallback;
  }

  const crisisRuns = crisisRunListOr(value.crisisRuns, fallback.crisisRuns);
  const savedBest = crisisRunOr(value.bestCrisisRun, fallback.bestCrisisRun);
  const bestFromHistory = crisisRuns.reduce<CrisisRunResult | null>(
    (best, run) => bestCrisisRun(best, run),
    null
  );
  const totalCrisisRuns = Math.max(
    numberOr(value.totalCrisisRuns, crisisRuns.length),
    crisisRuns.length
  );

  return {
    crisisRuns,
    bestCrisisRun: bestFromHistory && savedBest ? bestCrisisRun(savedBest, bestFromHistory) : (savedBest ?? bestFromHistory),
    totalCrisisRuns
  };
}

function crisisRunListOr(value: unknown, fallback: CrisisRunResult[]): CrisisRunResult[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((item) => crisisRunOr(item, null))
    .filter((item): item is CrisisRunResult => item !== null)
    .slice(0, 12);
}

function crisisRunOr(value: unknown, fallback: CrisisRunResult | null): CrisisRunResult | null {
  if (!isRecord(value) || value.mode !== 'crisis' || !isCrisisRunGrade(value.grade)) {
    return fallback;
  }

  return {
    runId: stringOr(value.runId, 'unknown-run'),
    mode: 'crisis',
    completedAt: stringOr(value.completedAt, new Date(0).toISOString()),
    elapsedSeconds: numberOr(value.elapsedSeconds, 0),
    cityLights: numberOr(value.cityLights, 0),
    servedContracts: numberOr(value.servedContracts, 0),
    powerEfficiency: numberOr(value.powerEfficiency, 0),
    heatPeak: numberOr(value.heatPeak, 0),
    mistakes: numberOr(value.mistakes, 0),
    score: numberOr(value.score, 0),
    grade: value.grade,
    shareLine: stringOr(value.shareLine, 'Rock to Rack Crisis Run')
  };
}

function isCrisisRunGrade(value: unknown): value is CrisisRunResult['grade'] {
  return value === 'S' || value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

function mineralListOr(value: unknown, fallback: MineralType[]): MineralType[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return [...new Set(value.filter((mineral): mineral is MineralType => isMineralType(mineral)))];
}

function isMineralType(value: unknown): value is MineralType {
  return MINERALS.includes(value as MineralType);
}

function nullableNumberOr(value: unknown, fallback: number | null): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nullableBooleanOr(value: unknown, fallback: boolean | null): boolean | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'boolean' ? value : fallback;
}

function binsOr(value: unknown, fallback: GameState['chapters']['ch5']['bins']): GameState['chapters']['ch5']['bins'] {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    perfect: numberOr(value.perfect, fallback.perfect),
    good: numberOr(value.good, fallback.good),
    salvage: numberOr(value.salvage, fallback.salvage)
  };
}

function chipTypeListOr(value: unknown, fallback: GameState['chapters']['ch5']['selectedChipIds']): GameState['chapters']['ch5']['selectedChipIds'] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const chips = value.filter((chip): chip is GameState['chapters']['ch5']['selectedChipIds'][number] => isChipTypeId(chip));
  return chips.length > 0 ? [...new Set(chips)] : fallback;
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
    .filter((item) => typeof item.id === 'string' && item.id.length > 0 && isDatacenterBuildingType(item.type))
    .map((item) => ({
      id: item.id as string,
      type: item.type as DatacenterBuildingType,
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

  const contracts = value.filter((contract): contract is DatacenterContractId => isDatacenterContractId(contract));
  return contracts.length > 0 ? [...new Set(contracts)] : fallback;
}

function datacenterEventDeltasOr(
  value: unknown,
  fallback: GameState['chapters']['ch6']['eventDeltas']
): GameState['chapters']['ch6']['eventDeltas'] {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    powerCapacity: numberOr(value.powerCapacity, fallback.powerCapacity),
    cooling: numberOr(value.cooling, fallback.cooling),
    batteryCharge: numberOr(value.batteryCharge, fallback.batteryCharge)
  };
}

function builtChipsOr(
  value: unknown,
  fallback: GameState['chapters']['ch5']['builtChips']
): GameState['chapters']['ch5']['builtChips'] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .filter((item) => isChipTypeId(item.chipId))
    .map((item) => ({
      chipId: item.chipId as GameState['chapters']['ch5']['selectedChipIds'][number],
      builtAtSeconds: numberOr(item.builtAtSeconds, 0)
    }));
}

function isChipTypeId(value: unknown): value is GameState['chapters']['ch5']['selectedChipIds'][number] {
  return value === 'cpu' || value === 'gpu' || value === 'dram' || value === 'nand' || value === 'nic' || value === 'pmic' || value === 'nova';
}

function isDatacenterStage(value: unknown): value is DatacenterStage {
  return value === 'build' || value === 'contracts' || value === 'crisis' || value === 'nova' || value === 'victory';
}

function isDatacenterBuildingType(value: unknown): value is DatacenterBuildingType {
  return value === 'rack' || value === 'power' || value === 'cooling' || value === 'network' || value === 'battery';
}

function isDatacenterContractId(value: unknown): value is DatacenterContractId {
  return value === 'cartoonStream' || value === 'weatherAi' || value === 'cityBackup' || value === 'hospitalNova';
}
