import { createInitialGameState } from '../state/gameState';
import type { GameState } from '../state/types';
import { SceneKey } from '../scenes/sceneKeys';

const CHAPTER_BY_SCENE: Partial<Record<SceneKey, number>> = {
  [SceneKey.Ch1Mine]: 1,
  [SceneKey.Ch2Refinery]: 2,
  [SceneKey.Ch3Crystal]: 3,
  [SceneKey.Ch4Fab]: 4,
  [SceneKey.Ch5Package]: 5,
  [SceneKey.Ch6Datacenter]: 6
};

const CHAPTER_SIX_CHIP_IDS = ['cpu', 'gpu', 'dram', 'pmic'] as const;

export function createFixtureStateForScene(sceneKey: SceneKey): GameState {
  const chapter = CHAPTER_BY_SCENE[sceneKey];
  const state = createInitialGameState();

  if (!chapter) {
    return state;
  }

  if (chapter === 1) {
    return {
      ...state,
      progress: {
        activeScene: sceneKey,
        currentChapter: 1,
        unlockedChapters: [1]
      }
    };
  }

  return {
    ...state,
    progress: {
      activeScene: sceneKey,
      currentChapter: chapter,
      unlockedChapters: Array.from({ length: chapter }, (_, index) => index + 1)
    },
    chapters: {
      ...state.chapters,
      ch1: {
        ...state.chapters.ch1,
        firstMined: chapter >= 2 ? ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'] : state.chapters.ch1.firstMined,
        completed: chapter >= 2,
        completedAtSeconds: chapter >= 2 ? 660 : null,
        quizCorrect: chapter >= 2 ? true : null
      },
      ch2: {
        ...state.chapters.ch2,
        completed: chapter >= 3,
        completedAtSeconds: chapter >= 3 ? 720 : null,
        quizCorrect: chapter >= 3 ? true : null,
        siliconPurityNines: chapter >= 3 ? 9 : state.chapters.ch2.siliconPurityNines,
        refinedOutputs: chapter >= 3 ? { copper: 6, lithium: 4, cobalt: 3 } : state.chapters.ch2.refinedOutputs,
        slag: chapter >= 3 ? 4 : state.chapters.ch2.slag,
        storedSlag: chapter >= 3 ? 6 : state.chapters.ch2.storedSlag,
        firstFacts: chapter >= 3 ? ['ch2-nine-nines', 'ch2-energy-hungry', 'ch2-recycling-ewaste'] : state.chapters.ch2.firstFacts
      },
      ch3: {
        ...state.chapters.ch3,
        completed: chapter >= 4,
        completedAtSeconds: chapter >= 4 ? 780 : null,
        quizCorrect: chapter >= 4 ? true : null,
        ingotQuality: chapter >= 4 ? 80 : state.chapters.ch3.ingotQuality,
        waferQuality: chapter >= 4 ? 80 : state.chapters.ch3.waferQuality,
        wafersProduced: chapter >= 4 ? 8 : state.chapters.ch3.wafersProduced,
        retryUsed: chapter >= 4 ? false : state.chapters.ch3.retryUsed,
        firstFacts: chapter >= 4 ? ['ch3-czochralski', 'ch3-round-wafers', 'ch3-diamond-wire'] : state.chapters.ch3.firstFacts
      },
      ch4: {
        ...state.chapters.ch4,
        completed: chapter >= 5,
        completedAtSeconds: chapter >= 5 ? 900 : null,
        quizCorrect: chapter >= 5 ? true : null,
        wafersProcessed: chapter >= 5 ? 3 : state.chapters.ch4.wafersProcessed,
        averageYield: chapter >= 5 ? 76 : state.chapters.ch4.averageYield,
        bestYield: chapter >= 5 ? 84 : state.chapters.ch4.bestYield,
        chipsProduced: chapter >= 5 ? 109 : state.chapters.ch4.chipsProduced,
        nodeYields: chapter >= 5
          ? [
            { node: '90nm', yieldPercent: 84, goodDies: 40, defectiveDies: 8 },
            { node: '28nm', yieldPercent: 77, goodDies: 37, defectiveDies: 11 },
            { node: '7nm', yieldPercent: 66, goodDies: 32, defectiveDies: 16 }
          ]
          : state.chapters.ch4.nodeYields,
        firstFacts: chapter >= 5 ? ['ch4-bunny-suits', 'ch4-dust-speck', 'ch4-euv-asml'] : state.chapters.ch4.firstFacts
      },
      ch5: {
        ...state.chapters.ch5,
        completed: chapter >= 6,
        completedAtSeconds: chapter >= 6 ? 1020 : null,
        quizCorrect: chapter >= 6 ? true : null,
        sortedDies: chapter >= 6 ? 18 : state.chapters.ch5.sortedDies,
        bins: chapter >= 6
          ? { perfect: 2, good: 4, salvage: 2 }
          : state.chapters.ch5.bins,
        selectedChipIds: chapter >= 6 ? [...CHAPTER_SIX_CHIP_IDS] : state.chapters.ch5.selectedChipIds,
        builtChips: chapter >= 6
          ? [
            { chipId: 'cpu', builtAtSeconds: 610 },
            { chipId: 'gpu', builtAtSeconds: 640 },
            { chipId: 'dram', builtAtSeconds: 670 },
            { chipId: 'pmic', builtAtSeconds: 700 }
          ]
          : state.chapters.ch5.builtChips,
        perfect7nmDies: chapter >= 6 ? 1 : state.chapters.ch5.perfect7nmDies,
        triggeredEvents: chapter >= 6 ? ['probeDrift', 'substrateShortage'] : state.chapters.ch5.triggeredEvents,
        firstFacts: chapter >= 6 ? ['ch5-packaging', 'ch5-binning', 'ch5-chip-roster'] : state.chapters.ch5.firstFacts
      },
      ch6: {
        ...state.chapters.ch6,
        availableChipIds: chapter >= 6 ? [...CHAPTER_SIX_CHIP_IDS] : state.chapters.ch6.availableChipIds
      }
    },
    resources: {
      ...state.resources,
      minerals: {
        quartz: 25 * chapter,
        copper: 12 * chapter,
        lithium: 8 * chapter,
        cobalt: 6 * chapter,
        rareEarths: 4 * chapter
      },
      wafers: chapter >= 4 ? 8 : 0,
      chips: chapter >= 5 ? 109 : 0,
      credits: 250 + chapter * 150
    }
  };
}
