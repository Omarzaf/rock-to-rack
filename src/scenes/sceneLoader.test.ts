import { describe, expect, it, vi } from 'vitest';
import { SceneKey } from './sceneKeys';
import { ensureScene } from './sceneLoader';

describe('scene loader', () => {
  it('does not try to load scenes already registered by Phaser boot', async () => {
    const keys: Record<string, unknown> = {
      [SceneKey.Boot]: {}
    };
    const add = vi.fn();
    const manager = { keys, add } as unknown as Phaser.Scenes.SceneManager;

    await ensureScene(manager, SceneKey.Boot);

    expect(add).not.toHaveBeenCalled();
  });

  it('ignores scene keys without lazy loaders', async () => {
    const keys: Record<string, unknown> = {};
    const add = vi.fn();
    const manager = { keys, add } as unknown as Phaser.Scenes.SceneManager;

    await ensureScene(manager, SceneKey.Boot);

    expect(add).not.toHaveBeenCalled();
  });
});
