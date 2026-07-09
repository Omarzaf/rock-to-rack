export enum SceneKey {
  Boot = 'BootScene',
  Menu = 'MenuScene',
  Sandbox = 'SandboxScene',
  CrisisRun = 'CrisisRunScene',
  Ch1Mine = 'Ch1MineScene',
  Ch2Refinery = 'Ch2RefineryScene',
  Ch3Crystal = 'Ch3CrystalScene',
  Ch4Fab = 'Ch4FabScene',
  Ch5Package = 'Ch5PackageScene',
  Ch6Datacenter = 'Ch6DatacenterScene'
}

export const CHAPTER_SCENE_KEYS = [
  SceneKey.Ch1Mine,
  SceneKey.Ch2Refinery,
  SceneKey.Ch3Crystal,
  SceneKey.Ch4Fab,
  SceneKey.Ch5Package,
  SceneKey.Ch6Datacenter
] as const;

export type ChapterSceneKey = (typeof CHAPTER_SCENE_KEYS)[number];

export function isChapterSceneKey(sceneKey: string): sceneKey is ChapterSceneKey {
  return CHAPTER_SCENE_KEYS.includes(sceneKey as ChapterSceneKey);
}
