import { describe, expect, it } from 'vitest';
import type { ResourceState } from '../state/types';
import type { ResourceCaps } from './economy';
import {
  applyVibrationPenalty,
  canRetryPull,
  completeSliceStage,
  createInitialCrystalChapter,
  generateIngotProfile,
  getCrystalGoalProgress,
  getSliceStageStatus,
  retryPull,
  sliceIngot,
  tickCrystalPull,
  type CrystalBalance,
  type CrystalChapterState
} from './crystal';

const balance: CrystalBalance = {
  tickSeconds: 1,
  targetPullSeconds: 12,
  targetIngotHeight: 100,
  greenZone: { min: 45, max: 55 },
  temperature: {
    start: 50,
    min: 0,
    max: 100,
    pullDriftPerSecond: 5,
    restDriftPerSecond: -3,
    noisePerSecond: 0
  },
  resourceUsePerSecond: {
    energy: 0.08,
    water: 0.04
  },
  retryLimit: 1,
  vibrationPenalty: {
    stability: 0.18,
    temperature: 9,
    timePenaltySeconds: 20
  },
  slicing: {
    guideCount: 8,
    tolerance: 6,
    flawedThreshold: 0.42,
    waferQualityScale: 100
  },
  pacingTargetSeconds: {
    min: 720,
    max: 840
  }
};

const resources: ResourceState = {
  minerals: {
    quartz: 60,
    copper: 30,
    lithium: 20,
    cobalt: 16,
    rareEarths: 8
  },
  wafers: 0,
  chips: 0,
  energy: 100,
  water: 100,
  credits: 500
};

const caps: ResourceCaps = {
  minerals: {
    quartz: 80,
    copper: 60,
    lithium: 45,
    cobalt: 36,
    rareEarths: 30
  },
  wafers: 24,
  chips: 40,
  energy: 100,
  water: 100,
  credits: 1000
};

describe('crystal simulation', () => {
  it('starts in pull stage with centered temperature', () => {
    const chapter = createInitialCrystalChapter(balance);

    expect(chapter.stage).toBe('pull');
    expect(chapter.temperature).toBe(50);
    expect(chapter.ingotHeight).toBe(0);
    expect(chapter.retryCount).toBe(0);
  });

  it('pulling in the green zone grows the ingot and raises quality', () => {
    let chapter = createInitialCrystalChapter(balance);
    let nextResources = resources;

    for (let index = 0; index < 8; index += 1) {
      const result = tickCrystalPull(chapter, nextResources, true, 1, balance);
      chapter = result.chapter;
      nextResources = result.resources;
    }

    expect(chapter.ingotHeight).toBeGreaterThan(0);
    expect(chapter.quality).toBeGreaterThan(0.5);
    expect(nextResources.energy).toBeLessThan(resources.energy);
    expect(nextResources.water).toBeLessThan(resources.water);
  });

  it('can boost ingot growth without increasing energy or water costs', () => {
    const chapter = createInitialCrystalChapter(balance);

    const normal = tickCrystalPull(chapter, resources, true, 1, balance);
    const boosted = tickCrystalPull(chapter, resources, true, 1, balance, { growthMultiplier: 2 });

    expect(boosted.chapter.ingotHeight).toBeCloseTo(normal.chapter.ingotHeight * 2);
    expect(boosted.resources.energy).toBe(normal.resources.energy);
    expect(boosted.resources.water).toBe(normal.resources.water);
  });

  it('applies vibration as a stability and temperature penalty', () => {
    const chapter = createInitialCrystalChapter(balance);

    const result = applyVibrationPenalty(chapter, balance);

    expect(result.temperature).toBe(59);
    expect(result.stabilityPenalty).toBeCloseTo(0.18);
    expect(result.elapsedSeconds).toBe(20);
  });

  it('allows one pull retry and then blocks additional retries', () => {
    const chapter = {
      ...createInitialCrystalChapter(balance),
      ingotHeight: 80,
      quality: 0.2
    };

    const first = retryPull(chapter, balance);
    const second = retryPull(first, balance);

    expect(canRetryPull(chapter, balance)).toBe(true);
    expect(first.retryCount).toBe(1);
    expect(second.retryCount).toBe(1);
    expect(second.ingotHeight).toBe(first.ingotHeight);
  });

  it('generates smoother ingot profile from higher quality', () => {
    const high = generateIngotProfile(0.92, balance);
    const low = generateIngotProfile(0.25, balance);

    expect(high.filter((segment) => segment.flawed).length).toBeLessThan(low.filter((segment) => segment.flawed).length);
    expect(high.every((segment) => segment.width > 0)).toBe(true);
  });

  it('accurate slices create wafers while flawed sections are discarded', () => {
    const chapter = {
      ...createInitialCrystalChapter(balance),
      stage: 'slice' as const,
      quality: 0.8,
      ingotProfile: [
        { start: 0, end: 25, width: 84, flawed: false },
        { start: 25, end: 50, width: 34, flawed: true },
        { start: 50, end: 100, width: 86, flawed: false }
      ]
    };

    const first = sliceIngot(chapter, 12.5, balance);
    const second = sliceIngot(first.chapter, 37.5, balance);

    expect(first.createdWafer).toBe(true);
    expect(second.createdWafer).toBe(false);
    expect(second.chapter.wafersProduced).toBe(1);
  });

  it('re-slicing an already-cut segment produces no extra wafer', () => {
    const chapter = {
      ...createInitialCrystalChapter(balance),
      stage: 'slice' as const,
      quality: 0.8,
      ingotProfile: [
        { start: 0, end: 50, width: 84, flawed: false },
        { start: 50, end: 100, width: 86, flawed: false }
      ]
    };

    const first = sliceIngot(chapter, 25, balance);
    const repeat = sliceIngot(first.chapter, 26, balance);

    expect(first.createdWafer).toBe(true);
    expect(repeat.alreadyCut).toBe(true);
    expect(repeat.createdWafer).toBe(false);
    expect(repeat.chapter.wafersProduced).toBe(1);
    expect(repeat.chapter.sliceAttempts).toHaveLength(1);
  });

  it('slice stage completes once every segment is cut, even flawed ones', () => {
    let chapter: CrystalChapterState = {
      ...createInitialCrystalChapter(balance),
      stage: 'slice',
      quality: 0.3,
      ingotProfile: [
        { start: 0, end: 50, width: 84, flawed: false },
        { start: 50, end: 100, width: 30, flawed: true }
      ]
    };

    expect(getSliceStageStatus(chapter, balance).complete).toBe(false);

    chapter = sliceIngot(chapter, 25, balance).chapter;
    expect(getSliceStageStatus(chapter, balance).complete).toBe(false);

    const flawedResult = sliceIngot(chapter, 75, balance);
    chapter = flawedResult.chapter;

    expect(flawedResult.discardedFlawed).toBe(true);
    expect(getSliceStageStatus(chapter, balance)).toEqual({
      cutSegments: 2,
      totalSegments: 2,
      complete: true
    });

    const completed = completeSliceStage(chapter, resources, balance, caps);
    expect(completed.chapter.stage).toBe('complete');
    expect(completed.chapter.wafersProduced).toBe(1);
    expect(getCrystalGoalProgress(completed.chapter, balance).complete).toBe(true);
  });

  it('missed slices do not consume the segment', () => {
    const chapter = {
      ...createInitialCrystalChapter(balance),
      stage: 'slice' as const,
      quality: 0.8,
      ingotProfile: [{ start: 0, end: 100, width: 84, flawed: false }]
    };

    const missed = sliceIngot(chapter, 5, balance);
    expect(missed.missedGuide).toBe(true);
    expect(getSliceStageStatus(missed.chapter, balance).cutSegments).toBe(0);

    const hit = sliceIngot(missed.chapter, 50, balance);
    expect(hit.createdWafer).toBe(true);
    expect(getSliceStageStatus(hit.chapter, balance).complete).toBe(true);
  });

  it('completes when enough wafers are produced', () => {
    const chapter = {
      ...createInitialCrystalChapter(balance),
      stage: 'slice' as const,
      quality: 0.75,
      wafersProduced: 8
    };

    const result = completeSliceStage(chapter, resources, balance, caps);

    expect(result.chapter.stage).toBe('complete');
    expect(result.chapter.waferQuality).toBe(75);
    expect(result.resources.wafers).toBe(8);
    expect(getCrystalGoalProgress(result.chapter, balance).complete).toBe(true);
  });
});
