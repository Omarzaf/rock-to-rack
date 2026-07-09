import type { GameState } from '../state/types';
import { SceneKey } from './sceneKeys';

export interface BootStateRequest {
  reset: boolean;
  requestedScene: SceneKey;
  loadSaved: () => GameState;
  createFixture: (sceneKey: SceneKey) => GameState;
}

export function stateForBootRequest(request: BootStateRequest): GameState {
  if (request.reset && request.requestedScene !== SceneKey.Menu) {
    return request.createFixture(request.requestedScene);
  }

  return request.loadSaved();
}
