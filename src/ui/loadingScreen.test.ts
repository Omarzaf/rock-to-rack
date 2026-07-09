import { describe, expect, it, vi } from 'vitest';
import { createLoadingScreenController } from './loadingScreen';

describe('loading screen controller', () => {
  it('rotates facts and hides the shell', () => {
    vi.useFakeTimers();
    const shell = documentLikeShell('First fact');
    const controller = createLoadingScreenController(shell, ['First fact', 'Second fact'], 1000);

    expect(shell.fact.textContent).toBe('First fact');
    vi.advanceTimersByTime(1000);
    expect(shell.fact.textContent).toBe('Second fact');

    controller.hide();
    expect(shell.root.hidden).toBe(true);
    expect(shell.root.classList.add).toHaveBeenCalledWith('is-hidden');
    controller.cleanup();
    vi.useRealTimers();
  });
});

function documentLikeShell(initialText: string) {
  return {
    root: {
      hidden: false,
      classList: {
        add: vi.fn()
      }
    },
    fact: {
      textContent: initialText
    }
  };
}
