import { gameStore } from '../state/gameStore';

export type UiSoundCue =
  | 'navigate'
  | 'guide'
  | 'fact'
  | 'success'
  | 'place'
  | 'ore'
  | 'refine'
  | 'crystal'
  | 'fab'
  | 'package'
  | 'rack'
  | 'victory'
  | 'warning';

interface ToneShape {
  startHz: number;
  endHz: number;
  duration: number;
  gain: number;
  delay?: number;
  type?: OscillatorType;
}

const CUES: Record<UiSoundCue, ToneShape[]> = {
  navigate: [{ startHz: 330, endHz: 440, duration: 0.08, gain: 0.035 }],
  guide: [{ startHz: 520, endHz: 660, duration: 0.07, gain: 0.032 }],
  fact: [{ startHz: 440, endHz: 880, duration: 0.1, gain: 0.03, type: 'triangle' }],
  success: [
    { startHz: 660, endHz: 880, duration: 0.09, gain: 0.035, type: 'triangle' },
    { startHz: 880, endHz: 1175, duration: 0.12, gain: 0.032, delay: 0.08, type: 'triangle' }
  ],
  place: [{ startHz: 180, endHz: 260, duration: 0.06, gain: 0.035 }],
  ore: [
    { startHz: 96, endHz: 132, duration: 0.09, gain: 0.05, type: 'square' },
    { startHz: 148, endHz: 116, duration: 0.07, gain: 0.035, delay: 0.05, type: 'sawtooth' }
  ],
  refine: [
    { startHz: 220, endHz: 330, duration: 0.11, gain: 0.035, type: 'triangle' },
    { startHz: 330, endHz: 495, duration: 0.11, gain: 0.028, delay: 0.08, type: 'triangle' }
  ],
  crystal: [
    { startHz: 392, endHz: 523, duration: 0.16, gain: 0.03, type: 'sine' },
    { startHz: 523, endHz: 659, duration: 0.18, gain: 0.026, delay: 0.12, type: 'sine' }
  ],
  fab: [
    { startHz: 740, endHz: 622, duration: 0.05, gain: 0.028, type: 'square' },
    { startHz: 880, endHz: 784, duration: 0.05, gain: 0.026, delay: 0.06, type: 'square' },
    { startHz: 988, endHz: 880, duration: 0.05, gain: 0.024, delay: 0.12, type: 'square' }
  ],
  package: [
    { startHz: 260, endHz: 390, duration: 0.07, gain: 0.034, type: 'triangle' },
    { startHz: 390, endHz: 260, duration: 0.07, gain: 0.028, delay: 0.07, type: 'triangle' }
  ],
  rack: [
    { startHz: 146, endHz: 220, duration: 0.16, gain: 0.038, type: 'sawtooth' },
    { startHz: 440, endHz: 660, duration: 0.12, gain: 0.024, delay: 0.1, type: 'triangle' }
  ],
  victory: [
    { startHz: 392, endHz: 523, duration: 0.13, gain: 0.04, type: 'triangle' },
    { startHz: 523, endHz: 659, duration: 0.13, gain: 0.036, delay: 0.1, type: 'triangle' },
    { startHz: 659, endHz: 1046, duration: 0.2, gain: 0.034, delay: 0.2, type: 'sine' }
  ],
  warning: [
    { startHz: 196, endHz: 164, duration: 0.12, gain: 0.04, type: 'sawtooth' },
    { startHz: 196, endHz: 164, duration: 0.12, gain: 0.034, delay: 0.16, type: 'sawtooth' }
  ]
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
  const shapes = CUES[cue];
  for (const shape of shapes) {
    playTone(context, shape);
  }
}

function playTone(context: AudioContext, shape: ToneShape): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startAt = context.currentTime + (shape.delay ?? 0);
  const endAt = startAt + shape.duration;

  oscillator.type = shape.type ?? 'square';
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
