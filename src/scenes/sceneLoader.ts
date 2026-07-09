import type Phaser from 'phaser';
import { SceneKey } from './sceneKeys';

type SceneType = Phaser.Types.Scenes.SceneType;
type SceneLoader = () => Promise<SceneType>;

const SCENE_LOADERS: Partial<Record<SceneKey, SceneLoader>> = {
  [SceneKey.Menu]: async () => (await import('./MenuScene')).MenuScene,
  [SceneKey.Sandbox]: async () => (await import('./SandboxScene')).SandboxScene,
  [SceneKey.CrisisRun]: async () => (await import('./CrisisRunScene')).CrisisRunScene,
  [SceneKey.Ch1Mine]: async () => (await import('./Ch1MineScene')).Ch1MineScene,
  [SceneKey.Ch2Refinery]: async () => (await import('./Ch2RefineryScene')).Ch2RefineryScene,
  [SceneKey.Ch3Crystal]: async () => (await import('./Ch3CrystalScene')).Ch3CrystalScene,
  [SceneKey.Ch4Fab]: async () => (await import('./Ch4FabScene')).Ch4FabScene,
  [SceneKey.Ch5Package]: async () => (await import('./Ch5PackageScene')).Ch5PackageScene,
  [SceneKey.Ch6Datacenter]: async () => (await import('./Ch6DatacenterScene')).Ch6DatacenterScene
};

const pendingLoads = new Map<SceneKey, Promise<void>>();

export async function ensureScene(sceneManager: Phaser.Scenes.SceneManager, sceneKey: SceneKey): Promise<void> {
  if (sceneManager.keys[sceneKey]) {
    return;
  }

  const loader = SCENE_LOADERS[sceneKey];
  if (!loader) {
    return;
  }

  let pending = pendingLoads.get(sceneKey);
  if (!pending) {
    pending = loadScene(sceneManager, sceneKey, loader).finally(() => pendingLoads.delete(sceneKey));
    pendingLoads.set(sceneKey, pending);
  }

  await pending;
}

export async function startScene(scene: Phaser.Scene, sceneKey: SceneKey): Promise<void> {
  await ensureScene(scene.scene.manager, sceneKey);
  scene.scene.start(sceneKey);
}

async function loadScene(
  sceneManager: Phaser.Scenes.SceneManager,
  sceneKey: SceneKey,
  loader: SceneLoader
): Promise<void> {
  const sceneConfig = await loader();
  if (!sceneManager.keys[sceneKey]) {
    sceneManager.add(sceneKey, sceneConfig, false);
  }
}
