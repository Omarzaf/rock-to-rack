import { describe, expect, it } from 'vitest';
import { sceneKeyFromChapter, sceneKeyFromHash } from './sceneRouting';
import { SceneKey } from './sceneKeys';

describe('sceneKeyFromHash', () => {
  it('routes chapter hashes to their scene keys', () => {
    expect(sceneKeyFromHash('#ch1')).toBe(SceneKey.Ch1Mine);
    expect(sceneKeyFromHash('#ch3')).toBe(SceneKey.Ch3Crystal);
    expect(sceneKeyFromHash('#ch6')).toBe(SceneKey.Ch6Datacenter);
  });

  it('routes the M1 sandbox hash to the sandbox scene', () => {
    expect(sceneKeyFromHash('#sandbox')).toBe(SceneKey.Sandbox);
  });

  it('routes the crisis run hash to the crisis scene', () => {
    expect(sceneKeyFromHash('#crisis')).toBe(SceneKey.CrisisRun);
  });

  it('opens the bare URL directly into Crisis Run', () => {
    expect(sceneKeyFromHash('')).toBe(SceneKey.CrisisRun);
  });

  it('falls back to the menu for unknown hashes', () => {
    expect(sceneKeyFromHash('#unknown')).toBe(SceneKey.Menu);
  });

  it('routes chapter numbers to scene keys for in-game module switching', () => {
    expect(sceneKeyFromChapter(1)).toBe(SceneKey.Ch1Mine);
    expect(sceneKeyFromChapter(4)).toBe(SceneKey.Ch4Fab);
    expect(sceneKeyFromChapter(6)).toBe(SceneKey.Ch6Datacenter);
  });
});
