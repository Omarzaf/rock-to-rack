import Phaser from 'phaser';
import { playUiCue } from '../audio/soundDesign';
import { gameStore } from '../state/gameStore';
import type { PipelineHudModuleNavOptions } from '../ui/pipelineHud';
import { startScene } from './sceneLoader';
import { sceneKeyFromChapter } from './sceneRouting';

export function moduleNavOptions(scene: Phaser.Scene, activeChapter: number): PipelineHudModuleNavOptions {
  return {
    unlockedChapters: gameStore.getState().progress.unlockedChapters,
    activeChapter,
    onSwitchChapter: (chapter) => {
      if (chapter === activeChapter) {
        return;
      }

      const sceneKey = sceneKeyFromChapter(chapter);
      playUiCue('navigate');
      window.location.hash = `ch${chapter}`;
      gameStore.enterScene(sceneKey, chapter);
      void startScene(scene, sceneKey);
    }
  };
}
