import { describe, expect, it } from 'vitest';
import {
  elapsedWallClockSeconds,
  bestCrisisRun,
  calculateCrisisRunScore,
  compareCrisisRunToBest,
  createCrisisRunResult,
  gradeForScore
} from './crisisRun';
import type { CrisisRunResult } from '../state/types';

describe('crisis run scoring', () => {
  it('keeps completed runs from reporting 0 seconds', () => {
    expect(elapsedWallClockSeconds(1_000, 1_100)).toBe(1);
    expect(elapsedWallClockSeconds(1_000, 8_250)).toBe(8);
  });

  it('rewards city lights, contracts, efficiency, and speed', () => {
    const score = calculateCrisisRunScore({
      elapsedSeconds: 420,
      cityLights: 100,
      servedContracts: 4,
      powerEfficiency: 0.9,
      heatPeak: 42,
      mistakes: 0
    });

    expect(score).toBeGreaterThanOrEqual(850);
    expect(score).toBeLessThanOrEqual(1000);
  });

  it('penalizes overheated and incomplete runs', () => {
    const score = calculateCrisisRunScore({
      elapsedSeconds: 900,
      cityLights: 55,
      servedContracts: 1,
      powerEfficiency: 0.35,
      heatPeak: 96,
      mistakes: 5
    });

    expect(score).toBeLessThan(430);
  });

  it('assigns stable grades', () => {
    expect(gradeForScore(930)).toBe('S');
    expect(gradeForScore(810)).toBe('A');
    expect(gradeForScore(670)).toBe('B');
    expect(gradeForScore(510)).toBe('C');
    expect(gradeForScore(320)).toBe('D');
  });

  it('creates a deterministic result with a share line', () => {
    const result = createCrisisRunResult({
      runId: 'run-001',
      completedAt: '2026-07-08T12:00:00.000Z',
      elapsedSeconds: 510,
      cityLights: 88,
      servedContracts: 3,
      powerEfficiency: 0.74,
      heatPeak: 63,
      mistakes: 1
    });

    expect(result.mode).toBe('crisis');
    expect(result.score).toBeGreaterThan(650);
    expect(result.shareLine).toContain('Rock to Rack');
    expect(result.shareLine).toContain(String(result.score));
  });

  it('keeps the higher score and uses faster time as a tie breaker', () => {
    const slower: CrisisRunResult = createCrisisRunResult({
      runId: 'slow',
      completedAt: '2026-07-08T12:00:00.000Z',
      elapsedSeconds: 600,
      cityLights: 100,
      servedContracts: 4,
      powerEfficiency: 0.8,
      heatPeak: 50,
      mistakes: 1
    });
    const faster: CrisisRunResult = {
      ...slower,
      runId: 'fast',
      elapsedSeconds: 450
    };
    const weaker: CrisisRunResult = {
      ...slower,
      runId: 'weak',
      score: slower.score - 50
    };

    expect(bestCrisisRun(null, slower)).toBe(slower);
    expect(bestCrisisRun(slower, weaker)).toBe(slower);
    expect(bestCrisisRun(slower, faster)).toBe(faster);
  });

  it('describes a first replay target after the first run', () => {
    const result: CrisisRunResult = {
      runId: 'first',
      mode: 'crisis',
      completedAt: '2026-07-08T12:00:00.000Z',
      elapsedSeconds: 510,
      cityLights: 100,
      servedContracts: 4,
      powerEfficiency: 0.8,
      heatPeak: 55,
      mistakes: 1,
      score: 880,
      grade: 'A',
      shareLine: 'Rock to Rack Crisis Run: 880 points, grade A, 100% city lights online.'
    };

    expect(compareCrisisRunToBest(null, result)).toEqual({
      status: 'first-run',
      bestScore: null,
      deltaFromPreviousBest: null,
      targetScore: 881,
      headline: 'First run scored 880',
      detail: 'Replay to set a higher best score.',
      replayPrompt: 'Replay to beat 880'
    });
  });

  it('describes a new best and the next target', () => {
    const previous: CrisisRunResult = {
      runId: 'old',
      mode: 'crisis',
      completedAt: '2026-07-08T12:00:00.000Z',
      elapsedSeconds: 540,
      cityLights: 100,
      servedContracts: 4,
      powerEfficiency: 0.7,
      heatPeak: 62,
      mistakes: 1,
      score: 850,
      grade: 'A',
      shareLine: 'Rock to Rack Crisis Run: 850 points, grade A, 100% city lights online.'
    };
    const result = { ...previous, runId: 'new', elapsedSeconds: 430, score: 905, grade: 'S' as const };

    expect(compareCrisisRunToBest(previous, result)).toEqual({
      status: 'new-best',
      bestScore: 850,
      deltaFromPreviousBest: 55,
      targetScore: 906,
      headline: 'New best by 55 pts',
      detail: 'Previous best was 850.',
      replayPrompt: 'Replay to beat 905'
    });
  });

  it('describes a missed best without changing the target', () => {
    const previous: CrisisRunResult = {
      runId: 'best',
      mode: 'crisis',
      completedAt: '2026-07-08T12:00:00.000Z',
      elapsedSeconds: 420,
      cityLights: 100,
      servedContracts: 4,
      powerEfficiency: 0.9,
      heatPeak: 50,
      mistakes: 0,
      score: 930,
      grade: 'S',
      shareLine: 'Rock to Rack Crisis Run: 930 points, grade S, 100% city lights online.'
    };
    const result = { ...previous, runId: 'miss', elapsedSeconds: 560, score: 872, grade: 'A' as const };

    expect(compareCrisisRunToBest(previous, result)).toEqual({
      status: 'missed-best',
      bestScore: 930,
      deltaFromPreviousBest: -58,
      targetScore: 931,
      headline: '58 pts short of best',
      detail: 'Best remains 930.',
      replayPrompt: 'Replay to beat 930'
    });
  });
});
