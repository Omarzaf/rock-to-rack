import Phaser from 'phaser';
import { createFixtureStateForScene } from '../fixtures/chapterFixtures';
import { gameStore } from '../state/gameStore';
import { loadSavedState } from '../state/storage';
import { clearSavedState } from '../state/storage';
import { stateForBootRequest } from './bootState';
import { isChapterSceneKey, SceneKey } from './sceneKeys';
import { startScene } from './sceneLoader';
import { sceneKeyFromHash } from './sceneRouting';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Boot);
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.has('reset')) {
      clearSavedState();
    }

    const requestedScene = sceneKeyFromHash(window.location.hash);
    gameStore.replaceState(stateForBootRequest({
      reset: params.has('reset'),
      requestedScene,
      loadSaved: loadSavedState,
      createFixture: createFixtureStateForScene
    }));

    gameStore.startAutosave();

    const savedScene = gameStore.getState().progress.activeScene;
    const nextScene = requestedScene !== SceneKey.Menu
      ? requestedScene
      : isChapterSceneKey(savedScene)
        ? savedScene
        : SceneKey.Menu;

    void startScene(this, nextScene);
  }
}
