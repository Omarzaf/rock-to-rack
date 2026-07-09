import { hydrateGameState, serializeGameState } from './gameState';
import type { GameState } from './types';

const SAVE_KEY = 'rock-to-rack.save';

export function loadSavedState(): GameState {
  return hydrateGameState(getLocalStorage()?.getItem(SAVE_KEY) ?? null);
}

export function saveState(state: GameState): void {
  getLocalStorage()?.setItem(SAVE_KEY, serializeGameState(state));
}

export function clearSavedState(): void {
  getLocalStorage()?.removeItem(SAVE_KEY);
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
