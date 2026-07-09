import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../state/gameState';
import { gameStore } from '../state/gameStore';
import { playUiCue, resetAudioForTests } from './soundDesign';

afterEach(() => {
  resetAudioForTests();
  vi.unstubAllGlobals();
  gameStore.replaceState(createInitialGameState());
});

describe('sound design cues', () => {
  it('does not create audio when muted', () => {
    const calls: string[] = [];
    vi.stubGlobal('window', {
      AudioContext: fakeAudioContext(calls)
    });
    gameStore.replaceState({
      ...createInitialGameState(),
      preferences: {
        ...createInitialGameState().preferences,
        muted: true
      }
    });

    playUiCue('navigate');

    expect(calls).toEqual([]);
  });

  it('plays a short cue when unmuted', () => {
    const calls: string[] = [];
    vi.stubGlobal('window', {
      AudioContext: fakeAudioContext(calls)
    });
    gameStore.replaceState({
      ...createInitialGameState(),
      preferences: {
        ...createInitialGameState().preferences,
        muted: false
      }
    });

    playUiCue('guide');

    expect(calls).toContain('createOscillator');
    expect(calls).toContain('start');
    expect(calls).toContain('stop');
  });
});

function fakeAudioContext(calls: string[]) {
  return class FakeAudioContext {
    currentTime = 1;
    destination = {};

    createOscillator() {
      calls.push('createOscillator');
      return {
        frequency: {
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined
        },
        type: 'sine',
        connect: () => undefined,
        start: () => calls.push('start'),
        stop: () => calls.push('stop')
      };
    }

    createGain() {
      calls.push('createGain');
      return {
        gain: {
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined
        },
        connect: () => undefined
      };
    }
  };
}
