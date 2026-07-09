import { describe, expect, it, vi } from 'vitest';
import { createAnalyticsReporter, normalizeAnalyticsEvent } from './analytics';

describe('analytics', () => {
  it('adds required metadata without PII fields', () => {
    const normalized = normalizeAnalyticsEvent({
      name: 'quiz_answer',
      payload: {
        questionId: 'ch1-field-check',
        correct: true,
        email: 'not-allowed@example.com'
      }
    });

    expect(normalized.name).toBe('quiz_answer');
    expect(normalized.payload.questionId).toBe('ch1-field-check');
    expect(normalized.payload.correct).toBe(true);
    expect(normalized.payload.email).toBeUndefined();
    expect(typeof normalized.sentAt).toBe('string');
  });

  it('uses the configured transport and does not throw on failure', async () => {
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    const reporter = createAnalyticsReporter({ send });

    await expect(reporter.track({ name: 'chapter_start', payload: { chapter: 1 } })).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('preserves crisis run quality metrics without allowing arbitrary fields', () => {
    const normalized = normalizeAnalyticsEvent({
      name: 'crisis_run_complete',
      payload: {
        score: 910,
        grade: 'S',
        elapsedSeconds: 510,
        cityLights: 100,
        servedContracts: 4,
        email: 'not-allowed@example.com'
      }
    });

    expect(normalized.payload).toMatchObject({
      score: 910,
      grade: 'S',
      elapsedSeconds: 510,
      cityLights: 100,
      servedContracts: 4
    });
    expect(normalized.payload.email).toBeUndefined();
  });
});
