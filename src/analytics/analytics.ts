import type { AnalyticsEvent } from '../state/eventBus';

type AnalyticsPrimitive = string | number | boolean;

const ALLOWED_PAYLOAD_KEYS = new Set([
  'chapter',
  'sceneKey',
  'durationSeconds',
  'questionId',
  'answerId',
  'correct',
  'factCardId',
  'eventId',
  'choiceId',
  'completed',
  'unlockedCount',
  'totalCount',
  'score',
  'grade',
  'elapsedSeconds',
  'cityLights',
  'servedContracts'
]);

export interface NormalizedAnalyticsEvent {
  name: string;
  payload: Record<string, AnalyticsPrimitive>;
  sentAt: string;
}

export interface AnalyticsTransport {
  send(event: NormalizedAnalyticsEvent): Promise<void>;
}

export interface AnalyticsReporter {
  track(event: AnalyticsEvent): Promise<void>;
  dispose(): void;
}

export function normalizeAnalyticsEvent(event: AnalyticsEvent): NormalizedAnalyticsEvent {
  return {
    name: event.name,
    payload: Object.fromEntries(
      Object.entries(event.payload).filter(([key, value]) => ALLOWED_PAYLOAD_KEYS.has(key) && isAnalyticsPrimitive(value))
    ),
    sentAt: new Date().toISOString()
  };
}

export function createAnalyticsReporter(transport: AnalyticsTransport): AnalyticsReporter {
  return {
    async track(event) {
      try {
        await transport.send(normalizeAnalyticsEvent(event));
      } catch {
        // Analytics must never break gameplay.
      }
    },
    dispose() {}
  };
}

export function createBrowserAnalyticsTransport(endpoint: string | null): AnalyticsTransport {
  return {
    async send(event) {
      if (!endpoint) {
        appendLocalDebugEvent(event);
        return;
      }

      await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true
      });
    }
  };
}

export function analyticsEndpointFromLocation(location: Location): string | null {
  const params = new URLSearchParams(location.search);
  return params.get('analyticsEndpoint') || import.meta.env.VITE_ANALYTICS_ENDPOINT || null;
}

function appendLocalDebugEvent(event: NormalizedAnalyticsEvent): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const key = 'rock-to-rack.analytics.debug';
    const current = JSON.parse(window.localStorage.getItem(key) ?? '[]') as NormalizedAnalyticsEvent[];
    window.localStorage.setItem(key, JSON.stringify([...current.slice(-49), event]));
  } catch {
    // Local debug analytics is best-effort only.
  }
}

function isAnalyticsPrimitive(value: unknown): value is AnalyticsPrimitive {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
