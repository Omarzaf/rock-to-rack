import './styles.css';
import { analyticsEndpointFromLocation, createAnalyticsReporter, createBrowserAnalyticsTransport } from './analytics/analytics';
import balanceJson from './content/balance.json';
import { createRockToRackGame } from './game/createGame';
import { registerServiceWorker } from './ship/registerServiceWorker';
import { LOADING_FACTS } from './ship/siteMetadata';
import { calculatePaceStatus, type ChapterId, type ChapterPaceSnapshot, type PaceTargetSeconds } from './sim/pace';
import { gameStore } from './state/gameStore';
import type { ResourceState } from './state/types';
import {
  mountDebugOverlay,
  type DebugOverlayState,
  type DebugResourceRates,
  type MountedDebugOverlay
} from './ui/debugOverlay';
import { createLoadingScreenController, loadingScreenFromDocument } from './ui/loadingScreen';

interface DebugBalance {
  pace: {
    catchUp: {
      behindThreshold: number;
      passiveMultiplier: number;
    };
  };
  ch1: { pacingTargetSeconds: PaceTargetSeconds };
  ch2: { pacingTargetSeconds: PaceTargetSeconds };
  ch3: { pacingTargetSeconds: PaceTargetSeconds };
  ch4: { pacingTargetSeconds: PaceTargetSeconds };
  ch5: { pacingTargetSeconds: PaceTargetSeconds };
  ch6: { pacingTargetSeconds: PaceTargetSeconds };
}

const BALANCE = balanceJson as DebugBalance;

registerServiceWorker(import.meta.env.PROD, navigator);

const reporter = createAnalyticsReporter(createBrowserAnalyticsTransport(analyticsEndpointFromLocation(window.location)));
const offAnalytics = gameStore.events.on('analytics:event', (event) => {
  void reporter.track(event);
});

const offTextSize = gameStore.events.on('state:changed', (state) => {
  document.body.classList.toggle('text-large', state.preferences.textSize === 'large');
});
const loadingScreen = loadingScreenFromDocument(document);
const loadingController = loadingScreen
  ? createLoadingScreenController(loadingScreen, LOADING_FACTS)
  : undefined;
const game = createRockToRackGame('game-root', {
  onReady: () => loadingController?.hide()
});
const debugEnabled = new URLSearchParams(window.location.search).get('debug') === '1';
let debugOverlay: MountedDebugOverlay | undefined;
let latestDebugState = initialDebugState();
let lastRateSample: { chapter: ChapterId; elapsedSeconds: number; resources: ResourceState } | undefined;

const offDebugProgress = debugEnabled
  ? gameStore.events.on('debug:chapter-progress', (snapshot) => {
    latestDebugState = {
      pace: calculatePaceStatus(snapshot, paceSettings()),
      resources: gameStore.getState().resources,
      rates: currentDebugRates(snapshot)
    };
    syncDebugOverlay();
  })
  : undefined;

const offDebugState = debugEnabled
  ? gameStore.events.on('state:changed', (state) => {
    latestDebugState = {
      ...latestDebugState,
      resources: state.resources
    };
    syncDebugOverlay();
  })
  : undefined;

if (debugEnabled) {
  window.setTimeout(() => syncDebugOverlay(), 0);
}

window.addEventListener('beforeunload', () => {
  offAnalytics();
  offTextSize();
  offDebugProgress?.();
  offDebugState?.();
  debugOverlay?.cleanup();
  loadingController?.cleanup();
  reporter.dispose();
  game.destroy(false);
});

function syncDebugOverlay(): void {
  const root = document.getElementById('ui-root');
  if (!root) {
    return;
  }

  latestDebugState = currentStoreBackedDebugState(latestDebugState);

  if (!root.querySelector('.debug-overlay')) {
    debugOverlay?.cleanup();
    debugOverlay = mountDebugOverlay(root, {
      state: latestDebugState,
      onSceneJump: (chapter) => {
        window.location.hash = `ch${chapter}`;
        window.location.reload();
      },
      onGrantResources: (kind) => gameStore.grantDebugResources(kind)
    });
    return;
  }

  debugOverlay?.update(latestDebugState);
}

function currentStoreBackedDebugState(state: DebugOverlayState): DebugOverlayState {
  const currentState = gameStore.getState();
  const currentChapter = clampChapter(currentState.progress.currentChapter);
  if (state.pace.chapter !== currentChapter) {
    return {
      pace: calculatePaceStatus({
        chapter: currentChapter,
        elapsedSeconds: 0,
        progressRatio: 0,
        targetSeconds: chapterTargetSeconds(currentChapter)
      }, paceSettings()),
      resources: currentState.resources,
      rates: zeroRates()
    };
  }

  return {
    ...state,
    resources: currentState.resources
  };
}

function initialDebugState(): DebugOverlayState {
  const state = gameStore.getState();
  const chapter = clampChapter(state.progress.currentChapter);
  return {
    pace: calculatePaceStatus({
      chapter,
      elapsedSeconds: 0,
      progressRatio: 0,
      targetSeconds: chapterTargetSeconds(chapter)
    }, paceSettings()),
    resources: state.resources,
    rates: zeroRates()
  };
}

function currentDebugRates(snapshot: ChapterPaceSnapshot): DebugResourceRates {
  const resources = gameStore.getState().resources;
  if (!lastRateSample || lastRateSample.chapter !== snapshot.chapter || snapshot.elapsedSeconds <= lastRateSample.elapsedSeconds) {
    lastRateSample = {
      chapter: snapshot.chapter,
      elapsedSeconds: snapshot.elapsedSeconds,
      resources
    };
    return zeroRates();
  }

  const elapsedMinutes = (snapshot.elapsedSeconds - lastRateSample.elapsedSeconds) / 60;
  const previous = lastRateSample.resources;
  lastRateSample = {
    chapter: snapshot.chapter,
    elapsedSeconds: snapshot.elapsedSeconds,
    resources
  };

  return {
    creditsPerMinute: rate(resources.credits - previous.credits, elapsedMinutes),
    energyPerMinute: rate(resources.energy - previous.energy, elapsedMinutes),
    waterPerMinute: rate(resources.water - previous.water, elapsedMinutes),
    chipsPerMinute: rate(resources.chips - previous.chips, elapsedMinutes)
  };
}

function zeroRates(): DebugResourceRates {
  return {
    creditsPerMinute: 0,
    energyPerMinute: 0,
    waterPerMinute: 0,
    chipsPerMinute: 0
  };
}

function rate(delta: number, elapsedMinutes: number): number {
  if (elapsedMinutes <= 0) {
    return 0;
  }

  return Math.round((delta / elapsedMinutes) * 10) / 10;
}

function paceSettings() {
  return {
    behindThreshold: BALANCE.pace.catchUp.behindThreshold,
    catchUpMultiplier: BALANCE.pace.catchUp.passiveMultiplier
  };
}

function chapterTargetSeconds(chapter: ChapterId): PaceTargetSeconds {
  return BALANCE[`ch${chapter}`].pacingTargetSeconds;
}

function clampChapter(chapter: number): ChapterId {
  return Math.min(Math.max(chapter, 1), 6) as ChapterId;
}
