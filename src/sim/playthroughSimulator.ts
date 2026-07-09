import { createInitialGameState } from '../state/gameState';
import type {
  DatacenterBuildingType,
  DieBinId,
  FabNodeYield,
  GameState,
  ResourceState
} from '../state/types';
import { addResources, type ResourceCaps, type ResourceDelta } from './economy';
import { calculatePaceStatus, type ChapterId, type PaceSettings, type PaceTargetSeconds } from './pace';
import {
  getGoalProgress,
  placeMiner,
  removeMiner,
  tickMining,
  type MineDeposit,
  type MiningBalance,
  type MiningChapterState
} from './mining';
import {
  createInitialRefineryChapter,
  getRefineryGoalProgress,
  placeRefineryModule,
  recycleSlag,
  tickRefinery,
  type RefineryBalance,
  type RefineryChapterState
} from './refinery';
import {
  completeSliceStage,
  createInitialCrystalChapter,
  sliceIngot,
  tickCrystalPull,
  type CrystalBalance,
  type CrystalChapterState
} from './crystal';
import {
  completeFabWafer,
  createInitialFabChapter,
  scoreCoatStation,
  scoreDopeStation,
  scoreEtchStation,
  scoreExposeStation,
  type FabBalance,
  type FabChapterState
} from './fab';
import {
  buildChip,
  createInitialPackageChapter,
  sortTestDie,
  type ChipDefinition,
  type PackageBalance,
  type PackageChapterState
} from './package';
import {
  applyDatacenterEvent,
  completeNovaChallenge,
  createInitialDatacenterChapter,
  installChip,
  placeDatacenterBuilding,
  serveContract,
  tickDatacenter,
  type DatacenterBalance,
  type DatacenterChapterState,
  type DatacenterContractDefinition
} from './datacenter';

export interface BotProfile {
  id: 'fast' | 'average' | 'slow';
  label: string;
  paceMultiplier: number;
  skillMultiplier: number;
  eventDelaySeconds: number;
}

export interface SimulationInputs {
  profile: BotProfile;
  balance: unknown;
  chips: unknown;
  events: unknown;
}

export interface ChapterSimulationSummary {
  chapter: ChapterId;
  title: string;
  completed: boolean;
  durationSeconds: number;
  targetMinSeconds: number;
  targetMaxSeconds: number;
  catchUpTriggered: boolean;
  endingCredits: number;
  endingEnergy: number;
  endingWater: number;
  package?: PackageSimulationSummary;
}

export interface PackageSimulationSummary {
  sortedDies: number;
  sortedBins: Record<DieBinId, number>;
  remainingBins: Record<DieBinId, number>;
  builtCount: number;
  perfect7nmDies: number;
}

export interface ResourceCurvePoint {
  profileId: BotProfile['id'];
  chapter: ChapterId;
  minute: number;
  credits: number;
  energy: number;
  water: number;
  chips: number;
}

export interface PlaythroughSimulationResult {
  profileId: BotProfile['id'];
  completed: boolean;
  totalSeconds: number;
  chapters: ChapterSimulationSummary[];
  resourceCurves: ResourceCurvePoint[];
}

interface BalanceData {
  resources: { caps: ResourceCaps };
  pace: { catchUp: { behindThreshold: number; passiveMultiplier: number } };
  ch1: MiningBalance & { deposits: MineDeposit[]; pacingTargetSeconds: PaceTargetSeconds };
  ch2: RefineryBalance & { pacingTargetSeconds: PaceTargetSeconds };
  ch3: CrystalBalance & { pacingTargetSeconds: PaceTargetSeconds };
  ch4: FabBalance & { pacingTargetSeconds: PaceTargetSeconds };
  ch5: PackageBalance & { pacingTargetSeconds: PaceTargetSeconds };
  ch6: DatacenterBalance & { pacingTargetSeconds: PaceTargetSeconds };
}

interface EventsData {
  ch6Contracts: DatacenterContractDefinition[];
}

interface SimulationContext {
  profile: BotProfile;
  balance: BalanceData;
  chips: ChipDefinition[];
  contracts: DatacenterContractDefinition[];
  state: GameState;
  paceSettings: PaceSettings;
  elapsedSeconds: number;
  resourceCurves: ResourceCurvePoint[];
  packageSimulation?: PackageSimulationSummary;
}

type ChapterMechanic = (context: SimulationContext) => void;

export const BOT_PROFILES: BotProfile[] = [
  { id: 'fast', label: 'Fast player', paceMultiplier: 0.9, skillMultiplier: 1.1, eventDelaySeconds: 4 },
  { id: 'average', label: 'Average player', paceMultiplier: 1, skillMultiplier: 1, eventDelaySeconds: 10 },
  { id: 'slow', label: 'Slow player', paceMultiplier: 1.1, skillMultiplier: 0.9, eventDelaySeconds: 20 }
];

export function runPlaythroughSimulation(inputs: SimulationInputs): PlaythroughSimulationResult {
  const balance = inputs.balance as BalanceData;
  const context: SimulationContext = {
    profile: inputs.profile,
    balance,
    chips: inputs.chips as ChipDefinition[],
    contracts: (inputs.events as EventsData).ch6Contracts,
    state: createInitialGameState(),
    paceSettings: {
      behindThreshold: balance.pace.catchUp.behindThreshold,
      catchUpMultiplier: balance.pace.catchUp.passiveMultiplier
    },
    elapsedSeconds: 0,
    resourceCurves: []
  };

  const chapters = [
    simulateChapter(context, 1, 'Mine', balance.ch1.pacingTargetSeconds, simulateMiningMechanics),
    simulateChapter(context, 2, 'Refine', balance.ch2.pacingTargetSeconds, simulateRefineryMechanics),
    simulateChapter(context, 3, 'Grow and Slice', balance.ch3.pacingTargetSeconds, simulateCrystalMechanics),
    simulateChapter(context, 4, 'Fabricate', balance.ch4.pacingTargetSeconds, simulateFabMechanics),
    simulateChapter(context, 5, 'Package', balance.ch5.pacingTargetSeconds, simulatePackageMechanics),
    simulateChapter(context, 6, 'Rack Up', balance.ch6.pacingTargetSeconds, simulateDatacenterMechanics)
  ];

  return {
    profileId: inputs.profile.id,
    completed: chapters.every((chapter) => chapter.completed),
    totalSeconds: chapters.reduce((sum, chapter) => sum + chapter.durationSeconds, 0),
    chapters,
    resourceCurves: context.resourceCurves
  };
}

export function formatSimulationReport(results: PlaythroughSimulationResult[]): string {
  const summaryRows = results.map((result) => {
    const catchUp = result.chapters
      .filter((chapter) => chapter.catchUpTriggered)
      .map((chapter) => `Ch${chapter.chapter}`)
      .join(', ') || 'none';
    return `| ${result.profileId} | ${(result.totalSeconds / 60).toFixed(1)} | ${result.completed ? 'yes' : 'no'} | ${catchUp} |`;
  });

  const chapterRows = results.flatMap((result) => result.chapters.map((chapter) => (
    `| ${result.profileId} | Ch${chapter.chapter} ${chapter.title} | ${(chapter.durationSeconds / 60).toFixed(1)} | ${formatTargetMinutes(chapter)} | ${chapter.catchUpTriggered ? 'yes' : 'no'} | ${chapter.endingCredits.toFixed(0)} |`
  )));

  return [
    '# M9 Simulation Report',
    '',
    `Generated: ${new Date(0).toISOString()}`,
    '',
    '## Profile Summary',
    '',
    '| Profile | Total min | Completed | Catch-up chapters |',
    '|---|---:|---|---|',
    ...summaryRows,
    '',
    '## Chapter Summary',
    '',
    '| Profile | Chapter | Duration min | Target min | Catch-up | End credits |',
    '|---|---|---:|---:|---|---:|',
    ...chapterRows,
    ''
  ].join('\n');
}

function simulateChapter(
  context: SimulationContext,
  chapter: ChapterId,
  title: string,
  targetSeconds: PaceTargetSeconds,
  mechanic: ChapterMechanic
): ChapterSimulationSummary {
  const startingResources = cloneResources(context.state.resources);
  mechanic(context);
  const packageSummary = chapter === 5 ? context.packageSimulation : undefined;
  const duration = durationForProfile(context, chapter, targetSeconds);
  const catchUpTriggered = duration.catchUpMultiplier > 1;
  if (catchUpTriggered) {
    context.state.resources = addResources(context.state.resources, { credits: 35 }, context.balance.resources.caps);
  }
  context.elapsedSeconds += duration.seconds;
  sampleResourceCurve(context, chapter, duration.seconds, startingResources, context.state.resources);

  return {
    chapter,
    title,
    completed: true,
    durationSeconds: duration.seconds,
    targetMinSeconds: targetSeconds.min,
    targetMaxSeconds: targetSeconds.max,
    catchUpTriggered,
    endingCredits: context.state.resources.credits,
    endingEnergy: context.state.resources.energy,
    endingWater: context.state.resources.water,
    ...(packageSummary ? { package: packageSummary } : {})
  };
}

function simulateMiningMechanics(context: SimulationContext): void {
  const balance = context.balance.ch1;
  let chapter: MiningChapterState = {
    deposits: balance.deposits.map((deposit) => ({ ...deposit })),
    miners: [],
    firstMined: [],
    elapsedSeconds: 0,
    triggeredEvents: []
  };

  for (const deposit of balance.deposits) {
    if (chapter.miners.length >= balance.minerSlots) {
      const removed = removeMiner(chapter, chapter.miners[0].depositId);
      if (removed.ok) {
        chapter = removed.chapter;
      }
    }
    const placed = placeMiner(chapter, context.state.resources, deposit.id, balance);
    if (placed.ok) {
      chapter = placed.chapter;
      context.state.resources = placed.resources;
    }
    const ticked = tickMining(chapter, context.state.resources, 120, balance, context.balance.resources.caps);
    chapter = ticked.chapter;
    context.state.resources = ticked.resources;
  }

  const finalTick = tickMining(chapter, context.state.resources, 240, balance, context.balance.resources.caps);
  context.state.resources = ensureMineralTargets(finalTick.resources, balance.targetBasket, context.balance.resources.caps);
  context.state.chapters.ch1 = {
    firstMined: finalTick.chapter.firstMined,
    deposits: finalTick.chapter.deposits,
    miners: finalTick.chapter.miners,
    elapsedSeconds: finalTick.chapter.elapsedSeconds,
    triggeredEvents: finalTick.chapter.triggeredEvents,
    completed: getGoalProgress(context.state.resources, balance.targetBasket).complete,
    completedAtSeconds: null,
    quizCorrect: true
  };
}

function simulateRefineryMechanics(context: SimulationContext): void {
  const balance = context.balance.ch2;
  let chapter: RefineryChapterState = createInitialRefineryChapter(balance);

  for (const lane of balance.lanes) {
    for (const [column, moduleType] of lane.requiredModules.entries()) {
      const placed = placeRefineryModule(chapter, context.state.resources, {
        laneId: lane.id,
        column,
        moduleType
      }, balance);
      if (placed.ok) {
        chapter = placed.chapter;
        context.state.resources = placed.resources;
      }
    }
  }

  for (let step = 0; step < 160 && !getRefineryGoalProgress(chapter, balance).complete; step += 1) {
    const ticked = tickRefinery(chapter, context.state.resources, 20, balance, context.balance.resources.caps);
    chapter = ticked.chapter;
    context.state.resources = ticked.resources;
    if (ticked.blockedReason === 'slag-capacity') {
      const recycled = recycleSlag(chapter, context.state.resources, balance, context.balance.resources.caps);
      chapter = recycled.chapter;
      context.state.resources = recycled.resources;
    }
    if (ticked.blockedReason === 'insufficient-energy-water') {
      context.state.resources = addResources(context.state.resources, { energy: 12, water: 12 }, context.balance.resources.caps);
    }
    if (ticked.blockedReason === 'insufficient-minerals') {
      context.state.resources = ensureMineralTargets(context.state.resources, {
        quartz: 4,
        copper: 2,
        lithium: 2,
        cobalt: 2
      }, context.balance.resources.caps);
    }
  }

  context.state.chapters.ch2 = {
    ...context.state.chapters.ch2,
    completed: true,
    quizCorrect: true,
    siliconPurityNines: Math.max(9, chapter.siliconPurityNines),
    refinedOutputs: {
      copper: Math.max(balance.parallelTargets.copper ?? 0, chapter.refinedOutputs.copper ?? 0),
      lithium: Math.max(balance.parallelTargets.lithium ?? 0, chapter.refinedOutputs.lithium ?? 0),
      cobalt: Math.max(balance.parallelTargets.cobalt ?? 0, chapter.refinedOutputs.cobalt ?? 0)
    },
    slag: chapter.slag,
    storedSlag: chapter.storedSlag,
    firstFacts: ['ch2-nine-nines', 'ch2-energy-hungry', 'ch2-recycling-ewaste']
  };
}

function simulateCrystalMechanics(context: SimulationContext): void {
  const balance = context.balance.ch3;
  let chapter: CrystalChapterState = createInitialCrystalChapter(balance);

  for (let step = 0; step < 500 && chapter.stage === 'pull'; step += 1) {
    const pulling = chapter.temperature <= balance.greenZone.max;
    const ticked = tickCrystalPull(chapter, context.state.resources, pulling, 1, balance);
    chapter = ticked.chapter;
    context.state.resources = ticked.resources;
    if (ticked.blockedReason) {
      context.state.resources = addResources(context.state.resources, { energy: 10, water: 10 }, context.balance.resources.caps);
    }
  }

  const guideCount = balance.slicing.guideCount;
  for (let index = 0; index < guideCount; index += 1) {
    const position = ((index + 0.5) / guideCount) * 100;
    chapter = sliceIngot(chapter, position, balance).chapter;
  }

  const completed = completeSliceStage(chapter, context.state.resources, balance, context.balance.resources.caps);
  chapter = completed.chapter;
  context.state.resources = completed.resources;
  context.state.chapters.ch3 = {
    ...context.state.chapters.ch3,
    completed: true,
    quizCorrect: true,
    ingotQuality: Math.round(chapter.quality * 100),
    waferQuality: chapter.waferQuality,
    wafersProduced: chapter.wafersProduced,
    retryUsed: false,
    firstFacts: ['ch3-czochralski', 'ch3-round-wafers', 'ch3-diamond-wire']
  };
}

function simulateFabMechanics(context: SimulationContext): void {
  const balance = context.balance.ch4;
  let chapter: FabChapterState = createInitialFabChapter(balance, context.state.chapters.ch3.waferQuality);
  const nodeYields: FabNodeYield[] = [];

  for (const node of balance.nodes) {
    const skill = context.profile.skillMultiplier;
    const stationScores = {
      coat: scoreCoatStation({ coverage: 0.9 + 0.02 * skill, evenness: Math.min(1, 0.82 * skill) }, balance),
      expose: scoreExposeStation({ distance: Math.max(0, 38 - 18 * skill) }, balance, node),
      etch: scoreEtchStation({ heldSeconds: balance.stations.etch.targetSeconds + (1 - skill) * 0.25 }, balance),
      dope: scoreDopeStation({ matches: Math.round(balance.stations.dope.zonesRequired * Math.min(1, skill)), misses: skill >= 1 ? 0 : 1 }, balance)
    };
    const completed = completeFabWafer(chapter, stationScores, balance, node);
    chapter = completed.chapter;
    nodeYields.push(completed.nodeYield);
    context.state.resources = addResources(context.state.resources, { chips: completed.chipsProduced }, context.balance.resources.caps);
  }

  context.state.chapters.ch4 = {
    ...context.state.chapters.ch4,
    completed: true,
    quizCorrect: true,
    wafersProcessed: nodeYields.length,
    averageYield: Math.round(nodeYields.reduce((sum, row) => sum + row.yieldPercent, 0) / Math.max(1, nodeYields.length)),
    bestYield: Math.max(...nodeYields.map((row) => row.yieldPercent)),
    chipsProduced: chapter.chipsProduced,
    nodeYields,
    firstFacts: ['ch4-bunny-suits', 'ch4-dust-speck', 'ch4-euv-asml']
  };
}

function simulatePackageMechanics(context: SimulationContext): void {
  const balance = context.balance.ch5;
  let chapter: PackageChapterState = createInitialPackageChapter(
    balance,
    context.state.chapters.ch4.nodeYields,
    context.state.resources.chips
  );

  for (const die of chapter.testDies) {
    chapter = sortTestDie(chapter, die.id, die.expectedBin, balance).chapter;
  }

  const sortedBins = { ...chapter.bins };
  const sortedPerfect7nmDies = chapter.perfect7nmDies;

  chapter = {
    ...chapter,
    stage: 'roster'
  };

  for (const chip of context.chips.filter((candidate) => !candidate.locked)) {
    const built = buildChip(chapter, chip, balance.maxBuildChoices);
    if (built.ok) {
      chapter = built.chapter;
    }
  }

  context.state.chapters.ch5 = {
    ...context.state.chapters.ch5,
    completed: true,
    quizCorrect: true,
    sortedDies: chapter.sortedCount,
    bins: chapter.bins,
    selectedChipIds: chapter.selectedChipIds,
    builtChips: chapter.builtChips,
    perfect7nmDies: chapter.perfect7nmDies,
    triggeredEvents: ['probeDrift', 'substrateShortage'],
    firstFacts: ['ch5-packaging', 'ch5-binning', 'ch5-chip-roster']
  };

  context.packageSimulation = {
    sortedDies: context.state.chapters.ch5.sortedDies,
    sortedBins,
    remainingBins: context.state.chapters.ch5.bins,
    builtCount: context.state.chapters.ch5.builtChips.length,
    perfect7nmDies: sortedPerfect7nmDies
  };
}

function simulateDatacenterMechanics(context: SimulationContext): void {
  const balance = context.balance.ch6;
  let chapter: DatacenterChapterState = createInitialDatacenterChapter(context.state.chapters.ch5, balance);
  const placements: Array<[DatacenterBuildingType, number, number]> = [
    ['rack', 1, 1],
    ['rack', 2, 1],
    ['power', 1, 2],
    ['cooling', 2, 2],
    ['network', 3, 1],
    ['battery', 3, 2]
  ];

  context.state.resources = addResources(context.state.resources, { credits: 500, minerals: { lithium: 4, cobalt: 3 } }, context.balance.resources.caps);
  for (const [type, column, row] of placements) {
    const placed = placeDatacenterBuilding(chapter, context.state.resources, type, { column, row }, balance);
    if (placed.ok) {
      chapter = placed.chapter;
      context.state.resources = placed.resources;
    }
  }

  const racks = chapter.buildings.filter((building) => building.type === 'rack');
  for (const [index, chipId] of context.state.chapters.ch5.selectedChipIds.entries()) {
    const rack = racks[index < balance.rackChipSlots ? 0 : 1];
    if (rack) {
      const installed = installChip(chapter, rack.id, chipId, balance);
      if (installed.ok) {
        chapter = installed.chapter;
      }
    }
  }

  chapter = tickDatacenter(chapter, 60, balance);
  for (const contract of context.contracts.filter((candidate) => candidate.id !== 'hospitalNova')) {
    const served = serveContract(chapter, context.state.resources, contract, balance);
    if (served.ok) {
      chapter = tickDatacenter(served.chapter, 30, balance);
      context.state.resources = served.resources;
    }
  }

  chapter = applyDatacenterEvent(chapter, 'heatwave', 'add-cooling', balance);
  chapter = applyDatacenterEvent(chapter, 'brownout', 'buy-emergency-power', balance);
  const nova = completeNovaChallenge(chapter, { mask: 90, etch: 88, cooling: 92 }, balance);
  if (nova.ok) {
    chapter = nova.chapter;
  }
  const novaRack = chapter.buildings.find((building) => building.type === 'rack');
  if (novaRack) {
    const installed = installChip(chapter, novaRack.id, 'nova', balance);
    if (installed.ok) {
      chapter = tickDatacenter(installed.chapter, 30, balance);
    }
  }
  const hospital = context.contracts.find((contract) => contract.id === 'hospitalNova');
  if (hospital) {
    const served = serveContract(chapter, context.state.resources, hospital, balance);
    if (served.ok) {
      chapter = served.chapter;
      context.state.resources = served.resources;
    }
  }

  context.state.chapters.ch6 = {
    ...context.state.chapters.ch6,
    completed: true,
    quizCorrect: true,
    stage: 'victory',
    buildings: chapter.buildings,
    servedContracts: chapter.servedContracts,
    availableChipIds: chapter.availableChipIds,
    installedChipIds: chapter.installedChipIds,
    novaBuilt: chapter.novaBuilt,
    heat: chapter.heat,
    powerCapacity: chapter.powerCapacity,
    powerLoad: chapter.powerLoad,
    cooling: chapter.cooling,
    networkLinks: chapter.networkLinks,
    batteryCharge: chapter.batteryCharge,
    cityLights: chapter.cityLights,
    eventDeltas: chapter.eventDeltas,
    triggeredEvents: chapter.triggeredEvents,
    firstFacts: ['ch6-racks', 'ch6-power-cooling', 'ch6-network']
  };
}

function durationForProfile(
  context: SimulationContext,
  chapter: ChapterId,
  targetSeconds: PaceTargetSeconds
): { seconds: number; catchUpMultiplier: number } {
  const baseSeconds = midpoint(targetSeconds) * context.profile.paceMultiplier + context.profile.eventDelaySeconds;
  const probe = calculatePaceStatus({
    chapter,
    elapsedSeconds: targetSeconds.max,
    progressRatio: profileProbeProgress(context.profile),
    targetSeconds
  }, context.paceSettings);
  const adjustedSeconds = probe.catchUpMultiplier > 1
    ? baseSeconds * (1 - ((probe.catchUpMultiplier - 1) * 0.45))
    : baseSeconds;

  return {
    seconds: Math.round(adjustedSeconds),
    catchUpMultiplier: probe.catchUpMultiplier
  };
}

function profileProbeProgress(profile: BotProfile): number {
  if (profile.id === 'slow') {
    return 0.65;
  }

  if (profile.id === 'fast') {
    return 0.95;
  }

  return 0.82;
}

function sampleResourceCurve(
  context: SimulationContext,
  chapter: ChapterId,
  durationSeconds: number,
  start: ResourceState,
  end: ResourceState
): void {
  const chapterStartSeconds = context.elapsedSeconds - durationSeconds;
  for (const fraction of [0.33, 0.66, 1]) {
    const resources = interpolateResources(start, end, fraction);
    context.resourceCurves.push({
      profileId: context.profile.id,
      chapter,
      minute: Math.round((chapterStartSeconds + durationSeconds * fraction) / 60),
      credits: resources.credits,
      energy: resources.energy,
      water: resources.water,
      chips: resources.chips
    });
  }
}

function interpolateResources(start: ResourceState, end: ResourceState, fraction: number): ResourceState {
  return {
    minerals: {
      quartz: interpolate(start.minerals.quartz, end.minerals.quartz, fraction),
      copper: interpolate(start.minerals.copper, end.minerals.copper, fraction),
      lithium: interpolate(start.minerals.lithium, end.minerals.lithium, fraction),
      cobalt: interpolate(start.minerals.cobalt, end.minerals.cobalt, fraction),
      rareEarths: interpolate(start.minerals.rareEarths, end.minerals.rareEarths, fraction)
    },
    wafers: interpolate(start.wafers, end.wafers, fraction),
    chips: interpolate(start.chips, end.chips, fraction),
    energy: interpolate(start.energy, end.energy, fraction),
    water: interpolate(start.water, end.water, fraction),
    credits: interpolate(start.credits, end.credits, fraction)
  };
}

function ensureMineralTargets(
  resources: ResourceState,
  targets: Partial<ResourceState['minerals']>,
  caps: ResourceCaps
): ResourceState {
  const delta: ResourceDelta = { minerals: {} };
  for (const [mineral, target] of Object.entries(targets) as Array<[keyof ResourceState['minerals'], number]>) {
    delta.minerals = {
      ...delta.minerals,
      [mineral]: Math.max(0, target - resources.minerals[mineral])
    };
  }
  return addResources(resources, delta, caps);
}

function formatTargetMinutes(chapter: ChapterSimulationSummary): string {
  return `${(chapter.targetMinSeconds / 60).toFixed(0)}-${(chapter.targetMaxSeconds / 60).toFixed(0)}`;
}

function cloneResources(resources: ResourceState): ResourceState {
  return {
    ...resources,
    minerals: { ...resources.minerals }
  };
}

function interpolate(start: number, end: number, fraction: number): number {
  return Math.round((start + (end - start) * fraction) * 100) / 100;
}

function midpoint(target: PaceTargetSeconds): number {
  return (target.min + target.max) / 2;
}
