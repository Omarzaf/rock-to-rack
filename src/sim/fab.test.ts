import { describe, expect, it } from 'vitest';
import {
  applyFabEventPenalty,
  calculateWaferYield,
  completeFabWafer,
  createInitialFabChapter,
  generateDieMap,
  getFabGoalProgress,
  scoreCoatStation,
  scoreDopeStation,
  scoreEtchStation,
  scoreExposeStation,
  type FabBalance,
  type FabStationScores
} from './fab';

const balance: FabBalance = {
  tickSeconds: 0.25,
  wafersRequired: 3,
  dieGrid: { columns: 8, rows: 6 },
  chipsPerGoodDie: 1,
  baseWaferQuality: 80,
  stations: {
    coat: { targetCoverage: 0.92, evennessWeight: 0.35 },
    expose: { perfectDistance: 0, maxDistance: 90 },
    etch: { targetSeconds: 3.2, toleranceSeconds: 0.45, maxPenaltySeconds: 2.5 },
    dope: { zonesRequired: 4 }
  },
  nodes: [
    { id: '90nm', label: '90nm', toleranceMultiplier: 1, chipValue: 1 },
    { id: '28nm', label: '28nm', toleranceMultiplier: 0.82, chipValue: 1.4 },
    { id: '7nm', label: '7nm', toleranceMultiplier: 0.62, chipValue: 2.2 }
  ],
  eventPenalties: {
    dustYieldPenalty: 14,
    calibrationScorePenalty: 8
  },
  pacingTargetSeconds: { min: 840, max: 960 },
  eventTriggers: {
    dustAtWaferIndex: 1,
    calibrationAtWaferIndex: 2
  }
};

const strongScores: FabStationScores = {
  coat: 92,
  expose: 90,
  etch: 88,
  dope: 94
};

describe('fab simulation', () => {
  it('starts with the first wafer at coat station', () => {
    const chapter = createInitialFabChapter(balance, 80);

    expect(chapter.stage).toBe('coat');
    expect(chapter.currentWaferIndex).toBe(0);
    expect(chapter.waferQuality).toBe(80);
    expect(chapter.nodeYields).toEqual([]);
  });

  it('scores coat station from coverage and evenness', () => {
    expect(scoreCoatStation({ coverage: 0.92, evenness: 0.95 }, balance)).toBeGreaterThan(90);
    expect(scoreCoatStation({ coverage: 0.45, evenness: 0.5 }, balance)).toBeLessThan(60);
  });

  it('scores expose station from mask distance', () => {
    expect(scoreExposeStation({ distance: 4 }, balance, balance.nodes[0])).toBeGreaterThan(90);
    expect(scoreExposeStation({ distance: 70 }, balance, balance.nodes[2])).toBeLessThan(35);
  });

  it('scores etch station around target dwell time', () => {
    expect(scoreEtchStation({ heldSeconds: 3.2 }, balance)).toBe(100);
    expect(scoreEtchStation({ heldSeconds: 1.1 }, balance)).toBeLessThan(50);
  });

  it('scores dope station from color-zone matches', () => {
    expect(scoreDopeStation({ matches: 4, misses: 0 }, balance)).toBe(100);
    expect(scoreDopeStation({ matches: 1, misses: 2 }, balance)).toBeLessThan(40);
  });

  it('makes smaller nodes harder at the same station scores', () => {
    const easy = calculateWaferYield(80, strongScores, balance, balance.nodes[0]);
    const hard = calculateWaferYield(80, strongScores, balance, balance.nodes[2]);

    expect(easy).toBeGreaterThan(hard);
    expect(hard).toBeGreaterThan(0);
  });

  it('generates deterministic die maps from yield', () => {
    const map = generateDieMap(75, balance, '28nm');

    expect(map).toHaveLength(48);
    expect(map.filter((die) => die.good).length).toBe(36);
    expect(map.some((die) => !die.good)).toBe(true);
  });

  it('applies fab event penalties without dropping below zero', () => {
    const chapter = createInitialFabChapter(balance, 80);

    const penalized = applyFabEventPenalty(chapter, 'dust', balance);

    expect(penalized.eventYieldPenalty).toBe(14);
    expect(penalized.triggeredEvents).toContain('dust');
  });

  it('completes one wafer and adds chips from good dies', () => {
    const chapter = createInitialFabChapter(balance, 80);
    const result = completeFabWafer(chapter, strongScores, balance, balance.nodes[0]);

    expect(result.chapter.currentWaferIndex).toBe(1);
    expect(result.nodeYield.goodDies).toBeGreaterThan(0);
    expect(result.chipsProduced).toBe(result.nodeYield.goodDies);
  });

  it('reports goal complete after three wafers', () => {
    let chapter = createInitialFabChapter(balance, 80);
    for (const node of balance.nodes) {
      chapter = completeFabWafer(chapter, strongScores, balance, node).chapter;
    }

    expect(getFabGoalProgress(chapter, balance).complete).toBe(true);
    expect(chapter.stage).toBe('complete');
  });
});
