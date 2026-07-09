import { describe, expect, it } from 'vitest';
import {
  applyCatchUpToPositiveDelta,
  catchUpBonusDelta,
  chapterProgressRatio,
  calculatePaceStatus,
  type PaceSettings
} from './pace';

const settings: PaceSettings = {
  behindThreshold: 0.2,
  catchUpMultiplier: 1.25
};

describe('pace status', () => {
  it('marks a chapter behind when actual progress trails expected progress by more than the threshold', () => {
    const status = calculatePaceStatus({
      chapter: 1,
      elapsedSeconds: 600,
      progressRatio: 0.45,
      targetSeconds: { min: 600, max: 720 }
    }, settings);

    expect(status.state).toBe('behind');
    expect(status.expectedRatio).toBeCloseTo(0.83, 2);
    expect(status.behindBy).toBeCloseTo(0.38, 2);
    expect(status.catchUpMultiplier).toBe(1.25);
  });

  it('does not boost a chapter that is inside the pace band', () => {
    const status = calculatePaceStatus({
      chapter: 2,
      elapsedSeconds: 360,
      progressRatio: 0.5,
      targetSeconds: { min: 660, max: 780 }
    }, settings);

    expect(status.state).toBe('onTrack');
    expect(status.catchUpMultiplier).toBe(1);
  });

  it('keeps completed chapters at complete with no catch-up boost', () => {
    const status = calculatePaceStatus({
      chapter: 6,
      elapsedSeconds: 1180,
      progressRatio: 1,
      targetSeconds: { min: 1020, max: 1200 }
    }, settings);

    expect(status.state).toBe('complete');
    expect(status.catchUpMultiplier).toBe(1);
  });

  it('boosts only positive passive gains and preserves costs', () => {
    const boosted = applyCatchUpToPositiveDelta({
      minerals: { quartz: 4, copper: -1 },
      energy: -3,
      water: 0,
      credits: 20,
      chips: 2
    }, 1.25);

    expect(boosted.minerals?.quartz).toBe(5);
    expect(boosted.minerals?.copper).toBe(-1);
    expect(boosted.energy).toBe(-3);
    expect(boosted.water).toBe(0);
    expect(boosted.credits).toBe(25);
    expect(boosted.chips).toBe(2.5);
  });

  it('calculates only the extra positive catch-up bonus', () => {
    const bonus = catchUpBonusDelta({
      minerals: { quartz: 4, copper: -1 },
      energy: -3,
      credits: 20
    }, 1.25);

    expect(bonus.minerals?.quartz).toBe(1);
    expect(bonus.minerals?.copper).toBeUndefined();
    expect(bonus.energy).toBeUndefined();
    expect(bonus.credits).toBe(5);
  });

  it('calculates progress from completed and total counts', () => {
    expect(chapterProgressRatio(3, 10)).toBe(0.3);
    expect(chapterProgressRatio(12, 10)).toBe(1);
    expect(chapterProgressRatio(1, 0)).toBe(1);
  });
});
