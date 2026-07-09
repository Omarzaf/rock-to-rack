import type { GameState } from './types';
import type { ChapterPaceSnapshot } from '../sim/pace';

export interface AnalyticsEvent {
  name: string;
  payload: Record<string, string | number | boolean>;
}

export interface GameEventMap {
  'state:changed': GameState;
  'analytics:event': AnalyticsEvent;
  'debug:chapter-progress': ChapterPaceSnapshot;
}

type Listener<K extends keyof GameEventMap> = (payload: GameEventMap[K]) => void;
type StoredListener = (payload: GameEventMap[keyof GameEventMap]) => void;

export class EventBus {
  private readonly listeners = new Map<keyof GameEventMap, Set<StoredListener>>();

  on<K extends keyof GameEventMap>(event: K, listener: Listener<K>): () => void {
    const storedListener = listener as StoredListener;
    const eventListeners = this.listeners.get(event) ?? new Set<StoredListener>();
    eventListeners.add(storedListener);
    this.listeners.set(event, eventListeners);

    return () => {
      eventListeners.delete(storedListener);
    };
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}
