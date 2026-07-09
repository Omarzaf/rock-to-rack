import { describe, expect, it } from 'vitest';
import type { ResourceState } from '../state/types';
import {
  createInitialRefineryChapter,
  getActiveLaneModules,
  getRefineryGoalProgress,
  placeRefineryModule,
  recycleSlag,
  storeSlag,
  tickRefinery,
  type RefineryBalance,
  type RefineryModuleType
} from './refinery';

const resources: ResourceState = {
  minerals: {
    quartz: 40,
    copper: 20,
    lithium: 12,
    cobalt: 8,
    rareEarths: 4
  },
  wafers: 0,
  chips: 0,
  energy: 100,
  water: 100,
  credits: 500
};

const balance: RefineryBalance = {
  grid: { columns: 5, rows: 4 },
  moduleCost: { credits: 25 },
  tickSeconds: 1,
  slagCap: 30,
  recycleSlag: { slag: 4, credits: 18 },
  storeSlag: { slag: 6, credits: -10 },
  eventTriggers: {
    energySpikeAtSeconds: 10,
    inspectionAtSlag: 8
  },
  lanes: [
    {
      id: 'silicon',
      mineral: 'quartz',
      row: 0,
      requiredModules: ['crusher', 'furnace', 'chemicalBath', 'zoneRefiner'],
      mineralInputPerSecond: 0.02,
      energyPerSecond: 0.08,
      waterPerSecond: 0.05,
      slagPerSecond: 0.03,
      progressPerSecond: 0.018,
      target: 9
    }
  ],
  parallelTargets: {}
};

describe('refinery simulation', () => {
  it('places a module on an empty grid cell and spends credits', () => {
    const chapter = createInitialRefineryChapter(balance);

    const result = placeRefineryModule(chapter, resources, {
      laneId: 'silicon',
      column: 0,
      moduleType: 'crusher'
    }, balance);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resources.credits).toBe(475);
    expect(result.chapter.modules).toEqual([
      { id: 'module-silicon-0', laneId: 'silicon', column: 0, moduleType: 'crusher' }
    ]);
  });

  it('fails atomically when a cell is already occupied', () => {
    const chapter = createInitialRefineryChapter(balance);
    const first = placeRefineryModule(chapter, resources, {
      laneId: 'silicon',
      column: 0,
      moduleType: 'crusher'
    }, balance);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = placeRefineryModule(first.chapter, first.resources, {
      laneId: 'silicon',
      column: 0,
      moduleType: 'furnace'
    }, balance);

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe('cell-occupied');
    expect(second.resources).toEqual(first.resources);
    expect(second.chapter).toEqual(first.chapter);
  });

  it('rejects modules that would skip the active left-to-right chain', () => {
    const chapter = createInitialRefineryChapter(balance);

    const result = placeRefineryModule(chapter, resources, {
      laneId: 'silicon',
      column: 2,
      moduleType: 'crusher'
    }, balance);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('inactive sequence');
    expect(result.resources).toBe(resources);
    expect(result.chapter).toBe(chapter);
  });

  it('treats only correctly ordered adjacent modules as an active chain', () => {
    let chapter = createInitialRefineryChapter(balance);
    const placements = [
      { laneId: 'silicon' as const, column: 0, moduleType: 'crusher' as const },
      { laneId: 'silicon' as const, column: 1, moduleType: 'furnace' as const },
      { laneId: 'silicon' as const, column: 2, moduleType: 'zoneRefiner' as const }
    ];

    for (const placement of placements) {
      const result = placeRefineryModule(chapter, resources, placement, balance);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      chapter = result.chapter;
    }

    expect(getActiveLaneModules(chapter, 'silicon', balance).map((module) => module.moduleType)).toEqual([
      'crusher',
      'furnace'
    ]);
  });

  it('ticks active lanes, consumes resources, raises purity progress, and produces slag', () => {
    let chapter = createInitialRefineryChapter(balance);
    let nextResources = resources;
    for (const [column, moduleType] of ['crusher', 'furnace', 'chemicalBath', 'zoneRefiner'].entries()) {
      const result = placeRefineryModule(chapter, nextResources, {
        laneId: 'silicon',
        column,
        moduleType: moduleType as RefineryModuleType
      }, balance);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      chapter = result.chapter;
      nextResources = result.resources;
    }

    const result = tickRefinery(chapter, nextResources, 60, balance, {
      minerals: { quartz: 80, copper: 60, lithium: 45, cobalt: 36, rareEarths: 30 },
      wafers: 24,
      chips: 40,
      energy: 100,
      water: 100,
      credits: 1000
    });

    expect(result.resources.energy).toBeLessThan(nextResources.energy);
    expect(result.resources.water).toBeLessThan(nextResources.water);
    expect(result.resources.minerals.quartz).toBeLessThan(nextResources.minerals.quartz);
    expect(result.chapter.siliconPurityNines).toBeGreaterThan(2);
    expect(result.chapter.slag).toBeGreaterThan(0);
  });

  it('can boost lane progress without increasing resource costs', () => {
    let chapter = createInitialRefineryChapter(balance);
    let nextResources = resources;
    for (const [column, moduleType] of ['crusher', 'furnace', 'chemicalBath', 'zoneRefiner'].entries()) {
      const result = placeRefineryModule(chapter, nextResources, {
        laneId: 'silicon',
        column,
        moduleType: moduleType as RefineryModuleType
      }, balance);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      chapter = result.chapter;
      nextResources = result.resources;
    }

    const caps = {
      minerals: { quartz: 80, copper: 60, lithium: 45, cobalt: 36, rareEarths: 30 },
      wafers: 24,
      chips: 40,
      energy: 100,
      water: 100,
      credits: 1000
    };
    const normal = tickRefinery(chapter, nextResources, 10, balance, caps);
    const boosted = tickRefinery(chapter, nextResources, 10, balance, caps, { progressMultiplier: 2 });

    expect(boosted.chapter.laneProgress.silicon).toBeCloseTo(normal.chapter.laneProgress.silicon * 2);
    expect(boosted.resources.energy).toBe(normal.resources.energy);
    expect(boosted.resources.water).toBe(normal.resources.water);
  });

  it('does not tick when energy or water is insufficient', () => {
    const chapter = {
      ...createInitialRefineryChapter(balance),
      modules: [
        { id: 'module-silicon-0', laneId: 'silicon' as const, column: 0, moduleType: 'crusher' as const },
        { id: 'module-silicon-1', laneId: 'silicon' as const, column: 1, moduleType: 'furnace' as const },
        { id: 'module-silicon-2', laneId: 'silicon' as const, column: 2, moduleType: 'chemicalBath' as const },
        { id: 'module-silicon-3', laneId: 'silicon' as const, column: 3, moduleType: 'zoneRefiner' as const }
      ]
    };
    const poorResources = { ...resources, energy: 0 };

    const result = tickRefinery(chapter, poorResources, 60, balance, {
      minerals: { quartz: 80, copper: 60, lithium: 45, cobalt: 36, rareEarths: 30 },
      wafers: 24,
      chips: 40,
      energy: 100,
      water: 100,
      credits: 1000
    });

    expect(result.blockedReason).toBe('insufficient-energy-water');
    expect(result.chapter).toEqual(chapter);
    expect(result.resources).toEqual(poorResources);
  });

  it('recycles and stores slag through explicit actions', () => {
    const chapter = { ...createInitialRefineryChapter(balance), slag: 10 };

    const recycled = recycleSlag(chapter, resources, balance, {
      minerals: { quartz: 80, copper: 60, lithium: 45, cobalt: 36, rareEarths: 30 },
      wafers: 24,
      chips: 40,
      energy: 100,
      water: 100,
      credits: 1000
    });
    expect(recycled.chapter.slag).toBe(6);
    expect(recycled.resources.credits).toBe(518);

    const stored = storeSlag(chapter, resources, balance, {
      minerals: { quartz: 80, copper: 60, lithium: 45, cobalt: 36, rareEarths: 30 },
      wafers: 24,
      chips: 40,
      energy: 100,
      water: 100,
      credits: 1000
    });
    expect(stored.chapter.slag).toBe(4);
    expect(stored.chapter.storedSlag).toBe(6);
    expect(stored.resources.credits).toBe(490);
  });

  it('reports completion when silicon reaches 9N and parallel targets are met', () => {
    const chapter = {
      ...createInitialRefineryChapter({
        ...balance,
        parallelTargets: { copper: 2, lithium: 1 }
      }),
      siliconPurityNines: 9,
      refinedOutputs: { copper: 2, lithium: 1 }
    };

    expect(getRefineryGoalProgress(chapter, {
      ...balance,
      parallelTargets: { copper: 2, lithium: 1 }
    }).complete).toBe(true);
  });
});
