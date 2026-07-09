import Phaser from 'phaser';
import { GAME_SCENES } from '../scenes';
import { SceneKey } from '../scenes/sceneKeys';

export interface RockToRackGameOptions {
  onReady?: () => void;
}

export function createRockToRackGame(parent: string, options: RockToRackGameOptions = {}): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#14213d',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: GAME_SCENES,
    title: 'Rock to Rack',
    dom: {
      createContainer: false
    },
    callbacks: {
      postBoot: (game) => {
        game.scene.start(SceneKey.Boot);
        options.onReady?.();
      }
    }
  });
}
