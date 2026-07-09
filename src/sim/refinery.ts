import type { MineralType, ResourceState } from '../state/types';
import { addResources, spendResources, type ResourceCaps, type ResourceDelta } from './economy';

export type RefineryModuleType = 'crusher' | 'furnace' | 'chemicalBath' | 'zoneRefiner';
export type RefineryLaneId = 'silicon' | 'copper' | 'lithium' | 'cobalt';

export interface RefineryGrid {
  columns: number;
  rows: number;
}

export interface RefineryLaneBalance {
  id: RefineryLaneId;
  mineral: MineralType;
  row: number;
  requiredModules: RefineryModuleType[];
  mineralInputPerSecond: number;
  energyPerSecond: number;
  waterPerSecond: number;
  slagPerSecond: number;
  progressPerSecond: number;
  target: number;
}

export interface RefineryBalance {
  grid: RefineryGrid;
  moduleCost: ResourceDelta;
  tickSeconds: number;
  slagCap: number;
  recycleSlag: {
    slag: number;
    credits: number;
  };
  storeSlag: {
    slag: number;
    credits: number;
  };
  eventTriggers: {
    energySpikeAtSeconds: number;
    inspectionAtSlag: number;
  };
  lanes: RefineryLaneBalance[];
  parallelTargets: Partial<Record<Exclude<RefineryLaneId, 'silicon'>, number>>;
}

export interface PlacedRefineryModule {
  id: string;
  laneId: RefineryLaneId;
  column: number;
  moduleType: RefineryModuleType;
}

export interface RefineryChapterState {
  modules: PlacedRefineryModule[];
  laneProgress: Record<RefineryLaneId, number>;
  siliconPurityNines: number;
  refinedOutputs: Partial<Record<Exclude<RefineryLaneId, 'silicon'>, number>>;
  slag: number;
  storedSlag: number;
  elapsedSeconds: number;
  triggeredEvents: string[];
  firstFacts: string[];
}

export type PlaceRefineryModuleResult =
  | { ok: true; chapter: RefineryChapterState; resources: ResourceState; module: PlacedRefineryModule }
  | {
    ok: false;
    reason: 'lane-not-found' | 'column-out-of-bounds' | 'cell-occupied' | 'insufficient-resources';
    chapter: RefineryChapterState;
    resources: ResourceState;
  };

export type RefineryBlockedReason = 'insufficient-energy-water' | 'insufficient-minerals' | 'slag-capacity';

export interface TickRefineryResult {
  chapter: RefineryChapterState;
  resources: ResourceState;
  blockedReason: RefineryBlockedReason | null;
}

export interface RefineryGoalProgress {
  siliconComplete: boolean;
  parallelComplete: boolean;
  complete: boolean;
}

export function createInitialRefineryChapter(balance: RefineryBalance): RefineryChapterState {
  return {
    modules: [],
    laneProgress: Object.fromEntries(balance.lanes.map((lane) => [lane.id, 0])) as Record<RefineryLaneId, number>,
    siliconPurityNines: 2,
    refinedOutputs: {},
    slag: 0,
    storedSlag: 0,
    elapsedSeconds: 0,
    triggeredEvents: [],
    firstFacts: []
  };
}

export function placeRefineryModule(
  chapter: RefineryChapterState,
  resources: ResourceState,
  placement: { laneId: RefineryLaneId; column: number; moduleType: RefineryModuleType },
  balance: RefineryBalance
): PlaceRefineryModuleResult {
  const lane = balance.lanes.find((candidate) => candidate.id === placement.laneId);
  if (!lane) {
    return { ok: false, reason: 'lane-not-found', chapter, resources };
  }

  if (placement.column < 0 || placement.column >= balance.grid.columns) {
    return { ok: false, reason: 'column-out-of-bounds', chapter, resources };
  }

  if (chapter.modules.some((module) => module.laneId === placement.laneId && module.column === placement.column)) {
    return { ok: false, reason: 'cell-occupied', chapter, resources };
  }

  const spent = spendResources(resources, balance.moduleCost);
  if (!spent.ok) {
    return { ok: false, reason: 'insufficient-resources', chapter, resources };
  }

  const module: PlacedRefineryModule = {
    id: `module-${placement.laneId}-${placement.column}`,
    laneId: placement.laneId,
    column: placement.column,
    moduleType: placement.moduleType
  };

  return {
    ok: true,
    chapter: {
      ...chapter,
      modules: [...chapter.modules, module]
    },
    resources: spent.resources,
    module
  };
}

export function addRefineryResources(resources: ResourceState, delta: ResourceDelta, caps: ResourceCaps): ResourceState {
  return addResources(resources, delta, caps);
}

export function getActiveLaneModules(
  chapter: RefineryChapterState,
  laneId: RefineryLaneId,
  balance: RefineryBalance
): PlacedRefineryModule[] {
  const lane = balance.lanes.find((candidate) => candidate.id === laneId);
  if (!lane) {
    return [];
  }

  const byColumn = chapter.modules
    .filter((module) => module.laneId === laneId)
    .sort((a, b) => a.column - b.column);

  const active: PlacedRefineryModule[] = [];
  for (let index = 0; index < lane.requiredModules.length; index += 1) {
    const module = byColumn.find((candidate) => candidate.column === index);
    if (!module || module.moduleType !== lane.requiredModules[index]) {
      break;
    }
    active.push(module);
  }

  return active;
}

export function tickRefinery(
  chapter: RefineryChapterState,
  resources: ResourceState,
  elapsedSeconds: number,
  balance: RefineryBalance,
  caps: ResourceCaps,
  options: { progressMultiplier?: number } = {}
): TickRefineryResult {
  if (elapsedSeconds <= 0) {
    return { chapter, resources, blockedReason: null };
  }

  const progressMultiplier = Math.max(0, options.progressMultiplier ?? 1);
  let mineralCost: Partial<Record<MineralType, number>> = {};
  let energyCost = 0;
  let waterCost = 0;
  let slagProduced = 0;
  const laneIncrements: Partial<Record<RefineryLaneId, number>> = {};

  for (const lane of balance.lanes) {
    const activeModules = getActiveLaneModules(chapter, lane.id, balance);
    if (activeModules.length !== lane.requiredModules.length) {
      continue;
    }

    mineralCost = {
      ...mineralCost,
      [lane.mineral]: (mineralCost[lane.mineral] ?? 0) + lane.mineralInputPerSecond * elapsedSeconds
    };
    energyCost += lane.energyPerSecond * elapsedSeconds;
    waterCost += lane.waterPerSecond * elapsedSeconds;
    slagProduced += lane.slagPerSecond * elapsedSeconds;
    laneIncrements[lane.id] = lane.progressPerSecond * elapsedSeconds * progressMultiplier;
  }

  if (Object.keys(laneIncrements).length === 0) {
    return {
      chapter: {
        ...chapter,
        elapsedSeconds: round(chapter.elapsedSeconds + elapsedSeconds)
      },
      resources,
      blockedReason: null
    };
  }

  if (resources.energy < energyCost || resources.water < waterCost) {
    return { chapter, resources, blockedReason: 'insufficient-energy-water' };
  }

  if (Object.entries(mineralCost).some(([mineral, amount]) => resources.minerals[mineral as MineralType] < amount)) {
    return { chapter, resources, blockedReason: 'insufficient-minerals' };
  }

  if (chapter.slag + slagProduced > balance.slagCap) {
    return { chapter, resources, blockedReason: 'slag-capacity' };
  }

  const nextResources = addResources(resources, {
    minerals: Object.fromEntries(Object.entries(mineralCost).map(([mineral, amount]) => [mineral, -round(amount)])),
    energy: -round(energyCost),
    water: -round(waterCost)
  }, caps);

  let siliconPurityNines = chapter.siliconPurityNines;
  const refinedOutputs = { ...chapter.refinedOutputs };
  const laneProgress = { ...chapter.laneProgress };

  for (const [laneId, increment] of Object.entries(laneIncrements) as Array<[RefineryLaneId, number]>) {
    const lane = balance.lanes.find((candidate) => candidate.id === laneId);
    if (!lane) {
      continue;
    }

    laneProgress[laneId] = round((laneProgress[laneId] ?? 0) + increment);
    while (laneProgress[laneId] >= 1) {
      laneProgress[laneId] = round(laneProgress[laneId] - 1);
      if (laneId === 'silicon') {
        siliconPurityNines = Math.min(lane.target, siliconPurityNines + 1);
      } else {
        const outputLane = laneId as Exclude<RefineryLaneId, 'silicon'>;
        refinedOutputs[outputLane] = round((refinedOutputs[outputLane] ?? 0) + 1);
      }
    }
  }

  return {
    chapter: {
      ...chapter,
      laneProgress,
      siliconPurityNines,
      refinedOutputs,
      slag: round(chapter.slag + slagProduced),
      elapsedSeconds: round(chapter.elapsedSeconds + elapsedSeconds)
    },
    resources: nextResources,
    blockedReason: null
  };
}

export function recycleSlag(
  chapter: RefineryChapterState,
  resources: ResourceState,
  balance: RefineryBalance,
  caps: ResourceCaps
): { chapter: RefineryChapterState; resources: ResourceState } {
  const slag = Math.min(chapter.slag, balance.recycleSlag.slag);
  return {
    chapter: { ...chapter, slag: round(chapter.slag - slag) },
    resources: addResources(resources, { credits: balance.recycleSlag.credits }, caps)
  };
}

export function storeSlag(
  chapter: RefineryChapterState,
  resources: ResourceState,
  balance: RefineryBalance,
  caps: ResourceCaps
): { chapter: RefineryChapterState; resources: ResourceState } {
  const slag = Math.min(chapter.slag, balance.storeSlag.slag);
  return {
    chapter: {
      ...chapter,
      slag: round(chapter.slag - slag),
      storedSlag: round(chapter.storedSlag + slag)
    },
    resources: addResources(resources, { credits: balance.storeSlag.credits }, caps)
  };
}

export function getRefineryGoalProgress(chapter: RefineryChapterState, balance: RefineryBalance): RefineryGoalProgress {
  const siliconComplete = chapter.siliconPurityNines >= 9;
  const parallelComplete = Object.entries(balance.parallelTargets).every(([laneId, target]) => {
    return (chapter.refinedOutputs[laneId as Exclude<RefineryLaneId, 'silicon'>] ?? 0) >= (target ?? 0);
  });

  return {
    siliconComplete,
    parallelComplete,
    complete: siliconComplete && parallelComplete
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
