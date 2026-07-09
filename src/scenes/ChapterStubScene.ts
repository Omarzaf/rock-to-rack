import Phaser from 'phaser';
import { gameStore } from '../state/gameStore';
import { mountChapterOverlay } from '../ui/chapterOverlay';
import { SceneKey } from './sceneKeys';

export class ChapterStubScene extends Phaser.Scene {
  private cleanupOverlay: (() => void) | undefined;

  protected constructor(
    sceneKey: SceneKey,
    private readonly chapter: number,
    private readonly title: string,
    private readonly accentColor: number,
    private readonly nextScene?: SceneKey
  ) {
    super(sceneKey);
  }

  create(): void {
    gameStore.enterScene(this.scene.key, this.chapter);
    this.drawBackdrop();

    const uiRoot = document.getElementById('ui-root');
    if (!uiRoot) {
      throw new Error('Missing #ui-root element');
    }

    this.cleanupOverlay = mountChapterOverlay(uiRoot, {
      chapter: this.chapter,
      title: this.title,
      textMode: gameStore.getState().preferences.textMode,
      hasNext: this.nextScene !== undefined,
      onMenu: () => {
        window.location.hash = 'menu';
        this.scene.start(SceneKey.Menu);
      },
      onNext: () => {
        if (!this.nextScene) {
          return;
        }

        window.location.hash = `ch${this.chapter + 1}`;
        gameStore.enterScene(this.nextScene, this.chapter + 1);
        this.scene.start(this.nextScene);
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupOverlay?.());
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x101820);
    this.add.rectangle(640, 590, 1280, 260, this.accentColor, 0.32);
    this.add.circle(170, 210, 76, this.accentColor, 0.42);
    this.add.circle(1080, 170, 110, this.accentColor, 0.24);
  }
}
