import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const audioDir = join(root, 'public', 'audio');
const sampleRate = 22_050;

const cues = {
  navigate: [{ startHz: 330, endHz: 440, duration: 0.08, gain: 0.28, type: 'square' }],
  guide: [{ startHz: 520, endHz: 660, duration: 0.07, gain: 0.25, type: 'square' }],
  fact: [{ startHz: 440, endHz: 880, duration: 0.1, gain: 0.25, type: 'triangle' }],
  success: [
    { startHz: 660, endHz: 880, duration: 0.09, gain: 0.28, type: 'triangle' },
    { startHz: 880, endHz: 1175, duration: 0.12, gain: 0.24, delay: 0.08, type: 'triangle' }
  ],
  place: [{ startHz: 180, endHz: 260, duration: 0.06, gain: 0.3, type: 'square' }],
  ore: [
    { startHz: 96, endHz: 132, duration: 0.09, gain: 0.34, type: 'square' },
    { startHz: 148, endHz: 116, duration: 0.07, gain: 0.24, delay: 0.05, type: 'sawtooth' }
  ],
  refine: [
    { startHz: 220, endHz: 330, duration: 0.11, gain: 0.28, type: 'triangle' },
    { startHz: 330, endHz: 495, duration: 0.11, gain: 0.22, delay: 0.08, type: 'triangle' }
  ],
  crystal: [
    { startHz: 392, endHz: 523, duration: 0.16, gain: 0.24, type: 'sine' },
    { startHz: 523, endHz: 659, duration: 0.18, gain: 0.2, delay: 0.12, type: 'sine' }
  ],
  fab: [
    { startHz: 740, endHz: 622, duration: 0.05, gain: 0.22, type: 'square' },
    { startHz: 880, endHz: 784, duration: 0.05, gain: 0.2, delay: 0.06, type: 'square' },
    { startHz: 988, endHz: 880, duration: 0.05, gain: 0.18, delay: 0.12, type: 'square' }
  ],
  package: [
    { startHz: 260, endHz: 390, duration: 0.07, gain: 0.28, type: 'triangle' },
    { startHz: 390, endHz: 260, duration: 0.07, gain: 0.22, delay: 0.07, type: 'triangle' }
  ],
  rack: [
    { startHz: 146, endHz: 220, duration: 0.16, gain: 0.3, type: 'sawtooth' },
    { startHz: 440, endHz: 660, duration: 0.12, gain: 0.18, delay: 0.1, type: 'triangle' }
  ],
  victory: [
    { startHz: 392, endHz: 523, duration: 0.13, gain: 0.32, type: 'triangle' },
    { startHz: 523, endHz: 659, duration: 0.13, gain: 0.28, delay: 0.1, type: 'triangle' },
    { startHz: 659, endHz: 1046, duration: 0.2, gain: 0.24, delay: 0.2, type: 'sine' }
  ],
  warning: [
    { startHz: 196, endHz: 164, duration: 0.12, gain: 0.32, type: 'sawtooth' },
    { startHz: 196, endHz: 164, duration: 0.12, gain: 0.28, delay: 0.16, type: 'sawtooth' }
  ]
};

mkdirSync(audioDir, { recursive: true });

for (const [cue, shapes] of Object.entries(cues)) {
  writeFileSync(join(audioDir, `${cue}.wav`), wav(renderCue(shapes)));
}

function renderCue(shapes) {
  const duration = Math.max(...shapes.map((shape) => (shape.delay ?? 0) + shape.duration)) + 0.04;
  const samples = new Float32Array(Math.ceil(duration * sampleRate));

  for (const shape of shapes) {
    const startIndex = Math.floor((shape.delay ?? 0) * sampleRate);
    const length = Math.max(1, Math.floor(shape.duration * sampleRate));
    let phase = 0;

    for (let index = 0; index < length; index += 1) {
      const t = index / Math.max(1, length - 1);
      const hz = shape.startHz * ((shape.endHz / shape.startHz) ** t);
      phase += hz / sampleRate;
      const envelope = Math.sin(Math.PI * t) ** 0.55;
      samples[startIndex + index] += oscillator(phase % 1, shape.type) * shape.gain * envelope;
    }
  }

  return samples.map((sample) => Math.max(-0.96, Math.min(0.96, sample)));
}

function oscillator(phase, type = 'square') {
  if (type === 'sine') {
    return Math.sin(phase * Math.PI * 2);
  }
  if (type === 'triangle') {
    return 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
  }
  if (type === 'sawtooth') {
    return phase * 2 - 1;
  }
  return phase < 0.5 ? 1 : -1;
}

function wav(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);

  samples.forEach((sample, index) => {
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  });

  return buffer;
}
