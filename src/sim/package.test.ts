import { describe, expect, it } from 'vitest';
import {
  buildChip,
  createInitialPackageChapter,
  getPackageGoalProgress,
  sortTestDie,
  type ChipDefinition,
  type PackageBalance
} from './package';
import type { FabNodeYield } from '../state/types';

const balance: PackageBalance = {
  tickSeconds: 0.25,
  sortSampleSize: 18,
  maxBuildChoices: 4,
  binThresholds: {
    perfect: 88,
    good: 58
  },
  testScoreByNode: {
    '90nm': { base: 72, step: 7 },
    '28nm': { base: 78, step: 6 },
    '7nm': { base: 84, step: 5 }
  },
  wrongSortDowngrade: true,
  pacingTargetSeconds: { min: 720, max: 840 },
  eventTriggers: {
    probeDriftAtSortedCount: 6,
    substrateShortageAtBuiltCount: 2
  }
};

const yields: FabNodeYield[] = [
  { node: '90nm', yieldPercent: 84, goodDies: 40, defectiveDies: 8 },
  { node: '28nm', yieldPercent: 77, goodDies: 37, defectiveDies: 11 },
  { node: '7nm', yieldPercent: 66, goodDies: 32, defectiveDies: 16 }
];

const chips: ChipDefinition[] = [
  {
    id: 'cpu',
    name: { kid: 'CPU', nerd: 'CPU' },
    nickname: { kid: 'The Captain', nerd: 'The Captain' },
    persona: { kid: 'Calm all-rounder', nerd: 'General-purpose control processor' },
    cost: { perfect: 1, good: 4, salvage: 0 },
    requiresPerfect7nm: false,
    locked: false,
    effectKey: 'generalBoost',
    cardColor: '#38bdf8',
    superpower: { kid: 'Helps every building work better.', nerd: 'Improves general-purpose coordination across systems.' },
    lesson: { kid: 'A CPU is the computer captain.', nerd: 'CPUs handle flexible control flow and general-purpose tasks.' },
    ch6Hint: { kid: 'Good for almost any rack.', nerd: 'Broadly useful for baseline data-center services.' }
  },
  {
    id: 'gpu',
    name: { kid: 'GPU', nerd: 'GPU' },
    nickname: { kid: 'The Swarm', nerd: 'The Swarm' },
    persona: { kid: 'Thousands of tiny workers', nerd: 'Massively parallel processor' },
    cost: { perfect: 3, good: 5, salvage: 0 },
    requiresPerfect7nm: false,
    locked: false,
    effectKey: 'aiContracts',
    cardColor: '#a78bfa',
    superpower: { kid: 'Unlocks big AI jobs.', nerd: 'Accelerates parallel math workloads.' },
    lesson: { kid: 'AI uses lots of workers at once.', nerd: 'GPUs are valuable because many cores run parallel operations efficiently.' },
    ch6Hint: { kid: 'AI contracts need this.', nerd: 'Required for AI-heavy contracts in Chapter 6.' }
  }
];

describe('package simulation', () => {
  it('creates a deterministic test lot from Chapter 4 yields', () => {
    const chapter = createInitialPackageChapter(balance, yields, 109);

    expect(chapter.stage).toBe('dice');
    expect(chapter.testDies).toHaveLength(18);
    expect(chapter.testDies.some((die) => die.node === '7nm')).toBe(true);
    expect(chapter.bins).toEqual({ perfect: 0, good: 0, salvage: 0 });
  });

  it('keeps small test lots deterministic when fewer samples than nodes are available', () => {
    const chapter = createInitialPackageChapter(
      { ...balance, sortSampleSize: 2 },
      [...yields].reverse(),
      109
    );

    expect(chapter.testDies).toHaveLength(2);
    expect(chapter.testDies.map((die) => die.node)).toEqual(['90nm', '28nm']);
  });

  it('maps test scores into expected bins', () => {
    const chapter = createInitialPackageChapter(balance, yields, 109);
    const perfectDie = chapter.testDies.find((die) => die.expectedBin === 'perfect');

    expect(perfectDie?.testScore).toBeGreaterThanOrEqual(88);
  });

  it('credits the intended bin when sorted correctly', () => {
    const chapter = createInitialPackageChapter(balance, yields, 109);
    const die = chapter.testDies[0];
    const result = sortTestDie(chapter, die.id, die.expectedBin, balance);

    expect(result.sortedDie?.actualBin).toBe(die.expectedBin);
    expect(result.chapter.sortedCount).toBe(1);
    expect(result.chapter.bins[die.expectedBin]).toBe(1);
  });

  it('downgrades one bin on an incorrect sort', () => {
    const chapter = createInitialPackageChapter(balance, yields, 109);
    const die = chapter.testDies.find((candidate) => candidate.expectedBin === 'perfect');
    expect(die).toBeDefined();
    const dieId = die!.id;

    const result = sortTestDie(chapter, dieId, 'salvage', balance);

    expect(result.chapter.testDies.find((candidate) => candidate.id === dieId)?.actualBin).toBe('good');
    expect(result.chapter.bins.good).toBe(1);
  });

  it('spends bins to build chips and enforces max choices', () => {
    let chapter = createInitialPackageChapter(balance, yields, 109);
    chapter = {
      ...chapter,
      stage: 'roster',
      bins: { perfect: 10, good: 16, salvage: 6 }
    };

    chapter = buildChip(chapter, chips[0]).chapter;
    chapter = buildChip(chapter, chips[1]).chapter;

    expect(chapter.selectedChipIds).toEqual(['cpu', 'gpu']);
    expect(chapter.builtChips).toHaveLength(2);
    expect(chapter.bins.perfect).toBe(6);
  });

  it('reports complete after the roster stage has at least one chip', () => {
    let chapter = createInitialPackageChapter(balance, yields, 109);
    chapter = {
      ...chapter,
      stage: 'complete',
      selectedChipIds: ['cpu'],
      builtChips: [{ chipId: 'cpu', builtAtSeconds: 100 }]
    };

    expect(getPackageGoalProgress(chapter, balance).complete).toBe(true);
  });
});
