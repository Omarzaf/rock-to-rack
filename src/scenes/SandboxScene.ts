import Phaser from 'phaser';
import balanceJson from '../content/balance.json';
import eventsJson from '../content/events.json';
import stringsJson from '../content/strings.json';
import { addResources, type ResourceCaps, type ResourceDelta } from '../sim/economy';
import { applyEventChoice, type EventCardDefinition } from '../sim/events';
import { gameStore } from '../state/gameStore';
import type { ResourceState, TextMode } from '../state/types';
import { mountDialogue, type DialogueLabels, type DialogueLine, type MountedDialogue } from '../ui/dialogueOverlay';
import { mountEventCard, type EventCardLabels, type MountedEventCard } from '../ui/eventCardOverlay';
import { mountFactCard, type FactCardDefinition, type FactCardLabels, type MountedFactCard } from '../ui/factCard';
import { createGlobalPanelController, GLOBAL_TOOL_LABELS, type GlobalPanelController } from '../ui/globalPanels';
import { mountPipelineHud, type MountedPipelineHud, type PipelineHudLabels } from '../ui/pipelineHud';
import type { TextModeText } from '../ui/text';
import { textForMode } from '../ui/text';
import { SceneKey } from './sceneKeys';
import { startScene } from './sceneLoader';

interface SandboxActions {
  addResources: TextModeText;
  showDialogue: TextModeText;
  showFact: TextModeText;
  showEvent: TextModeText;
  toggleMode: TextModeText;
  menu: TextModeText;
}

interface SandboxStrings {
  hud: PipelineHudLabels;
  sandbox: {
    title: TextModeText;
    subtitle: TextModeText;
    actions: SandboxActions;
    dialogueLabels: DialogueLabels;
    factLabels: FactCardLabels;
    eventLabels: EventCardLabels;
    analyticsLabel: TextModeText;
    analyticsEmpty: TextModeText;
    dialogue: DialogueLine[];
    factCard: FactCardDefinition;
  };
}

interface BalanceContent {
  resources: {
    caps: ResourceCaps;
  };
  sandbox: {
    hudDemoDelta: ResourceDelta;
  };
}

interface EventsContent {
  sandboxPowerSurge: EventCardDefinition;
}

interface LoggedAnalytics {
  name: string;
  summary: string;
}

const STRINGS = stringsJson as SandboxStrings;
const BALANCE = balanceJson as BalanceContent;
const EVENTS = eventsJson as unknown as EventsContent;

export class SandboxScene extends Phaser.Scene {
  private cleanupCallbacks: Array<() => void> = [];
  private hud: MountedPipelineHud | undefined;
  private dialogue: MountedDialogue | undefined;
  private factCard: MountedFactCard | undefined;
  private eventCard: MountedEventCard | undefined;
  private globalPanels: GlobalPanelController | undefined;
  private controls: HTMLElement | undefined;
  private analyticsLog: HTMLElement | undefined;
  private analyticsEvents: LoggedAnalytics[] = [];

  constructor() {
    super(SceneKey.Sandbox);
  }

  create(): void {
    gameStore.enterScene(SceneKey.Sandbox);
    this.drawBackdrop();

    const uiRoot = document.getElementById('ui-root');
    if (!uiRoot) {
      throw new Error('Missing #ui-root element');
    }

    uiRoot.replaceChildren();

    this.hud = mountPipelineHud(uiRoot, {
      resources: gameStore.getState().resources,
      textMode: this.textMode,
      labels: STRINGS.hud,
      actionLabels: GLOBAL_TOOL_LABELS,
      onOpenCodex: () => this.globalPanels?.openCodex(),
      onOpenSettings: () => this.globalPanels?.openSettings()
    });
    this.cleanupCallbacks.push(this.hud.cleanup);
    this.globalPanels = createGlobalPanelController({
      getTextMode: () => this.textMode,
      onToggleTextMode: () => this.toggleTextMode()
    });
    this.cleanupCallbacks.push(this.globalPanels.cleanup);

    this.mountControls(uiRoot);
    this.mountAnalyticsLog(uiRoot);
    this.cleanupCallbacks.push(gameStore.events.on('analytics:event', (event) => {
      this.analyticsEvents = [
        {
          name: event.name,
          summary: Object.entries(event.payload)
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join(', ')
        },
        ...this.analyticsEvents
      ].slice(0, 4);
      this.renderAnalyticsLog();
    }));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private get textMode(): TextMode {
    return gameStore.getState().preferences.textMode;
  }

  private mountControls(root: HTMLElement): void {
    this.controls = document.createElement('section');
    this.controls.className = 'sandbox-controls';
    root.append(this.controls);
    this.cleanupCallbacks.push(() => this.controls?.remove());
    this.renderControls();
  }

  private renderControls(): void {
    if (!this.controls) {
      return;
    }

    const content = STRINGS.sandbox;
    const title = document.createElement('h1');
    title.textContent = textForMode(content.title, this.textMode);

    const subtitle = document.createElement('p');
    subtitle.textContent = textForMode(content.subtitle, this.textMode);

    const actions = document.createElement('div');
    actions.className = 'sandbox-actions';
    actions.append(
      this.controlButton(content.actions.addResources, () => this.applyHudDemoDelta()),
      this.controlButton(content.actions.showDialogue, () => this.showDialogue()),
      this.controlButton(content.actions.showFact, () => this.showFactCard()),
      this.controlButton(content.actions.showEvent, () => this.showEventCard()),
      this.controlButton(content.actions.toggleMode, () => this.toggleTextMode()),
      this.controlButton(content.actions.menu, () => {
        window.location.hash = 'menu';
        void startScene(this, SceneKey.Menu);
      }, 'secondary-action')
    );

    this.controls.replaceChildren(title, subtitle, actions);
  }

  private mountAnalyticsLog(root: HTMLElement): void {
    this.analyticsLog = document.createElement('aside');
    this.analyticsLog.className = 'analytics-log';
    root.append(this.analyticsLog);
    this.cleanupCallbacks.push(() => this.analyticsLog?.remove());
    this.renderAnalyticsLog();
  }

  private renderAnalyticsLog(): void {
    if (!this.analyticsLog) {
      return;
    }

    const heading = document.createElement('h2');
    heading.textContent = textForMode(STRINGS.sandbox.analyticsLabel, this.textMode);

    const list = document.createElement('ul');

    if (this.analyticsEvents.length === 0) {
      const item = document.createElement('li');
      item.textContent = textForMode(STRINGS.sandbox.analyticsEmpty, this.textMode);
      list.append(item);
    } else {
      for (const event of this.analyticsEvents) {
        const item = document.createElement('li');
        item.textContent = `${event.name}: ${event.summary}`;
        list.append(item);
      }
    }

    this.analyticsLog.replaceChildren(heading, list);
  }

  private applyHudDemoDelta(): void {
    const resources = addResources(gameStore.getState().resources, BALANCE.sandbox.hudDemoDelta, BALANCE.resources.caps);
    this.replaceResources(resources);
  }

  private showDialogue(): void {
    this.dialogue?.cleanup();
    this.dialogue = mountDialogue(documentRoot(), {
      lines: STRINGS.sandbox.dialogue,
      textMode: this.textMode,
      labels: STRINGS.sandbox.dialogueLabels,
      onComplete: () => {
        this.dialogue = undefined;
      }
    });
  }

  private showFactCard(): void {
    this.factCard?.cleanup();
    this.factCard = mountFactCard(documentRoot(), {
      card: STRINGS.sandbox.factCard,
      textMode: this.textMode,
      labels: STRINGS.sandbox.factLabels,
      onDismiss: () => {
        this.factCard = undefined;
      },
      onOpen: (cardId) => {
        gameStore.events.emit('analytics:event', {
          name: 'factcard_opened',
          payload: {
            factCardId: cardId,
            scene: SceneKey.Sandbox
          }
        });
      }
    });
  }

  private showEventCard(): void {
    this.eventCard?.cleanup();
    this.eventCard = mountEventCard(documentRoot(), {
      event: EVENTS.sandboxPowerSurge,
      textMode: this.textMode,
      labels: STRINGS.sandbox.eventLabels,
      onChoice: (choiceId) => {
        const result = applyEventChoice(
          gameStore.getState().resources,
          EVENTS.sandboxPowerSurge,
          choiceId,
          BALANCE.resources.caps
        );
        this.replaceResources(result.resources);
        this.eventCard?.cleanup();
        this.eventCard = undefined;
        gameStore.events.emit('analytics:event', {
          name: 'event_choice',
          payload: {
            eventId: result.event.id,
            choiceId: result.choice.id,
            scene: SceneKey.Sandbox
          }
        });
      }
    });
  }

  private replaceResources(resources: ResourceState): void {
    gameStore.update((state) => ({
      ...state,
      resources
    }));
    this.hud?.update(resources, this.textMode);
    gameStore.saveNow();
  }

  private toggleTextMode(): void {
    gameStore.setTextMode(this.textMode === 'kid' ? 'nerd' : 'kid');
    this.hud?.update(gameStore.getState().resources, this.textMode);
    this.dialogue?.updateMode(this.textMode);
    this.factCard?.updateMode(this.textMode);
    this.eventCard?.updateMode(this.textMode);
    this.renderControls();
    this.renderAnalyticsLog();
    this.globalPanels?.update();
  }

  private controlButton(label: TextModeText, onClick: () => void, className = 'primary-action'): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = textForMode(label, this.textMode);
    button.addEventListener('click', onClick);
    return button;
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x101820);
    this.add.rectangle(640, 610, 1280, 220, 0x0f766e, 0.28);
    this.add.circle(220, 210, 92, 0xf8d45c, 0.32);
    this.add.circle(1090, 180, 120, 0x60d394, 0.22);
    this.add.rectangle(640, 410, 880, 170, 0x1f2937, 0.58);
    this.add.rectangle(430, 410, 120, 80, 0xf59e0b, 0.8);
    this.add.rectangle(640, 410, 120, 80, 0x60d394, 0.8);
    this.add.rectangle(850, 410, 120, 80, 0x60a5fa, 0.8);
    this.add.line(640, 410, 490, 410, 580, 410, 0xfff7d6, 0.7).setLineWidth(5);
    this.add.line(640, 410, 700, 410, 790, 410, 0xfff7d6, 0.7).setLineWidth(5);
  }

  private cleanup(): void {
    for (const cleanup of this.cleanupCallbacks.splice(0)) {
      cleanup();
    }
    this.dialogue = undefined;
    this.factCard = undefined;
    this.eventCard = undefined;
    this.globalPanels = undefined;
    this.hud = undefined;
    this.controls = undefined;
    this.analyticsLog = undefined;
  }
}

function documentRoot(): HTMLElement {
  const root = document.getElementById('ui-root');
  if (!root) {
    throw new Error('Missing #ui-root element');
  }
  return root;
}
