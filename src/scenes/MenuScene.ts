import Phaser from 'phaser';
import { SITE_METADATA } from '../ship/siteMetadata';
import { gameStore } from '../state/gameStore';
import { openFeedbackLink } from '../ui/feedbackLink';
import { createGlobalPanelController, type GlobalPanelController } from '../ui/globalPanels';
import { mountMenuOverlay } from '../ui/menuOverlay';
import { SceneKey } from './sceneKeys';

export class MenuScene extends Phaser.Scene {
  private cleanupOverlay: (() => void) | undefined;
  private globalPanels: GlobalPanelController | undefined;

  constructor() {
    super(SceneKey.Menu);
  }

  create(): void {
    gameStore.enterScene(SceneKey.Menu);

    this.add.rectangle(640, 360, 1280, 720, 0x102a3a);
    this.add.circle(260, 520, 170, 0xf8d45c, 0.2);
    this.add.circle(1030, 180, 130, 0x60d394, 0.18);

    const uiRoot = document.getElementById('ui-root');
    if (!uiRoot) {
      throw new Error('Missing #ui-root element');
    }

    this.globalPanels = createGlobalPanelController({
      getTextMode: () => gameStore.getState().preferences.textMode,
      onToggleTextMode: () => this.toggleTextMode(),
      onPreferencesChanged: () => this.refreshOverlay()
    });
    this.cleanupOverlay = mountMenuOverlay(uiRoot, this.overlayOptions());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupOverlay?.();
      this.globalPanels?.cleanup();
      this.cleanupOverlay = undefined;
      this.globalPanels = undefined;
    });
  }

  private refreshOverlay(): void {
    this.cleanupOverlay?.();
    const uiRoot = document.getElementById('ui-root');
    if (!uiRoot) {
      return;
    }

    this.cleanupOverlay = mountMenuOverlay(uiRoot, this.overlayOptions());
    this.globalPanels?.update();
  }

  private overlayOptions(): Parameters<typeof mountMenuOverlay>[1] {
    return {
      state: gameStore.getState(),
      onPlayCampaign: () => {
        window.location.hash = 'ch1';
        gameStore.enterScene(SceneKey.Ch1Mine, 1);
        this.scene.start(SceneKey.Ch1Mine);
      },
      onPlayCrisis: () => {
        window.location.hash = 'crisis';
        gameStore.enterScene(SceneKey.CrisisRun);
        this.scene.start(SceneKey.CrisisRun);
      },
      onTextModeToggle: () => this.toggleTextMode(),
      onMuteToggle: () => {
        gameStore.setMuted(!gameStore.getState().preferences.muted);
        this.refreshOverlay();
      },
      onOpenCodex: () => this.globalPanels?.openCodex(),
      onOpenSettings: () => this.globalPanels?.openSettings(),
      onOpenFeedback: SITE_METADATA.feedbackHref.length > 0
        ? () => openFeedbackLink(SITE_METADATA.feedbackHref)
        : undefined
    };
  }

  private toggleTextMode(): void {
    const current = gameStore.getState().preferences.textMode;
    gameStore.setTextMode(current === 'kid' ? 'nerd' : 'kid');
    this.refreshOverlay();
  }
}
