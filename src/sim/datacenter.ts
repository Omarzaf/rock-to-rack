import type {
  ChapterFiveProgress,
  ChapterSixProgress,
  ChipTypeId,
  DatacenterBuildingProgress,
  DatacenterBuildingType,
  DatacenterContractId,
  DatacenterGridPosition,
  ResourceState
} from '../state/types';
import { addResources, spendResources } from './economy';
import type { ResourceCaps, ResourceDelta as ResourceCost } from './economy';
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

export interface DatacenterBuildResult { ok: boolean; chapter: DatacenterChapterState; resources: ResourceState; reason?: 'out of bounds' | 'occupied' | 'insufficient resources'; }
export interface DatacenterChipResult { ok: boolean; chapter: DatacenterChapterState; reason?: 'building not found' | 'not a rack' | 'chip unavailable' | 'already installed' | 'rack full'; }
export interface DatacenterContractCheck { ok: boolean; reasons: string[]; }
export interface DatacenterContractResult { ok: boolean; chapter: DatacenterChapterState; resources: ResourceState; reason?: 'already served' | 'requirements unmet' | 'nova locked'; }
export interface NovaChallengeScores { mask: number; etch: number; cooling: number; }
export interface NovaChallengeResult { ok: boolean; chapter: DatacenterChapterState; reason?: 'needs perfect die' | 'score too low' | 'already built' | 'nova locked'; }

export function createInitialDatacenterChapter(ch5: ChapterFiveProgress, balance: DatacenterBalance): DatacenterChapterState {
  return {
    completed: false,
    completedAtSeconds: null,
    quizCorrect: null,
    stage: 'build',
    buildings: [],
    servedContracts: [],
    availableChipIds: [...ch5.selectedChipIds],
    installedChipIds: [],
    novaBuilt: false,
    heat: 0,
    powerCapacity: balance.startingPowerCapacity,
    powerLoad: 0,
    cooling: balance.startingCooling,
    networkLinks: balance.startingNetworkLinks,
    batteryCharge: balance.startingBatteryCharge,
    cityLights: 0,
    eventDeltas: { powerCapacity: 0, cooling: 0, batteryCharge: 0 },
    triggeredEvents: [],
    firstFacts: [],
    elapsedSeconds: 0,
    perfect7nmDies: ch5.perfect7nmDies,
    effectiveCompute: 0,
    selectedBuildingId: null,
    selectedContractId: null
  };
}

export function placeDatacenterBuilding(
  chapter: DatacenterChapterState,
  resources: ResourceState,
  type: DatacenterBuildingType,
  position: DatacenterGridPosition,
  balance: DatacenterBalance
): DatacenterBuildResult {
  if (!isInBounds(position, balance)) {
    return { ok: false, chapter, resources, reason: 'out of bounds' };
  }

  if (chapter.buildings.some((building) => building.column === position.column && building.row === position.row)) {
    return { ok: false, chapter, resources, reason: 'occupied' };
  }

  const spent = spendResources(resources, balance.buildingCosts[type]);
  if (!spent.ok) {
    return { ok: false, chapter, resources, reason: 'insufficient resources' };
  }

  const building: DatacenterBuildingProgress = {
    id: nextBuildingId(chapter, type),
    type,
    column: position.column,
    row: position.row,
    installedChipIds: []
  };

  return {
    ok: true,
    chapter: {
      ...chapter,
      buildings: [...chapter.buildings, building],
      selectedBuildingId: building.id
    },
    resources: spent.resources
  };
}

export function installChip(
  chapter: DatacenterChapterState,
  buildingId: string,
  chipId: ChipTypeId,
  balance: DatacenterBalance
): DatacenterChipResult {
  const building = chapter.buildings.find((candidate) => candidate.id === buildingId);
  if (!building) {
    return { ok: false, chapter, reason: 'building not found' };
  }

  if (building.type !== 'rack') {
    return { ok: false, chapter, reason: 'not a rack' };
  }

  if (chapter.installedChipIds.includes(chipId) || building.installedChipIds.includes(chipId)) {
    return { ok: false, chapter, reason: 'already installed' };
  }

  if (!chapter.availableChipIds.includes(chipId)) {
    return { ok: false, chapter, reason: 'chip unavailable' };
  }

  if (building.installedChipIds.length >= balance.rackChipSlots) {
    return { ok: false, chapter, reason: 'rack full' };
  }

  return {
    ok: true,
    chapter: {
      ...chapter,
      buildings: chapter.buildings.map((candidate) => candidate.id === buildingId
        ? { ...candidate, installedChipIds: [...candidate.installedChipIds, chipId] }
        : candidate),
      availableChipIds: chapter.availableChipIds.filter((candidate) => candidate !== chipId),
      installedChipIds: [...chapter.installedChipIds, chipId],
      selectedBuildingId: buildingId
    }
  };
}

export function tickDatacenter(chapter: DatacenterChapterState, seconds: number, balance: DatacenterBalance): DatacenterChapterState {
  const eventDeltas = eventDeltasFor(chapter);
  const infrastructure = chapter.buildings.reduce((acc, building) => {
    if (building.type === 'power') {
      acc.powerCapacity += balance.buildingStats.power.powerCapacity;
    }
    if (building.type === 'cooling') {
      acc.cooling += balance.buildingStats.cooling.cooling;
    }
    if (building.type === 'network') {
      acc.networkLinks += balance.buildingStats.network.networkLinks;
    }
    if (building.type === 'battery') {
      acc.batteryCharge += balance.buildingStats.battery.batteryCharge;
    }
    return acc;
  }, {
    powerCapacity: balance.startingPowerCapacity + eventDeltas.powerCapacity,
    cooling: balance.startingCooling + eventDeltas.cooling,
    networkLinks: balance.startingNetworkLinks,
    batteryCharge: Math.max(0, balance.startingBatteryCharge + eventDeltas.batteryCharge)
  });

  const totals = chapter.buildings.reduce((acc, building) => {
    if (building.type === 'rack') {
      acc.compute += balance.buildingStats.rack.compute;
      acc.powerLoad += balance.buildingStats.rack.powerLoad;
      acc.heatRate += balance.buildingStats.rack.heatRate;
    }

    for (const chipId of building.installedChipIds) {
      const effect = balance.chipEffects[chipId];
      acc.compute += effect.computeBonus ?? 0;
      acc.computeMultiplier *= effect.computeMultiplier ?? 1;
      acc.powerLoad += effect.powerLoad ?? 0;
      acc.powerMultiplier *= effect.powerMultiplier ?? 1;
      acc.heatRate += effect.heatRate ?? 0;
      if (chipId === 'nic' && infrastructure.networkLinks > 0) {
        acc.networkMultiplier *= effect.networkMultiplier ?? 1;
      }
    }

    return acc;
  }, {
    compute: 0,
    computeMultiplier: 1,
    powerLoad: 0,
    powerMultiplier: 1,
    networkMultiplier: 1,
    heatRate: 0
  });

  const powerLoad = totals.powerLoad * totals.powerMultiplier;
  const effectiveCompute = (totals.compute * totals.computeMultiplier * totals.networkMultiplier)
    * (powerLoad > infrastructure.powerCapacity || chapter.heat >= balance.heatThrottle ? 0.65 : 1);
  const heatDelta = totals.heatRate * seconds * 0.12 - infrastructure.cooling * seconds * 0.06;

  return {
    ...chapter,
    elapsedSeconds: chapter.elapsedSeconds + seconds,
    powerCapacity: infrastructure.powerCapacity,
    powerLoad,
    cooling: infrastructure.cooling,
    networkLinks: infrastructure.networkLinks,
    batteryCharge: infrastructure.batteryCharge,
    eventDeltas,
    heat: clamp(chapter.heat + heatDelta, 0, balance.maxHeat),
    effectiveCompute
  };
}

export function canServeContract(
  chapter: DatacenterChapterState,
  contract: DatacenterContractDefinition,
  balance: DatacenterBalance
): DatacenterContractCheck {
  const reasons: string[] = [];

  for (const chipId of contract.requiredChipIds) {
    if (!chapter.installedChipIds.includes(chipId)) {
      reasons.push(`missing chip: ${chipId}`);
    }
  }
  if (chapter.effectiveCompute < contract.requiredCompute) {
    reasons.push('insufficient compute');
  }
  if (chapter.networkLinks < contract.requiredNetworkLinks) {
    reasons.push('insufficient network');
  }
  if (chapter.powerLoad > chapter.powerCapacity) {
    reasons.push('insufficient power');
  }
  if (chapter.heat >= balance.heatThrottle) {
    reasons.push('heat throttled');
  }
  if (contract.id === 'hospitalNova' && (chapter.stage !== 'nova' || !chapter.novaBuilt)) {
    reasons.push('nova locked');
  }

  return {
    ok: reasons.length === 0,
    reasons
  };
}

export function serveContract(
  chapter: DatacenterChapterState,
  resources: ResourceState,
  contract: DatacenterContractDefinition,
  balance: DatacenterBalance,
  options: { rewardMultiplier?: number; caps?: ResourceCaps } = {}
): DatacenterContractResult {
  if (chapter.servedContracts.includes(contract.id)) {
    return { ok: false, chapter, resources, reason: 'already served' };
  }

  if (contract.id === 'hospitalNova' && (chapter.stage !== 'nova' || !chapter.novaBuilt)) {
    return { ok: false, chapter, resources, reason: 'nova locked' };
  }

  if (!canServeContract(chapter, contract, balance).ok) {
    return { ok: false, chapter, resources, reason: 'requirements unmet' };
  }

  const rewardMultiplier = chapter.installedChipIds
    .filter((chipId) => chipId === 'dram')
    .reduce((multiplier) => multiplier * (balance.chipEffects.dram.rewardMultiplier ?? 1), 1);
  const rewardCredits = contract.rewardCredits * rewardMultiplier * Math.max(0, options.rewardMultiplier ?? 1);
  const servedContracts = [...chapter.servedContracts, contract.id];
  const nonHospitalServed = servedContracts.filter((contractId) => contractId !== 'hospitalNova').length;
  const stage = contract.id === 'hospitalNova'
    ? 'victory'
    : nonHospitalServed >= balance.contractsToUnlockNova
      ? 'nova'
      : 'contracts';

  return {
    ok: true,
    chapter: {
      ...chapter,
      stage,
      completed: contract.id === 'hospitalNova',
      servedContracts,
      cityLights: clamp(chapter.cityLights + contract.cityLights, 0, 100),
      selectedContractId: contract.id
    },
    resources: options.caps
      ? addResources(resources, { credits: rewardCredits }, options.caps)
      : {
        ...resources,
        credits: resources.credits + rewardCredits
      }
  };
}

export function applyDatacenterEvent(
  chapter: DatacenterChapterState,
  event: 'heatwave' | 'brownout',
  choiceId: string,
  balance: DatacenterBalance
): DatacenterChapterState {
  if (chapter.triggeredEvents.includes(event)) {
    return chapter;
  }

  const eventDeltas = eventDeltasFor(chapter);
  if (event === 'heatwave' && choiceId === 'add-cooling') {
    return {
      ...chapter,
      cooling: chapter.cooling + balance.buildingStats.cooling.cooling,
      eventDeltas: {
        ...eventDeltas,
        cooling: eventDeltas.cooling + balance.buildingStats.cooling.cooling
      },
      triggeredEvents: [...chapter.triggeredEvents, event]
    };
  }

  if (event === 'heatwave' && choiceId === 'throttle-racks') {
    return {
      ...chapter,
      heat: clamp(chapter.heat - 15, 0, balance.maxHeat),
      triggeredEvents: [...chapter.triggeredEvents, event]
    };
  }

  if (event === 'brownout' && choiceId === 'use-battery') {
    const drain = Math.min(20, chapter.batteryCharge);
    return {
      ...chapter,
      batteryCharge: Math.max(0, chapter.batteryCharge - drain),
      eventDeltas: {
        ...eventDeltas,
        batteryCharge: eventDeltas.batteryCharge - drain
      },
      triggeredEvents: [...chapter.triggeredEvents, event]
    };
  }

  if (event === 'brownout' && choiceId === 'buy-emergency-power') {
    return {
      ...chapter,
      powerCapacity: chapter.powerCapacity + 20,
      eventDeltas: {
        ...eventDeltas,
        powerCapacity: eventDeltas.powerCapacity + 20
      },
      triggeredEvents: [...chapter.triggeredEvents, event]
    };
  }

  return {
    ...chapter,
    triggeredEvents: [...chapter.triggeredEvents, event]
  };
}

export function completeNovaChallenge(
  chapter: DatacenterChapterState,
  scores: NovaChallengeScores,
  balance: DatacenterBalance
): NovaChallengeResult {
  if (chapter.novaBuilt) {
    return { ok: false, chapter, reason: 'already built' };
  }

  if (chapter.stage !== 'nova') {
    return { ok: false, chapter, reason: 'nova locked' };
  }

  if (chapter.perfect7nmDies < balance.novaChallenge.perfectDieCost) {
    return { ok: false, chapter, reason: 'needs perfect die' };
  }

  const averageScore = (scores.mask + scores.etch + scores.cooling) / 3;
  if (averageScore < balance.novaChallenge.requiredAverageScore) {
    return { ok: false, chapter, reason: 'score too low' };
  }

  return {
    ok: true,
    chapter: {
      ...chapter,
      novaBuilt: true,
      perfect7nmDies: chapter.perfect7nmDies - balance.novaChallenge.perfectDieCost,
      availableChipIds: chapter.availableChipIds.includes('nova') ? chapter.availableChipIds : [...chapter.availableChipIds, 'nova']
    }
  };
}

export function getDatacenterGoalProgress(
  chapter: DatacenterChapterState,
  contracts: DatacenterContractDefinition[]
): { complete: boolean; servedContracts: number; cityLights: number } {
  const knownContractIds = new Set(contracts.map((contract) => contract.id));
  const servedContracts = chapter.servedContracts.filter((contractId) => knownContractIds.has(contractId)).length;

  return {
    complete: chapter.stage === 'victory' && chapter.servedContracts.includes('hospitalNova'),
    servedContracts,
    cityLights: chapter.cityLights
  };
}

function nextBuildingId(chapter: DatacenterChapterState, type: DatacenterBuildingType): string {
  const sameTypeCount = chapter.buildings.filter((building) => building.type === type).length;
  return `${type}-${sameTypeCount + 1}`;
}

function isInBounds(position: DatacenterGridPosition, balance: DatacenterBalance): boolean {
  return Number.isInteger(position.column)
    && Number.isInteger(position.row)
    && position.column >= 1
    && position.column <= balance.grid.columns
    && position.row >= 1
    && position.row <= balance.grid.rows;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function eventDeltasFor(chapter: DatacenterChapterState): DatacenterChapterState['eventDeltas'] {
  return chapter.eventDeltas ?? { powerCapacity: 0, cooling: 0, batteryCharge: 0 };
}
