import { SceneKey } from './sceneKeys';

const HASH_SCENES = new Map<string, SceneKey>([
  ['#menu', SceneKey.Menu],
  ['#sandbox', SceneKey.Sandbox],
  ['#crisis', SceneKey.CrisisRun],
  ['#ch1', SceneKey.Ch1Mine],
  ['#ch2', SceneKey.Ch2Refinery],
  ['#ch3', SceneKey.Ch3Crystal],
  ['#ch4', SceneKey.Ch4Fab],
  ['#ch5', SceneKey.Ch5Package],
  ['#ch6', SceneKey.Ch6Datacenter]
]);

const CHAPTER_SCENES = new Map<number, SceneKey>([
  [1, SceneKey.Ch1Mine],
  [2, SceneKey.Ch2Refinery],
  [3, SceneKey.Ch3Crystal],
  [4, SceneKey.Ch4Fab],
  [5, SceneKey.Ch5Package],
  [6, SceneKey.Ch6Datacenter]
]);

export function sceneKeyFromHash(hash: string): SceneKey {
  return HASH_SCENES.get(hash.trim().toLowerCase()) ?? SceneKey.Menu;
}

export function sceneKeyFromChapter(chapter: number): SceneKey {
  return CHAPTER_SCENES.get(chapter) ?? SceneKey.Menu;
}
