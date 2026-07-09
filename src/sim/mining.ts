import type { MineralType, ResourceState } from '../state/types';
import { addResources, spendResources, type ResourceCaps, type ResourceDelta } from './economy';

export interface MineDeposit {
  id: string;
  mineral: MineralType;
  x: number;
  y: number;
  depth: number;
  richness: number;
  remaining: number;
}

export interface PlacedMiner {
  id: string;
  depositId: string;
  mineral: MineralType;
  depth: number;
}

export interface MiningChapterState {
  deposits: MineDeposit[];
  miners: PlacedMiner[];
  firstMined: MineralType[];
  elapsedSeconds: number;
  triggeredEvents: string[];
}

export interface MiningBalance {
  minerSlots: number;
  minerCost: ResourceDelta;
  minerRefund?: ResourceDelta;
  extractionPerSecond: Record<MineralType, number>;
  energyUpkeepPerDepthSecond: number;
  targetBasket: Partial<Record<MineralType, number>>;
  pacingTargetSeconds: {
    min: number;
    max: number;
  };
}

export type PlaceMinerResult =
  | {
      ok: true;
      chapter: MiningChapterState;
      resources: ResourceState;
      miner: PlacedMiner;
    }
  | {
      ok: false;
      reason: 'deposit-not-found' | 'deposit-depleted' | 'already-mined' | 'slot-limit' | 'insufficient-resources';
      chapter: MiningChapterState;
      resources: ResourceState;
    };

export type RemoveMinerResult =
  | {
      ok: true;
      chapter: MiningChapterState;
      miner: PlacedMiner;
    }
  | {
      ok: false;
      reason: 'miner-not-found';
      chapter: MiningChapterState;
    };

export interface TickMiningResult {
  chapter: MiningChapterState;
  resources: ResourceState;
  extracted: ResourceDelta;
  energySpent: number;
}

export interface GoalProgressItem {
  current: number;
  target: number;
  complete: boolean;
}

export interface GoalProgress {
  items: Partial<Record<MineralType, GoalProgressItem>>;
  complete: boolean;
}

export function placeMiner(
  chapter: MiningChapterState,
  resources: ResourceState,
  depositId: string,
  balance: MiningBalance
): PlaceMinerResult {
  const deposit = chapter.deposits.find((candidate) => candidate.id === depositId);
  if (!deposit) {
    return {
      ok: false,
      reason: 'deposit-not-found',
      chapter,
      resources
    };
  }

  if (deposit.remaining <= 0) {
    return {
      ok: false,
      reason: 'deposit-depleted',
      chapter,
      resources
    };
  }

  if (chapter.miners.some((miner) => miner.depositId === depositId)) {
    return {
      ok: false,
      reason: 'already-mined',
      chapter,
      resources
    };
  }

  if (chapter.miners.length >= balance.minerSlots) {
    return {
      ok: false,
      reason: 'slot-limit',
      chapter,
      resources
    };
  }

  const spent = spendResources(resources, balance.minerCost);
  if (!spent.ok) {
    return {
      ok: false,
      reason: 'insufficient-resources',
      chapter,
      resources
    };
  }

  const miner: PlacedMiner = {
    id: `miner-${deposit.id}`,
    depositId: deposit.id,
    mineral: deposit.mineral,
    depth: deposit.depth
  };

  return {
    ok: true,
    chapter: {
      ...chapter,
      miners: [...chapter.miners, miner]
    },
    resources: spent.resources,
    miner
  };
}

export function tickMining(
  chapter: MiningChapterState,
  resources: ResourceState,
  elapsedSeconds: number,
  balance: MiningBalance,
  caps: ResourceCaps
): TickMiningResult {
  if (elapsedSeconds <= 0) {
    return {
      chapter,
      resources,
      extracted: {
        minerals: {}
      },
      energySpent: 0
    };
  }

  const deposits = chapter.deposits.map((deposit) => ({ ...deposit }));
  const extracted: ResourceDelta = {
    minerals: {}
  };
  const firstMined = new Set(chapter.firstMined);
  let energySpent = 0;
  const elapsed = Math.max(0, elapsedSeconds);

  for (const miner of chapter.miners) {
    const deposit = deposits.find((candidate) => candidate.id === miner.depositId);
    if (!deposit || deposit.remaining <= 0) {
      continue;
    }

    const rate = balance.extractionPerSecond[deposit.mineral] * deposit.richness;
    const mined = Math.min(deposit.remaining, rate * elapsed);
    deposit.remaining = roundResource(deposit.remaining - mined);

    if (mined > 0) {
      extracted.minerals = {
        ...extracted.minerals,
        [deposit.mineral]: roundResource((extracted.minerals?.[deposit.mineral] ?? 0) + mined)
      };
      firstMined.add(deposit.mineral);
    }

    energySpent += Math.max(0, deposit.depth - 1) * balance.energyUpkeepPerDepthSecond * elapsed;
  }

  const resourcesAfterExtraction = addResources(resources, extracted, caps);
  const resourcesAfterUpkeep = addResources(resourcesAfterExtraction, {
    energy: -roundResource(energySpent)
  }, caps);

  return {
    chapter: {
      ...chapter,
      deposits,
      firstMined: [...firstMined],
      elapsedSeconds: roundResource(chapter.elapsedSeconds + elapsedSeconds)
    },
    resources: resourcesAfterUpkeep,
    extracted,
    energySpent: roundResource(energySpent)
  };
}

export function removeMiner(chapter: MiningChapterState, depositId: string): RemoveMinerResult {
  const miner = chapter.miners.find((candidate) => candidate.depositId === depositId);
  if (!miner) {
    return {
      ok: false,
      reason: 'miner-not-found',
      chapter
    };
  }

  return {
    ok: true,
    miner,
    chapter: {
      ...chapter,
      miners: chapter.miners.filter((candidate) => candidate.depositId !== depositId)
    }
  };
}

export function removeMinerWithRefund(
  chapter: MiningChapterState,
  resources: ResourceState,
  depositId: string,
  balance: MiningBalance,
  caps: ResourceCaps
): RemoveMinerResult & { resources: ResourceState } {
  const result = removeMiner(chapter, depositId);
  if (!result.ok) {
    return { ...result, resources };
  }

  // Refund the placement cost so swapping miners between deposits can never
  // strand the player without enough credits to finish the chapter.
  return {
    ...result,
    resources: addResources(resources, balance.minerRefund ?? {}, caps)
  };
}

export function getGoalProgress(
  resources: ResourceState,
  target: Partial<Record<MineralType, number>>
): GoalProgress {
  const items: Partial<Record<MineralType, GoalProgressItem>> = {};

  for (const [mineral, targetAmount] of Object.entries(target) as Array<[MineralType, number]>) {
    const current = resources.minerals[mineral];
    items[mineral] = {
      current,
      target: targetAmount,
      complete: current >= targetAmount
    };
  }

  return {
    items,
    complete: Object.values(items).every((item) => item.complete)
  };
}

export function isGoalComplete(
  resources: ResourceState,
  target: Partial<Record<MineralType, number>>
): boolean {
  return getGoalProgress(resources, target).complete;
}

export function estimateCompletionSeconds(
  balance: MiningBalance,
  target: Partial<Record<MineralType, number>>
): number {
  const targetEntries = Object.entries(target) as Array<[MineralType, number]>;
  if (targetEntries.length === 0) {
    return 0;
  }

  if (targetEntries.some(([mineral, amount]) => amount > 0 && balance.extractionPerSecond[mineral] <= 0)) {
    return Number.POSITIVE_INFINITY;
  }

  const slowestSingleMinerSeconds = Math.max(
    ...targetEntries.map(([mineral, amount]) => {
      const rate = balance.extractionPerSecond[mineral];
      return amount / rate;
    })
  );
  const rawParallelSeconds = slowestSingleMinerSeconds * Math.max(1, targetEntries.length / balance.minerSlots);
  return Math.round(clamp(rawParallelSeconds, balance.pacingTargetSeconds.min, balance.pacingTargetSeconds.max));
}

function roundResource(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
