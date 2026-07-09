import { gameStore } from '../state/gameStore';

export type UiSoundCue = 'navigate' | 'guide' | 'fact' | 'success' | 'place';

interface ToneShape {
  startHz: number;
  endHz: number;
  duration: number;
  gain: number;
}

const CUES: Record<UiSoundCue, ToneShape> = {
  navigate: { startHz: 330, endHz: 440, duration: 0.08, gain: 0.035 },
  guide: { startHz: 520, endHz: 660, duration: 0.07, gain: 0.032 },
  fact: { startHz: 440, endHz: 880, duration: 0.1, gain: 0.03 },
  success: { startHz: 660, endHz: 990, duration: 0.14, gain: 0.04 },
  place: { startHz: 180, endHz: 260, duration: 0.06, gain: 0.035 }
};

let audioContext: AudioContext | undefined;

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export function playUiCue(cue: UiSoundCue): void {
  if (gameStore.getState().preferences.muted || typeof window === 'undefined') {
    return;
  }

  const audioWindow = window as AudioWindow;
  const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) {
    return;
  }

  const context = audioContext ?? new AudioContextConstructor();
  audioContext = context;
  const shape = CUES[cue];
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startAt = context.currentTime;
  const endAt = startAt + shape.duration;

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(shape.startHz, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(shape.endHz, endAt);
  gain.gain.setValueAtTime(shape.gain, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, endAt);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(endAt);
}

export function resetAudioForTests(): void {
  audioContext = undefined;
}
