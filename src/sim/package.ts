import type { ChipTypeId, DieBinId, FabNodeId, FabNodeYield } from '../state/types';

export type PackageStage = 'dice' | 'sort' | 'roster' | 'complete';

export interface PackageText {
  kid: string;
  nerd: string;
}

export interface PackageBalance {
  tickSeconds: number;
  sortSampleSize: number;
  maxBuildChoices: number;
  binThresholds: {
    perfect: number;
    good: number;
  };
  testScoreByNode: Record<FabNodeId, { base: number; step: number }>;
  wrongSortDowngrade: boolean;
  fallbackNodeYields?: FabNodeYield[];
  pacingTargetSeconds: {
    min: number;
    max: number;
  };
  eventTriggers?: {
    probeDriftAtSortedCount: number;
    substrateShortageAtBuiltCount: number;
  };
}

export interface ChipDefinition {
  id: ChipTypeId;
  name: PackageText;
  nickname: PackageText;
  persona: PackageText;
  cost: Record<DieBinId, number>;
  requiresPerfect7nm: boolean;
  locked: boolean;
  effectKey: string;
  cardColor: string;
  superpower: PackageText;
  lesson: PackageText;
  ch6Hint: PackageText;
}

export interface TestDie {
  id: string;
  node: FabNodeId;
  sourceYieldPercent: number;
  testScore: number;
  expectedBin: DieBinId;
  actualBin: DieBinId | null;
  sorted: boolean;
}

export interface BuiltChip {
  chipId: ChipTypeId;
  builtAtSeconds: number;
}

export interface PackageChapterState {
  stage: PackageStage;
  elapsedSeconds: number;
  inputChips: number;
  testDies: TestDie[];
  activeDieIndex: number;
  sortedCount: number;
  bins: Record<DieBinId, number>;
  selectedChipIds: ChipTypeId[];
  builtChips: BuiltChip[];
  revealedChipIds: ChipTypeId[];
  perfect7nmDies: number;
  triggeredEvents: string[];
  firstFacts: string[];
}

export interface PackageGoalProgress {
  complete: boolean;
  sortedCount: number;
  builtCount: number;
}

export interface SortTestDieResult {
  chapter: PackageChapterState;
  sortedDie?: TestDie;
}

export interface BuildChipResult {
  ok: boolean;
  chapter: PackageChapterState;
  reason?: string;
}

export function createInitialPackageChapter(
  balance: PackageBalance,
  nodeYields: FabNodeYield[],
  inputChips: number
): PackageChapterState {
  const testDies = createTestDies(balance, nodeYields);

  return {
    stage: 'dice',
    elapsedSeconds: 0,
    inputChips,
    testDies,
    activeDieIndex: 0,
    sortedCount: 0,
    bins: { perfect: 0, good: 0, salvage: 0 },
    selectedChipIds: [],
    builtChips: [],
    revealedChipIds: [],
    perfect7nmDies: 0,
    triggeredEvents: [],
    firstFacts: []
  };
}

export function expectedBinForScore(score: number, balance: PackageBalance): DieBinId {
  if (score >= balance.binThresholds.perfect) {
    return 'perfect';
  }

  if (score >= balance.binThresholds.good) {
    return 'good';
  }

  return 'salvage';
}

export function sortTestDie(
  chapter: PackageChapterState,
  dieId: string,
  targetBin: DieBinId,
  balance: PackageBalance
): SortTestDieResult {
  const index = chapter.testDies.findIndex((die) => die.id === dieId);
  if (index < 0) {
    return { chapter };
  }

  const die = chapter.testDies[index];
  if (die.sorted) {
    return { chapter, sortedDie: die };
  }

  const actualBin = targetBin === die.expectedBin || !balance.wrongSortDowngrade
    ? targetBin
    : downgradeBin(die.expectedBin);

  const sortedDie: TestDie = {
    ...die,
    actualBin,
    sorted: true
  };
  const testDies = chapter.testDies.slice();
  testDies[index] = sortedDie;

  const bins = {
    ...chapter.bins,
    [actualBin]: chapter.bins[actualBin] + 1
  } as Record<DieBinId, number>;

  const sortedCount = chapter.sortedCount + 1;
  const activeDieIndex = nextUnsortedDieIndex(testDies, index);
  const perfect7nmDies = chapter.perfect7nmDies + (sortedDie.node === '7nm' && actualBin === 'perfect' ? 1 : 0);

  return {
    chapter: {
      ...chapter,
      stage: testDies.every((testDie) => testDie.sorted) ? 'roster' : 'sort',
      testDies,
      activeDieIndex,
      sortedCount,
      bins,
      perfect7nmDies
    },
    sortedDie
  };
}

export function canBuildChip(chapter: PackageChapterState, chip: ChipDefinition, maxBuildChoices = 4): boolean {
  if (chapter.stage !== 'roster' || chip.locked || chapter.selectedChipIds.length >= maxBuildChoices) {
    return false;
  }

  if (chapter.selectedChipIds.includes(chip.id)) {
    return false;
  }

  if (chip.requiresPerfect7nm && chapter.perfect7nmDies < 1) {
    return false;
  }

  return hasEnoughBins(chapter.bins, chip.cost);
}

export function buildChip(chapter: PackageChapterState, chip: ChipDefinition, maxBuildChoices = 4): BuildChipResult {
  if (chapter.selectedChipIds.includes(chip.id)) {
    return { ok: false, chapter, reason: 'already built' };
  }

  if (chip.locked) {
    return { ok: false, chapter, reason: 'locked' };
  }

  if (chapter.stage !== 'roster') {
    return { ok: false, chapter, reason: 'roster not ready' };
  }

  if (chapter.selectedChipIds.length >= maxBuildChoices) {
    return { ok: false, chapter, reason: 'max choices reached' };
  }

  if (chip.requiresPerfect7nm && chapter.perfect7nmDies < 1) {
    return { ok: false, chapter, reason: 'needs perfect 7nm die' };
  }

  if (!hasEnoughBins(chapter.bins, chip.cost)) {
    return { ok: false, chapter, reason: 'insufficient bins' };
  }

  const bins = {
    perfect: chapter.bins.perfect - chip.cost.perfect,
    good: chapter.bins.good - chip.cost.good,
    salvage: chapter.bins.salvage - chip.cost.salvage
  };

  const builtAtSeconds = chapter.elapsedSeconds;
  const selectedChipIds = [...chapter.selectedChipIds, chip.id];
  const builtChips = [...chapter.builtChips, { chipId: chip.id, builtAtSeconds }];
  const revealedChipIds = chapter.revealedChipIds.includes(chip.id)
    ? chapter.revealedChipIds
    : [...chapter.revealedChipIds, chip.id];

  return {
    ok: true,
    chapter: {
      ...chapter,
      bins,
      selectedChipIds,
      builtChips,
      revealedChipIds
    }
  };
}

export function applyPackageEvent(
  chapter: PackageChapterState,
  event: 'probeDrift' | 'substrateShortage'
): PackageChapterState {
  const eventName = event;
  if (chapter.triggeredEvents.includes(eventName)) {
    return chapter;
  }

  return {
    ...chapter,
    triggeredEvents: [...chapter.triggeredEvents, eventName]
  };
}

export function getPackageGoalProgress(
  chapter: PackageChapterState,
  _balance: PackageBalance
): PackageGoalProgress {
  return {
    complete: chapter.stage === 'complete' && chapter.selectedChipIds.length > 0,
    sortedCount: chapter.sortedCount,
    builtCount: chapter.builtChips.length
  };
}

function createTestDies(balance: PackageBalance, nodeYields: FabNodeYield[]): TestDie[] {
  const sortedYields = nodeYields
    .filter((yieldRow) => yieldRow.goodDies > 0)
    .sort(compareNodeYields);
  const allocations = allocateNodeCounts(balance.sortSampleSize, sortedYields);
  const dies: TestDie[] = [];

  sortedYields.forEach((yieldRow, nodeIndex) => {
    const count = allocations[nodeIndex] ?? 0;
    for (let index = 0; index < count; index += 1) {
      const score = clamp(
        balance.testScoreByNode[yieldRow.node].base + ((index % 5) - 1) * balance.testScoreByNode[yieldRow.node].step + Math.round(yieldRow.yieldPercent * 0.1),
        30,
        100
      );

      dies.push({
        id: `${yieldRow.node}-${index + 1}`,
        node: yieldRow.node,
        sourceYieldPercent: yieldRow.yieldPercent,
        testScore: score,
        expectedBin: expectedBinForScore(score, balance),
        actualBin: null,
        sorted: false
      });
    }
  });

  return dies.slice(0, balance.sortSampleSize);
}

function allocateNodeCounts(sampleSize: number, nodeYields: FabNodeYield[]): number[] {
  if (sampleSize <= 0 || nodeYields.length === 0) {
    return nodeYields.map(() => 0);
  }

  const goodDiesTotal = totalGoodDies(nodeYields);
  if (goodDiesTotal <= 0) {
    return nodeYields.map(() => 0);
  }

  if (sampleSize <= nodeYields.length) {
    return nodeYields.map((_yieldRow, index) => (index < sampleSize ? 1 : 0));
  }

  const counts = nodeYields.map(() => 1);
  let assigned = counts.reduce((sum, count) => sum + count, 0);
  const remaining = sampleSize - assigned;
  const rawShares = nodeYields.map((yieldRow) => (yieldRow.goodDies / goodDiesTotal) * remaining);

  rawShares.forEach((share, index) => {
    const extra = Math.floor(share);
    counts[index] += extra;
    assigned += extra;
  });

  if (assigned < sampleSize) {
    const order = rawShares
      .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
      .sort((left, right) => right.remainder - left.remainder || left.index - right.index);

    let cursor = 0;
    while (assigned < sampleSize && order.length > 0) {
      const target = order[cursor % order.length];
      counts[target.index] += 1;
      assigned += 1;
      cursor += 1;
    }
  }

  return counts;
}

function compareNodeYields(left: FabNodeYield, right: FabNodeYield): number {
  return right.goodDies - left.goodDies || nodeRank(left.node) - nodeRank(right.node);
}

function nodeRank(node: FabNodeId): number {
  if (node === '90nm') {
    return 0;
  }

  if (node === '28nm') {
    return 1;
  }

  return 2;
}

function totalGoodDies(nodeYields: FabNodeYield[]): number {
  return nodeYields.reduce((sum, yieldRow) => sum + Math.max(0, yieldRow.goodDies), 0);
}

function hasEnoughBins(bins: Record<DieBinId, number>, cost: Record<DieBinId, number>): boolean {
  return bins.perfect >= cost.perfect && bins.good >= cost.good && bins.salvage >= cost.salvage;
}

function downgradeBin(bin: DieBinId): DieBinId {
  if (bin === 'perfect') {
    return 'good';
  }

  return 'salvage';
}

function nextUnsortedDieIndex(testDies: TestDie[], currentIndex: number): number {
  const nextIndex = testDies.findIndex((die, index) => index > currentIndex && !die.sorted);
  return nextIndex >= 0 ? nextIndex : currentIndex;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
