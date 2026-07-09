import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, createInitialGameState, hydrateGameState } from './gameState';
import { createFixtureStateForScene } from '../fixtures/chapterFixtures';
import { SceneKey } from '../scenes/sceneKeys';
import { GameStore } from './gameStore';

describe('GameState', () => {
  it('starts in kid mode with chapter one unlocked', () => {
    const state = createInitialGameState();

    expect(state.preferences.textMode).toBe('kid');
    expect(state.progress.currentChapter).toBe(1);
    expect(state.progress.unlockedChapters).toEqual([1]);
  });

  it('starts with empty chapter one progress', () => {
    const state = createInitialGameState();

    expect(state.chapters.ch1.firstMined).toEqual([]);
    expect(state.chapters.ch1.miners).toEqual([]);
    expect(state.chapters.ch1.deposits.length).toBeGreaterThan(0);
    expect(state.chapters.ch1.elapsedSeconds).toBe(0);
    expect(state.chapters.ch1.triggeredEvents).toEqual([]);
    expect(state.chapters.ch1.completed).toBe(false);
    expect(state.chapters.ch1.completedAtSeconds).toBeNull();
    expect(state.chapters.ch1.quizCorrect).toBeNull();
  });

  it('hydrates Chapter 1 runtime progress so active mining survives module switches', () => {
    const state = hydrateGameState(JSON.stringify({
      version: SAVE_VERSION,
      progress: { currentChapter: 1, unlockedChapters: [1, 2], activeScene: 'Ch2RefineryScene' },
      chapters: {
        ch1: {
          firstMined: ['quartz'],
          miners: [{ id: 'miner-quartz-surface', depositId: 'quartz-surface', mineral: 'quartz', depth: 1 }],
          deposits: [
            { id: 'quartz-surface', mineral: 'quartz', x: 330, y: 314, depth: 1, richness: 1.15, remaining: 18.5 }
          ],
          elapsedSeconds: 12,
          triggeredEvents: ['ch1MineFlood'],
          completed: false,
          completedAtSeconds: null,
          quizCorrect: null
        }
      }
    }));

    expect(state.chapters.ch1.miners).toEqual([
      { id: 'miner-quartz-surface', depositId: 'quartz-surface', mineral: 'quartz', depth: 1 }
    ]);
    expect(state.chapters.ch1.deposits.find((deposit) => deposit.id === 'quartz-surface')?.remaining).toBe(18.5);
    expect(state.chapters.ch1.elapsedSeconds).toBe(12);
    expect(state.chapters.ch1.triggeredEvents).toEqual(['ch1MineFlood']);
  });

  it('initializes Chapter 2 progress', () => {
    const state = createInitialGameState();

    expect(state.chapters.ch2).toEqual({
      completed: false,
      completedAtSeconds: null,
      quizCorrect: null,
      siliconPurityNines: 2,
      refinedOutputs: {},
      slag: 0,
      storedSlag: 0,
      firstFacts: []
    });
  });

  it('initializes Chapter 3 progress', () => {
    const state = createInitialGameState();

    expect(state.chapters.ch3).toEqual({
      completed: false,
      completedAtSeconds: null,
      quizCorrect: null,
      ingotQuality: 0,
      waferQuality: 0,
      wafersProduced: 0,
      retryUsed: false,
      firstFacts: []
    });
  });

  it('initializes Chapter 4 progress', () => {
    const state = createInitialGameState();

    expect(state.chapters.ch4).toEqual({
      completed: false,
      completedAtSeconds: null,
      quizCorrect: null,
      wafersProcessed: 0,
      averageYield: 0,
      bestYield: 0,
      chipsProduced: 0,
      nodeYields: [],
      firstFacts: []
    });
  });

  it('resets incompatible save versions to a fresh state', () => {
    const state = hydrateGameState('{"version":999,"progress":{"currentChapter":6}}');

    expect(state.version).toBe(SAVE_VERSION);
    expect(state.progress.currentChapter).toBe(1);
  });

  it('migrates version 1 saves into version 2 preferences', () => {
    const state = hydrateGameState(JSON.stringify({
      version: 1,
      preferences: { textMode: 'nerd', muted: false },
      progress: { currentChapter: 4, unlockedChapters: [1, 2, 3, 4], activeScene: 'Ch4FabScene' },
      resources: {
        minerals: { quartz: 10, copper: 9, lithium: 8, cobalt: 7, rareEarths: 6 },
        wafers: 3,
        chips: 12,
        energy: 88,
        water: 77,
        credits: 666
      },
      chapters: {},
      updatedAt: new Date(0).toISOString()
    }));

    expect(state.version).toBe(SAVE_VERSION);
    expect(state.preferences.textMode).toBe('nerd');
    expect(state.preferences.textSize).toBe('normal');
    expect(state.progress.currentChapter).toBe(4);
  });

  it('resets future save versions to a fresh state', () => {
    const state = hydrateGameState('{"version":999,"preferences":{"textMode":"nerd","textSize":"large"}}');

    expect(state.version).toBe(SAVE_VERSION);
    expect(state.preferences.textMode).toBe('kid');
    expect(state.preferences.textSize).toBe('normal');
  });

  it('initializes crisis run meta progress', () => {
    const state = createInitialGameState();

    expect(state.meta).toEqual({
      crisisRuns: [],
      bestCrisisRun: null,
      totalCrisisRuns: 0
    });
  });

  it('hydrates version 2 saves into current crisis meta defaults', () => {
    const state = hydrateGameState(JSON.stringify({
      version: 2,
      preferences: { textMode: 'kid', muted: true, textSize: 'normal' },
      progress: { currentChapter: 6, unlockedChapters: [1, 2, 3, 4, 5, 6], activeScene: 'Ch6DatacenterScene' },
      resources: {
        minerals: { quartz: 1, copper: 1, lithium: 1, cobalt: 1, rareEarths: 1 },
        wafers: 1,
        chips: 1,
        energy: 100,
        water: 100,
        credits: 250
      },
      chapters: {},
      updatedAt: '2026-07-08T00:00:00.000Z'
    }));

    expect(state.version).toBe(SAVE_VERSION);
    expect(state.progress.currentChapter).toBe(6);
    expect(state.meta.crisisRuns).toEqual([]);
    expect(state.meta.bestCrisisRun).toBeNull();
    expect(state.meta.totalCrisisRuns).toBe(0);
  });

  it('hydrates old crisis history with a monotonic total run count', () => {
    const state = hydrateGameState(JSON.stringify({
      version: 3,
      meta: {
        crisisRuns: [
          crisisResult({ runId: 'run-2', score: 880, elapsedSeconds: 420 }),
          crisisResult({ runId: 'run-1', score: 700, elapsedSeconds: 560 })
        ]
      }
    }));

    expect(state.meta.crisisRuns).toHaveLength(2);
    expect(state.meta.bestCrisisRun?.runId).toBe('run-2');
    expect(state.meta.totalCrisisRuns).toBe(2);
  });

  it('reconciles stale saved best crisis run with retained history', () => {
    const state = hydrateGameState(JSON.stringify({
      version: SAVE_VERSION,
      meta: {
        totalCrisisRuns: 9,
        bestCrisisRun: crisisResult({ runId: 'stale-best', score: 500, elapsedSeconds: 800 }),
        crisisRuns: [
          crisisResult({ runId: 'actual-best', score: 910, elapsedSeconds: 390 }),
          crisisResult({ runId: 'recent', score: 700, elapsedSeconds: 560 })
        ]
      }
    }));

    expect(state.meta.bestCrisisRun?.runId).toBe('actual-best');
    expect(state.meta.totalCrisisRuns).toBe(9);
  });

  it('hydrates old saves without chapter progress to a safe default', () => {
    const state = hydrateGameState(JSON.stringify({
      version: 1,
      preferences: {
        textMode: 'nerd',
        muted: false
      },
      progress: {
        currentChapter: 1,
        unlockedChapters: [1],
        activeScene: 'Ch1MineScene'
      },
      resources: {
        minerals: {
          quartz: 5,
          copper: 0,
          lithium: 0,
          cobalt: 0,
          rareEarths: 0
        },
        wafers: 0,
        chips: 0,
        energy: 80,
        water: 100,
        credits: 200
      }
    }));

    expect(state.preferences.textMode).toBe('nerd');
    expect(state.chapters.ch1.completed).toBe(false);
    expect(state.chapters.ch1.firstMined).toEqual([]);
  });

  it('hydrates old saves without Chapter 2 progress', () => {
    const state = hydrateGameState(JSON.stringify({
      version: SAVE_VERSION,
      preferences: { textMode: 'kid', muted: true },
      progress: { currentChapter: 2, unlockedChapters: [1, 2], activeScene: 'Ch2RefineryScene' },
      resources: {
        minerals: { quartz: 20, copper: 12, lithium: 8, cobalt: 6, rareEarths: 4 },
        wafers: 0,
        chips: 0,
        energy: 100,
        water: 100,
        credits: 400
      },
      chapters: {
        ch1: {
          firstMined: ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'],
          completed: true,
          completedAtSeconds: 660,
          quizCorrect: true
        }
      },
      updatedAt: new Date(0).toISOString()
    }));

    expect(state.chapters.ch2.completed).toBe(false);
    expect(state.chapters.ch2.siliconPurityNines).toBe(2);
  });

  it('hydrates old saves without Chapter 3 progress', () => {
    const state = hydrateGameState(JSON.stringify({
      version: SAVE_VERSION,
      preferences: { textMode: 'kid', muted: true },
      progress: { currentChapter: 3, unlockedChapters: [1, 2, 3], activeScene: 'Ch3CrystalScene' },
      resources: {
        minerals: { quartz: 50, copper: 24, lithium: 16, cobalt: 12, rareEarths: 8 },
        wafers: 0,
        chips: 0,
        energy: 100,
        water: 100,
        credits: 550
      },
      chapters: {
        ch1: {
          firstMined: ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'],
          completed: true,
          completedAtSeconds: 660,
          quizCorrect: true
        },
        ch2: {
          completed: true,
          completedAtSeconds: 720,
          quizCorrect: true,
          siliconPurityNines: 9,
          refinedOutputs: { copper: 6, lithium: 4, cobalt: 3 },
          slag: 4,
          storedSlag: 6,
          firstFacts: ['ch2-nine-nines']
        }
      },
      updatedAt: new Date(0).toISOString()
    }));

    expect(state.chapters.ch3.completed).toBe(false);
    expect(state.chapters.ch3.waferQuality).toBe(0);
  });

  it('hydrates old saves without Chapter 4 progress', () => {
    const state = hydrateGameState(JSON.stringify({
      version: SAVE_VERSION,
      preferences: { textMode: 'kid', muted: true },
      progress: { currentChapter: 4, unlockedChapters: [1, 2, 3, 4], activeScene: 'Ch4FabScene' },
      resources: {
        minerals: { quartz: 75, copper: 36, lithium: 24, cobalt: 18, rareEarths: 12 },
        wafers: 8,
        chips: 0,
        energy: 100,
        water: 100,
        credits: 700
      },
      chapters: {
        ch1: {
          firstMined: ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'],
          completed: true,
          completedAtSeconds: 660,
          quizCorrect: true
        },
        ch2: {
          completed: true,
          completedAtSeconds: 720,
          quizCorrect: true,
          siliconPurityNines: 9,
          refinedOutputs: { copper: 6, lithium: 4, cobalt: 3 },
          slag: 4,
          storedSlag: 6,
          firstFacts: ['ch2-nine-nines']
        },
        ch3: {
          completed: true,
          completedAtSeconds: 780,
          quizCorrect: true,
          ingotQuality: 80,
          waferQuality: 80,
          wafersProduced: 8,
          retryUsed: false,
          firstFacts: ['ch3-czochralski']
        }
      },
      updatedAt: new Date(0).toISOString()
    }));

    expect(state.chapters.ch4.completed).toBe(false);
    expect(state.chapters.ch4.nodeYields).toEqual([]);
  });

  it('creates a chapter two fixture with chapter one marked complete', () => {
    const state = createFixtureStateForScene(SceneKey.Ch2Refinery);

    expect(state.chapters.ch1.completed).toBe(true);
    expect(state.chapters.ch1.quizCorrect).toBe(true);
    expect(state.progress.unlockedChapters).toContain(2);
    expect(state.resources.minerals.quartz).toBeGreaterThan(0);
  });

  it('creates a chapter three fixture with chapter two marked complete', () => {
    const state = createFixtureStateForScene(SceneKey.Ch3Crystal);

    expect(state.chapters.ch2.completed).toBe(true);
    expect(state.chapters.ch2.siliconPurityNines).toBe(9);
    expect(state.chapters.ch2.refinedOutputs).toEqual({ copper: 6, lithium: 4, cobalt: 3 });
  });

  it('creates a chapter four fixture with chapter three marked complete', () => {
    const state = createFixtureStateForScene(SceneKey.Ch4Fab);

    expect(state.chapters.ch3.completed).toBe(true);
    expect(state.chapters.ch3.ingotQuality).toBe(80);
    expect(state.chapters.ch3.waferQuality).toBe(80);
    expect(state.chapters.ch3.wafersProduced).toBe(8);
    expect(state.resources.wafers).toBe(8);
  });

  it('creates a chapter five fixture with chapter four marked complete', () => {
    const state = createFixtureStateForScene(SceneKey.Ch5Package);

    expect(state.chapters.ch4.completed).toBe(true);
    expect(state.chapters.ch4.chipsProduced).toBeGreaterThan(0);
    expect(state.chapters.ch4.nodeYields).toHaveLength(3);
    expect(state.resources.chips).toBeGreaterThan(0);
  });

  it('initializes Chapter 5 progress', () => {
    const state = createInitialGameState();

    expect(state.chapters.ch5).toEqual({
      completed: false,
      completedAtSeconds: null,
      quizCorrect: null,
      sortedDies: 0,
      bins: { perfect: 0, good: 0, salvage: 0 },
      selectedChipIds: [],
      builtChips: [],
      perfect7nmDies: 0,
      triggeredEvents: [],
      firstFacts: []
    });
  });

  it('initializes Chapter 6 progress', () => {
    const state = createInitialGameState();

    expect(state.chapters.ch6).toEqual({
      completed: false,
      completedAtSeconds: null,
      quizCorrect: null,
      stage: 'build',
      buildings: [],
      servedContracts: [],
      availableChipIds: [],
      installedChipIds: [],
      novaBuilt: false,
      heat: 0,
      powerCapacity: 0,
      powerLoad: 0,
      cooling: 0,
      networkLinks: 0,
      batteryCharge: 0,
      cityLights: 0,
      eventDeltas: { powerCapacity: 0, cooling: 0, batteryCharge: 0 },
      triggeredEvents: [],
      firstFacts: []
    });
  });

  it('hydrates old saves without Chapter 5 progress', () => {
    const state = hydrateGameState(JSON.stringify({
      version: SAVE_VERSION,
      preferences: { textMode: 'kid', muted: true },
      progress: { currentChapter: 5, unlockedChapters: [1, 2, 3, 4, 5], activeScene: 'Ch5PackageScene' },
      resources: {
        minerals: { quartz: 100, copper: 60, lithium: 40, cobalt: 30, rareEarths: 20 },
        wafers: 8,
        chips: 109,
        energy: 100,
        water: 100,
        credits: 1000
      },
      chapters: {
        ch4: {
          completed: true,
          completedAtSeconds: 900,
          quizCorrect: true,
          wafersProcessed: 3,
          averageYield: 76,
          bestYield: 84,
          chipsProduced: 109,
          nodeYields: [{ node: '7nm', yieldPercent: 66, goodDies: 32, defectiveDies: 16 }],
          firstFacts: []
        }
      },
      updatedAt: new Date(0).toISOString()
    }));

    expect(state.chapters.ch5.completed).toBe(false);
    expect(state.chapters.ch5.bins).toEqual({ perfect: 0, good: 0, salvage: 0 });
  });

  it('hydrates Chapter 5 triggered events', () => {
    const state = hydrateGameState(JSON.stringify({
      version: SAVE_VERSION,
      preferences: { textMode: 'kid', muted: true },
      progress: { currentChapter: 5, unlockedChapters: [1, 2, 3, 4, 5], activeScene: 'Ch5PackageScene' },
      resources: {
        minerals: { quartz: 100, copper: 60, lithium: 40, cobalt: 30, rareEarths: 20 },
        wafers: 8,
        chips: 109,
        energy: 100,
        water: 100,
        credits: 1000
      },
      chapters: {
        ch5: {
          completed: false,
          completedAtSeconds: null,
          quizCorrect: null,
          sortedDies: 6,
          bins: { perfect: 1, good: 4, salvage: 1 },
          selectedChipIds: [],
          builtChips: [],
          perfect7nmDies: 0,
          triggeredEvents: ['probeDrift'],
          firstFacts: []
        }
      },
      updatedAt: new Date(0).toISOString()
    }));

    expect(state.chapters.ch5.triggeredEvents).toEqual(['probeDrift']);
  });

  it('hydrates old saves without Chapter 6 progress', () => {
    const state = hydrateGameState(JSON.stringify({
      version: SAVE_VERSION,
      preferences: { textMode: 'kid', muted: true },
      progress: { currentChapter: 6, unlockedChapters: [1, 2, 3, 4, 5, 6], activeScene: 'Ch6DatacenterScene' },
      resources: {
        minerals: { quartz: 120, copper: 72, lithium: 48, cobalt: 36, rareEarths: 24 },
        wafers: 8,
        chips: 109,
        energy: 100,
        water: 100,
        credits: 1000
      },
      chapters: {
        ch5: {
          completed: true,
          completedAtSeconds: 1020,
          quizCorrect: true,
          sortedDies: 18,
          bins: { perfect: 2, good: 4, salvage: 2 },
          selectedChipIds: ['cpu', 'gpu', 'dram', 'pmic'],
          builtChips: [
            { chipId: 'cpu', builtAtSeconds: 610 },
            { chipId: 'gpu', builtAtSeconds: 640 }
          ],
          perfect7nmDies: 1,
          triggeredEvents: [],
          firstFacts: []
        }
      },
      updatedAt: new Date(0).toISOString()
    }));

    expect(state.chapters.ch6.completed).toBe(false);
    expect(state.chapters.ch6.stage).toBe('build');
    expect(state.chapters.ch6.availableChipIds).toEqual([]);
    expect(state.chapters.ch6.eventDeltas).toEqual({ powerCapacity: 0, cooling: 0, batteryCharge: 0 });
  });

  it('hydrates Chapter 6 progress', () => {
    const state = hydrateGameState(JSON.stringify({
      version: SAVE_VERSION,
      preferences: { textMode: 'kid', muted: true },
      progress: { currentChapter: 6, unlockedChapters: [1, 2, 3, 4, 5, 6], activeScene: 'Ch6DatacenterScene' },
      resources: {
        minerals: { quartz: 120, copper: 72, lithium: 48, cobalt: 36, rareEarths: 24 },
        wafers: 8,
        chips: 109,
        energy: 100,
        water: 100,
        credits: 1000
      },
      chapters: {
        ch6: {
          completed: false,
          completedAtSeconds: null,
          quizCorrect: null,
          stage: 'contracts',
          buildings: [
            { id: 'rack-1', type: 'rack', column: 2, row: 2, installedChipIds: ['cpu', 'gpu'] }
          ],
          servedContracts: ['cartoonStream'],
          availableChipIds: ['cpu', 'gpu', 'dram', 'pmic'],
          installedChipIds: ['cpu', 'gpu'],
          novaBuilt: false,
          heat: 44,
          powerCapacity: 54,
          powerLoad: 28,
          cooling: 36,
          networkLinks: 2,
          batteryCharge: 35,
          cityLights: 25,
          eventDeltas: { powerCapacity: 20, cooling: 10, batteryCharge: -15 },
          triggeredEvents: ['heatwave'],
          firstFacts: ['ch6-datacenter-anatomy']
        }
      },
      updatedAt: new Date(0).toISOString()
    }));

    expect(state.chapters.ch6.stage).toBe('contracts');
    expect(state.chapters.ch6.buildings[0].installedChipIds).toEqual(['cpu', 'gpu']);
    expect(state.chapters.ch6.servedContracts).toEqual(['cartoonStream']);
    expect(state.chapters.ch6.eventDeltas).toEqual({ powerCapacity: 20, cooling: 10, batteryCharge: -15 });
    expect(state.chapters.ch6.triggeredEvents).toEqual(['heatwave']);
  });

  it('filters invalid Chapter 6 building types, contract ids, and chip ids during hydration', () => {
    const state = hydrateGameState(JSON.stringify({
      version: SAVE_VERSION,
      preferences: { textMode: 'kid', muted: true },
      progress: { currentChapter: 6, unlockedChapters: [1, 2, 3, 4, 5, 6], activeScene: 'Ch6DatacenterScene' },
      resources: {
        minerals: { quartz: 120, copper: 72, lithium: 48, cobalt: 36, rareEarths: 24 },
        wafers: 8,
        chips: 109,
        energy: 100,
        water: 100,
        credits: 1000
      },
      chapters: {
        ch6: {
          completed: false,
          completedAtSeconds: null,
          quizCorrect: null,
          stage: 'contracts',
          buildings: [
            { id: 'rack-1', type: 'rack', column: 1, row: 1, installedChipIds: ['cpu', 'invalidChip', 'gpu'] },
            { id: 'wrong-1', type: 'spaceElevator', column: 2, row: 2, installedChipIds: ['cpu'] },
            { id: 'network-1', type: 'network', column: 3, row: 3, installedChipIds: ['nic', 'badChip'] }
          ],
          servedContracts: ['cartoonStream', 'badContract', 'hospitalNova'],
          availableChipIds: ['cpu', 'badChip', 'dram'],
          installedChipIds: ['cpu', 'gpu', 'badChip'],
          novaBuilt: false,
          heat: 44,
          powerCapacity: 54,
          powerLoad: 28,
          cooling: 36,
          networkLinks: 2,
          batteryCharge: 35,
          cityLights: 25,
          triggeredEvents: [],
          firstFacts: []
        }
      },
      updatedAt: new Date(0).toISOString()
    }));

    expect(state.chapters.ch6.buildings).toEqual([
      { id: 'rack-1', type: 'rack', column: 1, row: 1, installedChipIds: ['cpu', 'gpu'] },
      { id: 'network-1', type: 'network', column: 3, row: 3, installedChipIds: ['nic'] }
    ]);
    expect(state.chapters.ch6.servedContracts).toEqual(['cartoonStream', 'hospitalNova']);
    expect(state.chapters.ch6.availableChipIds).toEqual(['cpu', 'dram']);
    expect(state.chapters.ch6.installedChipIds).toEqual(['cpu', 'gpu']);
  });

  it('creates a chapter six fixture with chapter five marked complete', () => {
    const state = createFixtureStateForScene(SceneKey.Ch6Datacenter);

    expect(state.chapters.ch5.completed).toBe(true);
    expect(state.chapters.ch5.selectedChipIds.length).toBeGreaterThan(0);
    expect(state.chapters.ch5.builtChips.length).toBe(state.chapters.ch5.selectedChipIds.length);
  });

  it('creates a chapter six fixture with Chapter 6 available chips derived from Chapter 5', () => {
    const state = createFixtureStateForScene(SceneKey.Ch6Datacenter);

    expect(state.chapters.ch5.completed).toBe(true);
    expect(state.chapters.ch6.availableChipIds).toEqual(state.chapters.ch5.selectedChipIds);
    expect(state.chapters.ch6.stage).toBe('build');
  });

  it('grants debug resources through a bounded store helper', () => {
    const store = new GameStore();

    store.grantDebugResources('credits');
    expect(store.getState().resources.credits).toBeGreaterThan(250);

    store.grantDebugResources('chips');
    expect(store.getState().resources.chips).toBeGreaterThan(0);

    store.grantDebugResources('resources');
    expect(store.getState().resources.minerals.quartz).toBeGreaterThan(0);
  });

  it('advances active Chapter 1 mining while another module is open', () => {
    const store = new GameStore();
    const state = createInitialGameState();
    store.replaceState({
      ...state,
      progress: {
        ...state.progress,
        activeScene: SceneKey.Ch2Refinery,
        currentChapter: 2,
        unlockedChapters: [1, 2]
      },
      chapters: {
        ...state.chapters,
        ch1: {
          ...state.chapters.ch1,
          miners: [{ id: 'miner-quartz-surface', depositId: 'quartz-surface', mineral: 'quartz', depth: 1 }]
        }
      }
    });

    store.advanceBackgroundOperations(5_000);

    expect(store.getState().chapters.ch1.elapsedSeconds).toBeGreaterThan(0);
    expect(store.getState().resources.minerals.quartz).toBeGreaterThan(0);
    expect(store.getState().progress.activeScene).toBe(SceneKey.Ch2Refinery);
  });

  it('records crisis results and keeps the best run', () => {
    const store = new GameStore();
    const weaker = {
      runId: 'weaker',
      mode: 'crisis' as const,
      completedAt: '2026-07-08T12:00:00.000Z',
      elapsedSeconds: 620,
      cityLights: 70,
      servedContracts: 2,
      powerEfficiency: 0.6,
      heatPeak: 80,
      mistakes: 2,
      score: 500,
      grade: 'C' as const,
      shareLine: 'Rock to Rack Crisis Run: 500 points, grade C, 70% city lights online.'
    };
    const stronger = {
      ...weaker,
      runId: 'stronger',
      elapsedSeconds: 500,
      cityLights: 100,
      servedContracts: 4,
      score: 880,
      grade: 'A' as const,
      shareLine: 'Rock to Rack Crisis Run: 880 points, grade A, 100% city lights online.'
    };

    store.recordCrisisRunResult(weaker);
    store.recordCrisisRunResult(stronger);

    expect(store.getState().meta.crisisRuns.map((run) => run.runId)).toEqual(['stronger', 'weaker']);
    expect(store.getState().meta.bestCrisisRun?.runId).toBe('stronger');
    expect(store.getState().meta.totalCrisisRuns).toBe(2);
  });

  it('keeps a true total crisis run count after visible history is capped', () => {
    const store = new GameStore();

    for (let index = 1; index <= 13; index += 1) {
      store.recordCrisisRunResult(crisisResult({
        runId: `run-${index}`,
        score: 600 + index,
        elapsedSeconds: 600 - index
      }));
    }

    expect(store.getState().meta.crisisRuns).toHaveLength(12);
    expect(store.getState().meta.crisisRuns[0].runId).toBe('run-13');
    expect(store.getState().meta.totalCrisisRuns).toBe(13);
  });
});

function crisisResult(overrides: Partial<{
  runId: string;
  elapsedSeconds: number;
  cityLights: number;
  servedContracts: number;
  powerEfficiency: number;
  heatPeak: number;
  mistakes: number;
  score: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
}> = {}) {
  const score = overrides.score ?? 700;
  return {
    runId: overrides.runId ?? 'run',
    mode: 'crisis' as const,
    completedAt: '2026-07-08T12:00:00.000Z',
    elapsedSeconds: overrides.elapsedSeconds ?? 500,
    cityLights: overrides.cityLights ?? 100,
    servedContracts: overrides.servedContracts ?? 4,
    powerEfficiency: overrides.powerEfficiency ?? 0.8,
    heatPeak: overrides.heatPeak ?? 55,
    mistakes: overrides.mistakes ?? 0,
    score,
    grade: overrides.grade ?? (score >= 900 ? 'S' : 'A'),
    shareLine: `Rock to Rack Crisis Run: ${score} points.`
  };
}
