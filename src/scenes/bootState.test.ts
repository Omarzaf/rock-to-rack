import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../state/gameState';
import { SceneKey } from './sceneKeys';
import { stateForBootRequest } from './bootState';

describe('stateForBootRequest', () => {
  it('uses saved state for chapter hashes unless reset is requested', () => {
    const saved = createInitialGameState();
    const state = stateForBootRequest({
      reset: false,
      requestedScene: SceneKey.Ch1Mine,
      loadSaved: () => ({
        ...saved,
        resources: {
          ...saved.resources,
          credits: 777
        }
      }),
      createFixture: () => ({
        ...saved,
        resources: {
          ...saved.resources,
          credits: 111
        }
      })
    });

    expect(state.resources.credits).toBe(777);
  });

  it('uses fixtures for reset chapter hashes', () => {
    const saved = createInitialGameState();
    const state = stateForBootRequest({
      reset: true,
      requestedScene: SceneKey.Ch4Fab,
      loadSaved: () => ({
        ...saved,
        resources: {
          ...saved.resources,
          credits: 777
        }
      }),
      createFixture: () => ({
        ...saved,
        resources: {
          ...saved.resources,
          credits: 111
        }
      })
    });

    expect(state.resources.credits).toBe(111);
  });
});
