import { describe, expect, it, vi } from 'vitest';
import { openFeedbackLink } from './feedbackLink';

describe('openFeedbackLink', () => {
  it('opens the configured feedback href', () => {
    const assign = vi.fn();
    openFeedbackLink('mailto:test@example.com?subject=Rock%20to%20Rack%20feedback', { assign } as unknown as Location);

    expect(assign).toHaveBeenCalledWith('mailto:test@example.com?subject=Rock%20to%20Rack%20feedback');
  });

  it('does nothing when no feedback href is configured', () => {
    const assign = vi.fn();
    openFeedbackLink('', { assign } as unknown as Location);

    expect(assign).not.toHaveBeenCalled();
  });
});
