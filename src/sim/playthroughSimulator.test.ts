import { describe, expect, it } from 'vitest';
import balance from '../content/balance.json';
import chips from '../content/chips.json';
import events from '../content/events.json';
import {
  BOT_PROFILES,
  formatSimulationReport,
  runPlaythroughSimulation
} from './playthroughSimulator';

describe('playthrough simulator', () => {
  it('runs fast, average, and slow profiles through all six chapters', () => {
    const results = BOT_PROFILES.map((profile) => runPlaythroughSimulation({
      profile,
      balance,
      chips,
      events
    }));

    expect(results.map((result) => result.profileId)).toEqual(['fast', 'average', 'slow']);
    for (const result of results) {
      expect(result.completed).toBe(true);
      expect(result.chapters).toHaveLength(6);
      expect(result.chapters.every((chapter) => chapter.completed)).toBe(true);
      expect(result.totalSeconds).toBeGreaterThan(0);
      expect(result.resourceCurves.length).toBeGreaterThan(6);
    }
  });

  it('keeps profile totals inside the 10-minute retention target', () => {
    const byProfile = Object.fromEntries(BOT_PROFILES.map((profile) => {
      const result = runPlaythroughSimulation({ profile, balance, chips, events });
      return [result.profileId, result.totalSeconds / 60];
    }));

    expect(byProfile.fast).toBeGreaterThanOrEqual(8);
    expect(byProfile.fast).toBeLessThanOrEqual(9.5);
    expect(byProfile.average).toBeGreaterThanOrEqual(9.5);
    expect(byProfile.average).toBeLessThanOrEqual(10.5);
    expect(byProfile.slow).toBeGreaterThanOrEqual(10);
    expect(byProfile.slow).toBeLessThanOrEqual(11.5);
  });

  it('triggers catch-up at least once for the slow profile', () => {
    const result = runPlaythroughSimulation({
      profile: BOT_PROFILES.find((profile) => profile.id === 'slow')!,
      balance,
      chips,
      events
    });

    expect(result.chapters.some((chapter) => chapter.catchUpTriggered)).toBe(true);
  });

  it('keeps Chapter 5 bins tied to actually sorted dies', () => {
    const result = runPlaythroughSimulation({
      profile: BOT_PROFILES.find((profile) => profile.id === 'average')!,
      balance,
      chips,
      events
    });
    const packageChapter = result.chapters.find((chapter) => chapter.chapter === 5);

    expect(packageChapter?.package).toBeDefined();
    const packageSummary = packageChapter!.package!;
    const binnedDies = Object.values(packageSummary.sortedBins).reduce((sum, count) => sum + count, 0);
    const remainingBins = Object.values(packageSummary.remainingBins).reduce((sum, count) => sum + count, 0);

    expect(binnedDies).toBe(packageSummary.sortedDies);
    expect(packageSummary.remainingBins).not.toBe(packageSummary.sortedBins);
    expect(remainingBins).toBeLessThanOrEqual(binnedDies);
    expect(packageSummary.perfect7nmDies).toBeLessThanOrEqual(packageSummary.sortedBins.perfect);
    expect(packageSummary.builtCount).toBeLessThanOrEqual(balance.ch5.maxBuildChoices);
    expect(packageSummary.remainingBins.perfect).toBeLessThanOrEqual(packageSummary.sortedBins.perfect);
    expect(packageSummary.remainingBins.good).toBeLessThanOrEqual(packageSummary.sortedBins.good);
    expect(packageSummary.remainingBins.salvage).toBeLessThanOrEqual(packageSummary.sortedBins.salvage);
  });

  it('formats a stable markdown report', () => {
    const results = BOT_PROFILES.map((profile) => runPlaythroughSimulation({
      profile,
      balance,
      chips,
      events
    }));

    const report = formatSimulationReport(results);

    expect(report).toContain('# M9 Simulation Report');
    expect(report).toContain('| Profile | Total min | Completed | Catch-up chapters |');
    expect(report).toContain('| fast |');
    expect(report).toContain('| average |');
    expect(report).toContain('| slow |');
  });

  it('prints the report when used by the simulate script', () => {
    const report = formatSimulationReport(BOT_PROFILES.map((profile) => runPlaythroughSimulation({
      profile,
      balance,
      chips,
      events
    })));

    console.log(report);
    expect(report.length).toBeGreaterThan(500);
  });
});
