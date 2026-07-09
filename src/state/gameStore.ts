import { EventBus } from './eventBus';
import balance from '../content/balance.json';
import { createInitialGameState } from './gameState';
import { loadSavedState, saveState } from './storage';
import { addResources, type ResourceCaps, type ResourceDelta } from '../sim/economy';
import { appendCrisisRunHistory, bestCrisisRun } from '../sim/crisisRun';
import { tickMining, type MiningBalance } from '../sim/mining';
import type { DebugGrantKind } from '../ui/debugOverlay';
import type { CrisisRunResult, GameState, TextMode, TextSize } from './types';

type StateUpdater = (state: GameState) => GameState;
type StoreBalance = {
  resources: { caps: ResourceCaps };
  ch1: MiningBalance;
};

const BALANCE = balance as StoreBalance;
const CHAPTER_ONE_SCENE = 'Ch1MineScene';

export class GameStore {
  readonly events = new EventBus();

  private state = createInitialGameState();
  private autosaveId: number | undefined;
  private operationsId: number | undefined;
  private lastChapterStart: { sceneKey: string; chapter: number; emittedAtMs: number } | undefined;

  getState(): GameState {
    return this.state;
  }

  loadFromStorage(): void {
    this.replaceState(loadSavedState());
  }

  replaceState(state: GameState, options: { emitCompletionAnalytics?: boolean } = {}): void {
    const previousState = this.state;
    this.state = state;
    this.events.emit('state:changed', this.state);
    if (options.emitCompletionAnalytics) {
      this.emitCompletionAnalytics(previousState, this.state);
    }
  }

  update(updater: StateUpdater): void {
    this.replaceState(updater(this.state), { emitCompletionAnalytics: true });
  }

  setTextMode(textMode: TextMode): void {
    this.update((state) => ({
      ...state,
      preferences: {
        ...state.preferences,
        textMode
      }
    }));
    this.saveNow();
  }

  setMuted(muted: boolean): void {
    this.update((state) => ({
      ...state,
      preferences: {
        ...state.preferences,
        muted
      }
    }));
    this.saveNow();
  }

  setTextSize(textSize: TextSize): void {
    this.update((state) => ({
      ...state,
      preferences: {
        ...state.preferences,
        textSize
      }
    }));
    this.saveNow();
  }

  grantDebugResources(kind: DebugGrantKind): void {
    const caps = (balance as { resources: { caps: ResourceCaps } }).resources.caps;
    this.update((state) => ({
      ...state,
      resources: addResources(state.resources, debugGrantDelta(kind), caps)
    }));
    this.saveNow();
  }

  enterScene(sceneKey: string, chapter?: number): void {
    this.update((state) => ({
      ...state,
      progress: {
        activeScene: sceneKey,
        currentChapter: chapter ?? state.progress.currentChapter,
        unlockedChapters: chapter ? unlockChapter(state.progress.unlockedChapters, chapter) : state.progress.unlockedChapters
      }
    }));
    if (chapter && !this.isDuplicateChapterStart(sceneKey, chapter)) {
      this.events.emit('analytics:event', {
        name: 'chapter_start',
        payload: { chapter, sceneKey }
      });
      this.lastChapterStart = { sceneKey, chapter, emittedAtMs: Date.now() };
    }
    this.saveNow();
  }

  recordCrisisRunResult(result: CrisisRunResult): void {
    this.update((state) => ({
      ...state,
      meta: {
        crisisRuns: appendCrisisRunHistory(state.meta.crisisRuns, result),
        bestCrisisRun: bestCrisisRun(state.meta.bestCrisisRun, result),
        totalCrisisRuns: state.meta.totalCrisisRuns + 1
      }
    }));
    this.events.emit('analytics:event', {
      name: 'crisis_run_complete',
      payload: {
        score: result.score,
        grade: result.grade,
        elapsedSeconds: result.elapsedSeconds,
        cityLights: result.cityLights,
        servedContracts: result.servedContracts
      }
    });
    this.saveNow();
  }

  startAutosave(): void {
    if (typeof window === 'undefined' || this.autosaveId !== undefined) {
      return;
    }

    this.autosaveId = window.setInterval(() => this.saveNow(), 10_000);
    this.startBackgroundOperations();
  }

  startBackgroundOperations(): void {
    if (typeof window === 'undefined' || this.operationsId !== undefined) {
      return;
    }

    this.operationsId = window.setInterval(() => this.advanceBackgroundOperations(1_000), 1_000);
  }

  advanceBackgroundOperations(elapsedMs: number): void {
    const elapsedSeconds = elapsedMs / 1000;
    if (elapsedSeconds <= 0 || this.state.progress.activeScene === CHAPTER_ONE_SCENE) {
      return;
    }

    const chapter = this.state.chapters.ch1;
    if (chapter.completed || chapter.miners.length === 0) {
      return;
    }

    const result = tickMining(chapter, this.state.resources, elapsedSeconds, BALANCE.ch1, BALANCE.resources.caps);
    this.replaceState({
      ...this.state,
      resources: result.resources,
      chapters: {
        ...this.state.chapters,
        ch1: {
          ...chapter,
          deposits: result.chapter.deposits,
          miners: result.chapter.miners,
          firstMined: result.chapter.firstMined,
          elapsedSeconds: result.chapter.elapsedSeconds,
          triggeredEvents: result.chapter.triggeredEvents
        }
      }
    });
  }

  saveNow(): void {
    saveState(this.state);
  }

  private emitCompletionAnalytics(previousState: GameState, nextState: GameState): void {
    const completions = [
      { chapter: 1, before: previousState.chapters.ch1.completed, after: nextState.chapters.ch1.completed, durationSeconds: nextState.chapters.ch1.completedAtSeconds },
      { chapter: 2, before: previousState.chapters.ch2.completed, after: nextState.chapters.ch2.completed, durationSeconds: nextState.chapters.ch2.completedAtSeconds },
      { chapter: 3, before: previousState.chapters.ch3.completed, after: nextState.chapters.ch3.completed, durationSeconds: nextState.chapters.ch3.completedAtSeconds },
      { chapter: 4, before: previousState.chapters.ch4.completed, after: nextState.chapters.ch4.completed, durationSeconds: nextState.chapters.ch4.completedAtSeconds },
      { chapter: 5, before: previousState.chapters.ch5.completed, after: nextState.chapters.ch5.completed, durationSeconds: nextState.chapters.ch5.completedAtSeconds },
      { chapter: 6, before: previousState.chapters.ch6.completed, after: nextState.chapters.ch6.completed, durationSeconds: nextState.chapters.ch6.completedAtSeconds }
    ];

    for (const completion of completions) {
      if (!completion.before && completion.after) {
        this.events.emit('analytics:event', {
          name: 'chapter_end',
          payload: {
            chapter: completion.chapter,
            durationSeconds: completion.durationSeconds ?? 0,
            completed: true
          }
        });
      }
    }

    if (!previousState.chapters.ch6.completed && nextState.chapters.ch6.completed) {
      this.events.emit('analytics:event', {
        name: 'game_complete',
        payload: {
          chapter: 6,
          durationSeconds: nextState.chapters.ch6.completedAtSeconds ?? 0,
          completed: true
        }
      });
    }
  }

  private isDuplicateChapterStart(sceneKey: string, chapter: number): boolean {
    return this.lastChapterStart?.sceneKey === sceneKey
      && this.lastChapterStart.chapter === chapter
      && Date.now() - this.lastChapterStart.emittedAtMs < 1_000;
  }
}

export const gameStore = new GameStore();

function unlockChapter(unlockedChapters: number[], chapter: number): number[] {
  return [...new Set([...unlockedChapters, chapter])].sort((a, b) => a - b);
}

function debugGrantDelta(kind: DebugGrantKind): ResourceDelta {
  if (kind === 'credits') {
    return { credits: 200 };
  }

  if (kind === 'chips') {
    return { chips: 30, wafers: 4 };
  }

  return {
    minerals: {
      quartz: 10,
      copper: 8,
      lithium: 6,
      cobalt: 4,
      rareEarths: 4
    },
    energy: 20,
    water: 20
  };
}
