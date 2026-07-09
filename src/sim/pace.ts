import type { MineralType } from '../state/types';
import type { ResourceDelta } from './economy';

export type ChapterId = 1 | 2 | 3 | 4 | 5 | 6;
export type PaceState = 'ahead' | 'onTrack' | 'behind' | 'complete';

export interface PaceTargetSeconds {
  min: number;
  max: number;
}

export interface PaceSettings {
  behindThreshold: number;
  catchUpMultiplier: number;
}

export interface ChapterPaceSnapshot {
  chapter: ChapterId;
  elapsedSeconds: number;
  progressRatio: number;
  targetSeconds: PaceTargetSeconds;
}

export interface PaceStatus extends ChapterPaceSnapshot {
  expectedRatio: number;
  behindBy: number;
  state: PaceState;
  catchUpMultiplier: number;
}

const MINERALS: MineralType[] = ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'];

export function calculatePaceStatus(snapshot: ChapterPaceSnapshot, settings: PaceSettings): PaceStatus {
  const progressRatio = clamp(snapshot.progressRatio, 0, 1);
  const maxSeconds = Math.max(1, snapshot.targetSeconds.max);
  const expectedRatio = clamp(snapshot.elapsedSeconds / maxSeconds, 0, 1);
  const behindBy = Math.max(0, expectedRatio - progressRatio);
  const state: PaceState = progressRatio >= 1
    ? 'complete'
    : behindBy > settings.behindThreshold
      ? 'behind'
      : progressRatio > expectedRatio + settings.behindThreshold
        ? 'ahead'
        : 'onTrack';

  return {
    ...snapshot,
    progressRatio,
    expectedRatio,
    behindBy,
    state,
    catchUpMultiplier: state === 'behind' ? settings.catchUpMultiplier : 1
  };
}

export function applyCatchUpToPositiveDelta(delta: ResourceDelta, multiplier: number): ResourceDelta {
  if (multiplier <= 1) {
    return delta;
  }

  const minerals = delta.minerals
    ? Object.fromEntries(MINERALS.map((mineral) => {
      const amount = delta.minerals?.[mineral];
      return [mineral, boostPositive(amount, multiplier)];
    }).filter(([, amount]) => amount !== undefined)) as Partial<Record<MineralType, number>>
    : undefined;

  return {
    ...delta,
    minerals,
    wafers: boostPositive(delta.wafers, multiplier),
    chips: boostPositive(delta.chips, multiplier),
    energy: boostPositive(delta.energy, multiplier),
    water: boostPositive(delta.water, multiplier),
    credits: boostPositive(delta.credits, multiplier)
  };
}

export function catchUpBonusDelta(delta: ResourceDelta, multiplier: number): ResourceDelta {
  if (multiplier <= 1) {
    return {};
  }

  const bonusMultiplier = multiplier - 1;
  const minerals = delta.minerals
    ? Object.fromEntries(MINERALS.map((mineral) => {
      const amount = delta.minerals?.[mineral];
      return [mineral, bonusPositive(amount, bonusMultiplier)];
    }).filter(([, amount]) => amount !== undefined)) as Partial<Record<MineralType, number>>
    : undefined;

  return {
    minerals,
    wafers: bonusPositive(delta.wafers, bonusMultiplier),
    chips: bonusPositive(delta.chips, bonusMultiplier),
    energy: bonusPositive(delta.energy, bonusMultiplier),
    water: bonusPositive(delta.water, bonusMultiplier),
    credits: bonusPositive(delta.credits, bonusMultiplier)
  };
}

export function chapterProgressRatio(completedUnits: number, totalUnits: number): number {
  if (totalUnits <= 0) {
    return 1;
  }

  return clamp(completedUnits / totalUnits, 0, 1);
}

function boostPositive(value: number | undefined, multiplier: number): number | undefined {
  if (value === undefined || value <= 0) {
    return value;
  }

  return round(value * multiplier);
}

function bonusPositive(value: number | undefined, multiplier: number): number | undefined {
  if (value === undefined || value <= 0) {
    return undefined;
  }

  return round(value * multiplier);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
