import type { ChipTypeId, CrisisRunGrade, CrisisRunResult, GameState } from '../state/types';

const DEFAULT_CRISIS_RUN_CHIP_IDS: ChipTypeId[] = ['cpu', 'gpu', 'dram', 'nand', 'nic', 'pmic', 'nova'];
const DEFAULT_CRISIS_RUN_CREDITS = 700;

export interface CrisisRunScoreInput {
  elapsedSeconds: number;
  cityLights: number;
  servedContracts: number;
  powerEfficiency: number;
  heatPeak: number;
  mistakes: number;
}

export interface CrisisRunResultInput extends CrisisRunScoreInput {
  runId: string;
  completedAt: string;
}

export type CrisisRunReplayStatus = 'first-run' | 'new-best' | 'matched-best' | 'missed-best';

export interface CrisisRunReplayComparison {
  status: CrisisRunReplayStatus;
  bestScore: number | null;
  deltaFromPreviousBest: number | null;
  targetScore: number;
  headline: string;
  detail: string;
  replayPrompt: string;
}

export type CrisisRunChallengeSource = 'quick-play' | 'campaign';

export interface CrisisRunChallenge {
  dailySeed: string;
  source: CrisisRunChallengeSource;
  availableChipIds: ChipTypeId[];
  startingCredits: number;
  label: string;
}

export const CRISIS_RUN_TARGET_SECONDS = 600;
export const CRISIS_RUN_HISTORY_LIMIT = 12;

export function elapsedWallClockSeconds(startMs: number, endMs: number): number {
  const elapsedMs = Math.max(0, endMs - startMs);
  return Math.max(1, Math.ceil(elapsedMs / 1000));
}

export function createCrisisRunChallenge(state: Pick<GameState, 'chapters'>, now: Date | string = new Date()): CrisisRunChallenge {
  const dailySeed = dailySeedForDate(now);
  const campaignChipIds = state.chapters.ch5.completed && state.chapters.ch5.selectedChipIds.length > 0
    ? [...state.chapters.ch5.selectedChipIds]
    : [...DEFAULT_CRISIS_RUN_CHIP_IDS];
  const source: CrisisRunChallengeSource = state.chapters.ch5.completed && state.chapters.ch5.selectedChipIds.length > 0
    ? 'campaign'
    : 'quick-play';
  const startingCredits = DEFAULT_CRISIS_RUN_CREDITS
    + campaignChipIds.length * 15
    + challengeSeedBonus(dailySeed);

  return {
    dailySeed,
    source,
    availableChipIds: campaignChipIds,
    startingCredits,
    label: challengeLabel(source, dailySeed, campaignChipIds.length)
  };
}

export function calculateCrisisRunScore(input: CrisisRunScoreInput): number {
  const cityScore = clamp(input.cityLights, 0, 100) * 4;
  const contractScore = clamp(input.servedContracts, 0, 4) * 80;
  const speedRatio = clamp((CRISIS_RUN_TARGET_SECONDS - input.elapsedSeconds) / CRISIS_RUN_TARGET_SECONDS, -0.8, 0.6);
  const speedScore = 120 + speedRatio * 160;
  const efficiencyScore = clamp(input.powerEfficiency, 0, 1) * 120;
  const heatPenalty = Math.max(0, input.heatPeak - 70) * 4;
  const mistakePenalty = Math.max(0, input.mistakes) * 35;
  return Math.round(clamp(cityScore + contractScore + speedScore + efficiencyScore - heatPenalty - mistakePenalty, 0, 1000));
}

export function gradeForScore(score: number): CrisisRunGrade {
  if (score >= 900) {
    return 'S';
  }

  if (score >= 780) {
    return 'A';
  }

  if (score >= 640) {
    return 'B';
  }

  if (score >= 480) {
    return 'C';
  }

  return 'D';
}

export function createCrisisRunResult(input: CrisisRunResultInput): CrisisRunResult {
  const score = calculateCrisisRunScore(input);
  const grade = gradeForScore(score);
  return {
    ...input,
    mode: 'crisis',
    score,
    grade,
    shareLine: `Rock to Rack Crisis Run: ${score} points, grade ${grade}, ${Math.round(input.cityLights)}% city lights online.`
  };
}

export function bestCrisisRun(current: CrisisRunResult | null, candidate: CrisisRunResult): CrisisRunResult {
  if (!current) {
    return candidate;
  }

  if (candidate.score > current.score) {
    return candidate;
  }

  if (candidate.score === current.score && candidate.elapsedSeconds < current.elapsedSeconds) {
    return candidate;
  }

  return current;
}

export function compareCrisisRunToBest(previousBest: CrisisRunResult | null, result: CrisisRunResult): CrisisRunReplayComparison {
  if (!previousBest) {
    return {
      status: 'first-run',
      bestScore: null,
      deltaFromPreviousBest: null,
      targetScore: result.score + 1,
      headline: `First run scored ${result.score}`,
      detail: 'Replay to set a higher best score.',
      replayPrompt: `Replay to beat ${result.score}`
    };
  }

  const delta = result.score - previousBest.score;
  if (delta > 0) {
    return {
      status: 'new-best',
      bestScore: previousBest.score,
      deltaFromPreviousBest: delta,
      targetScore: result.score + 1,
      headline: `New best by ${delta} pts`,
      detail: `Previous best was ${previousBest.score}.`,
      replayPrompt: `Replay to beat ${result.score}`
    };
  }

  if (delta === 0) {
    return {
      status: 'matched-best',
      bestScore: previousBest.score,
      deltaFromPreviousBest: 0,
      targetScore: previousBest.score + 1,
      headline: 'Matched your best',
      detail: `Beat ${previousBest.score} to set a new best.`,
      replayPrompt: `Replay to beat ${previousBest.score}`
    };
  }

  return {
    status: 'missed-best',
    bestScore: previousBest.score,
    deltaFromPreviousBest: delta,
    targetScore: previousBest.score + 1,
    headline: `${Math.abs(delta)} pts short of best`,
    detail: `Best remains ${previousBest.score}.`,
    replayPrompt: `Replay to beat ${previousBest.score}`
  };
}

export function appendCrisisRunHistory(history: CrisisRunResult[], result: CrisisRunResult): CrisisRunResult[] {
  return [result, ...history].slice(0, CRISIS_RUN_HISTORY_LIMIT);
}

function dailySeedForDate(now: Date | string): string {
  const date = typeof now === 'string' ? new Date(now) : now;
  return Number.isNaN(date.getTime()) ? '1970-01-01' : date.toISOString().slice(0, 10);
}

function challengeSeedBonus(dailySeed: string): number {
  const hash = [...dailySeed].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 0);
  return (hash % 4) * 10;
}

function challengeLabel(source: CrisisRunChallengeSource, dailySeed: string, chipCount: number): string {
  const lineupLabel = source === 'campaign' ? `campaign lineup (${chipCount} chips)` : 'quick play lineup';
  return `Daily seed ${dailySeed} · ${lineupLabel}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
