import Phaser from 'phaser';
import { playUiCue } from '../audio/soundDesign';
import balanceJson from '../content/balance.json';
import eventsJson from '../content/events.json';
import { vegaGuideLines } from '../content/guide';
import quizJson from '../content/quiz.json';
import stringsJson from '../content/strings.json';
import { applyEventChoice, type EventCardDefinition } from '../sim/events';
import {
  createInitialRefineryChapter,
  getActiveLaneModules,
  getRefineryGoalProgress,
  placeRefineryModule,
  recycleSlag,
  storeSlag,
  tickRefinery,
  type RefineryBalance,
  type RefineryBlockedReason,
  type RefineryChapterState,
  type RefineryLaneId,
  type RefineryModuleType
} from '../sim/refinery';
import { chapterProgressRatio } from '../sim/pace';
import { gameStore } from '../state/gameStore';
import type { ResourceState, TextMode } from '../state/types';
import {
  mountChapterTwoComplete,
  mountChapterTwoOverlay,
  mountChapterTwoQuiz,
  type ChapterTwoLabels,
  type MountedChapterTwoOverlay
} from '../ui/chapterTwoOverlay';
import { mountDialogue, type DialogueLabels, type DialogueLine, type MountedDialogue } from '../ui/dialogueOverlay';
import { mountEventCard, type EventCardLabels, type MountedEventCard } from '../ui/eventCardOverlay';
import { mountFactCard, type FactCardDefinition, type FactCardLabels, type MountedFactCard } from '../ui/factCard';
import { createGlobalPanelController, GLOBAL_TOOL_LABELS, type GlobalPanelController } from '../ui/globalPanels';
import { mountPipelineHud, type MountedPipelineHud, type PipelineHudLabels } from '../ui/pipelineHud';
import type { MountedModal, QuizDefinition } from '../ui/chapterOneOverlay';
import type { TextModeText } from '../ui/text';
import { clampIndex, digitToIndex, isActivationKey, isInteractiveElementFocused, isReplayInterruptKey } from './chapterKeyboard';
import { debugCatchUpMultiplier, emitDebugProgress } from './debugProgress';
import { moduleNavOptions } from './moduleNavigation';
import { SceneKey } from './sceneKeys';
import { startScene } from './sceneLoader';

interface BalanceContent {
  resources: {
    caps: import('../sim/economy').ResourceCaps;
  };
  ch2: RefineryBalance & {
    tickSeconds: number;
    pacingTargetSeconds: {
      min: number;
      max: number;
    };
  };
}

interface ChapterTwoStrings {
  hud: PipelineHudLabels;
  sandbox: {
    dialogueLabels: DialogueLabels;
    factLabels: FactCardLabels;
    eventLabels: EventCardLabels;
  };
  ch2: {
    title: TextModeText;
    subtitle: TextModeText;
    labels: ChapterTwoLabels;
    moduleNames: Record<RefineryModuleType, TextModeText>;
    laneNames: Record<RefineryLaneId, TextModeText>;
    messages: Record<
      'laneNotFound' | 'columnOutOfBounds' | 'cellOccupied' | 'insufficientResources'
      | 'inactiveSequence' | 'insufficientEnergyWater' | 'insufficientMinerals' | 'slagCapacity',
      TextModeText
    >;
    intro: DialogueLine[];
    facts: Record<'nineNines' | 'energyHungry' | 'recycling', FactCardDefinition>;
    completion: {
      title: TextModeText;
      body: TextModeText;
    };
  };
}

interface EventsContent {
  ch2EnergySpike: EventCardDefinition;
  ch2Inspection: EventCardDefinition;
}

interface QuizContent {
  ch2FieldCheck: QuizDefinition;
}

const BALANCE = balanceJson as unknown as BalanceContent;
const STRINGS = stringsJson as ChapterTwoStrings;
const EVENTS = eventsJson as unknown as EventsContent;
const QUIZ = quizJson as QuizContent;

const MODULE_COLORS: Record<RefineryModuleType, number> = {
  crusher: 0xf8d45c,
  furnace: 0xfb923c,
  chemicalBath: 0x2dd4bf,
  zoneRefiner: 0xa78bfa
};

const FACT_BY_ID: Record<string, keyof ChapterTwoStrings['ch2']['facts']> = {
  'ch2-nine-nines': 'nineNines',
  'ch2-energy-hungry': 'energyHungry',
  'ch2-recycling-ewaste': 'recycling'
};

const GRID_ORIGIN = { x: 300, y: 242 };
const CELL = { width: 126, height: 72 };

export class Ch2RefineryScene extends Phaser.Scene {
  private chapter = createInitialChapterTwoState();
  private selectedModule: RefineryModuleType = 'crusher';
  private cleanupCallbacks: Array<() => void> = [];
  private cellZones: Phaser.GameObjects.Zone[] = [];
  private siloResourceTexts = new Map<RefineryLaneId, Phaser.GameObjects.Text>();
  private moduleObjects: Phaser.GameObjects.Container[] = [];
  private conveyorGraphics: Phaser.GameObjects.Graphics | undefined;
  private hud: MountedPipelineHud | undefined;
  private globalPanels: GlobalPanelController | undefined;
  private overlay: MountedChapterTwoOverlay | undefined;
  private dialogue: MountedDialogue | undefined;
  private factCard: MountedFactCard | undefined;
  private eventCard: MountedEventCard | undefined;
  private quiz: MountedModal | undefined;
  private completion: MountedModal | undefined;
  private pendingFactIds: string[] = [];
  private pausedForOverlay = false;
  private introInterruptible = false;
  private keyboardHandler: ((event: KeyboardEvent) => void) | undefined;
  private keyboardCursor = { laneIndex: 0, column: 0 };
  private keyboardCursorRect: Phaser.GameObjects.Rectangle | undefined;
  private lastMessage: TextModeText | null = null;

  constructor() {
    super(SceneKey.Ch2Refinery);
  }

  create(): void {
    gameStore.enterScene(SceneKey.Ch2Refinery, 2);
    this.chapter = createInitialChapterTwoState();
    this.drawBackdrop();
    this.drawSilos();
    this.drawGrid();
    this.redrawModules();
    this.mountDom();
    this.bindKeyboard();
    this.showIntroDialogue();

    this.time.addEvent({
      delay: BALANCE.ch2.tickSeconds * 1000,
      loop: true,
      callback: () => this.tickChapter(BALANCE.ch2.tickSeconds)
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private get textMode(): TextMode {
    return gameStore.getState().preferences.textMode;
  }

  private get resources(): ResourceState {
    return gameStore.getState().resources;
  }

  private mountDom(): void {
    const uiRoot = documentRoot();
    uiRoot.replaceChildren();

    this.hud = mountPipelineHud(uiRoot, {
      stage: 2,
      resources: this.resources,
      textMode: this.textMode,
      labels: STRINGS.hud,
      moduleNav: moduleNavOptions(this, 2),
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

    this.overlay = mountChapterTwoOverlay(uiRoot, this.overlayOptions());
    this.cleanupCallbacks.push(this.overlay.cleanup);
    this.emitDebugProgress();
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x071116);
    this.add.rectangle(640, 360, 1120, 420, 0x0c252a, 0.76);
    this.add.rectangle(640, 604, 1280, 232, 0x09272b, 1);
    this.add.circle(1010, 170, 96, 0x2dd4bf, 0.11);
    this.add.circle(170, 190, 72, 0xf8d45c, 0.11);

    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x9bf6ff, 0.1);
    for (let y = 250; y <= 572; y += 58) {
      graphics.lineBetween(120, y, 1160, y + ((y / 58) % 2 === 0 ? 10 : -8));
    }
  }

  private drawSilos(): void {
    const graphics = this.add.graphics();
    const lanes = BALANCE.ch2.lanes;
    for (const lane of lanes) {
      const y = this.laneY(lane.id);
      graphics.fillStyle(MODULE_COLORS[lane.requiredModules[0]], 0.2);
      graphics.fillRoundedRect(118, y - 28, 120, 56, 10);
      graphics.lineStyle(2, 0xd8f3dc, 0.25);
      graphics.strokeRoundedRect(118, y - 28, 120, 56, 10);
      this.add.text(132, y - 18, this.laneLabel(lane.id), {
        color: '#fff7d6',
        fontFamily: 'Nunito, system-ui',
        fontSize: '15px',
        fontStyle: '700'
      });
      const rawText = this.add.text(132, y + 4, `${Math.floor(this.resources.minerals[lane.mineral])} raw`, {
        color: '#d6f6ef',
        fontFamily: 'Nunito, system-ui',
        fontSize: '12px'
      });
      this.siloResourceTexts.set(lane.id, rawText);
    }
  }

  private drawGrid(): void {
    const graphics = this.add.graphics();
    for (const lane of BALANCE.ch2.lanes) {
      const y = this.laneY(lane.id);
      graphics.lineStyle(5, 0x2dd4bf, 0.22);
      graphics.lineBetween(GRID_ORIGIN.x - 26, y, GRID_ORIGIN.x + CELL.width * BALANCE.ch2.grid.columns + 22, y);

      for (let column = 0; column < BALANCE.ch2.grid.columns; column += 1) {
        const x = this.cellX(column);
        graphics.fillStyle(0x102a30, 0.84);
        graphics.fillRoundedRect(x - CELL.width / 2 + 4, y - CELL.height / 2 + 4, CELL.width - 8, CELL.height - 8, 10);
        graphics.lineStyle(2, 0xd8f3dc, 0.18);
        graphics.strokeRoundedRect(x - CELL.width / 2 + 4, y - CELL.height / 2 + 4, CELL.width - 8, CELL.height - 8, 10);

        const zone = this.add.zone(x, y, CELL.width, CELL.height)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.placeModule(lane.id, column));
        this.cellZones.push(zone);
      }
    }

    this.keyboardCursorRect?.destroy();
    this.keyboardCursorRect = this.add.rectangle(this.cellX(0), this.laneY(BALANCE.ch2.lanes[0]?.id ?? 'silicon'), CELL.width - 12, CELL.height - 12)
      .setStrokeStyle(3, 0xf8d45c, 0.9)
      .setFillStyle(0xf8d45c, 0.08);
    this.updateKeyboardCursor();
  }

  private placeModule(laneId: RefineryLaneId, column: number): void {
    const result = placeRefineryModule(this.chapter, this.resources, {
      laneId,
      column,
      moduleType: this.selectedModule
    }, BALANCE.ch2);

    if (!result.ok) {
      this.lastMessage = messageForReason(result.reason, STRINGS.ch2.messages);
      this.refreshOverlay();
      return;
    }

    this.chapter = result.chapter;
    this.replaceResources(result.resources);
    this.lastMessage = null;
    this.redrawModules();
    this.refreshOverlay();
  }

  private redrawModules(): void {
    this.conveyorGraphics?.destroy();
    this.moduleObjects.splice(0).forEach((object) => object.destroy());

    const conveyors = this.add.graphics();
    conveyors.lineStyle(6, 0x9bf6ff, 0.2);
    for (const lane of BALANCE.ch2.lanes) {
      const active = getActiveLaneModules(this.chapter, lane.id, BALANCE.ch2);
      if (active.length > 1) {
        conveyors.lineBetween(
          this.cellX(active[0].column),
          this.laneY(lane.id),
          this.cellX(active[active.length - 1].column),
          this.laneY(lane.id)
        );
      }
    }
    this.conveyorGraphics = conveyors;

    for (const module of this.chapter.modules) {
      const object = this.drawModuleObject(module.laneId, module.column, module.moduleType);
      this.moduleObjects.push(object);
    }
  }

  private drawModuleObject(laneId: RefineryLaneId, column: number, moduleType: RefineryModuleType): Phaser.GameObjects.Container {
    const x = this.cellX(column);
    const y = this.laneY(laneId);
    const color = MODULE_COLORS[moduleType];
    const container = this.add.container(x, y);
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.22);
    graphics.fillEllipse(0, 26, 80, 18);
    graphics.fillStyle(color, 0.9);
    graphics.fillRoundedRect(-38, -24, 76, 48, 9);
    graphics.lineStyle(3, 0x061116, 0.72);
    graphics.strokeRoundedRect(-38, -24, 76, 48, 9);

    if (moduleType === 'crusher') {
      graphics.fillStyle(0x061116, 0.42);
      graphics.fillTriangle(-26, -8, -4, 0, -26, 8);
      graphics.fillTriangle(26, -8, 4, 0, 26, 8);
    } else if (moduleType === 'furnace') {
      graphics.fillStyle(0xfff7d6, 0.48);
      graphics.fillCircle(0, 0, 16);
    } else if (moduleType === 'chemicalBath') {
      graphics.fillStyle(0x9bf6ff, 0.58);
      graphics.fillRoundedRect(-24, 2, 48, 14, 6);
    } else {
      graphics.lineStyle(4, 0xfff7d6, 0.7);
      graphics.lineBetween(0, -18, 0, 18);
      graphics.strokeCircle(0, 0, 13);
    }

    container.add(graphics);
    return container;
  }

  private tickChapter(seconds: number): void {
    if (this.pausedForOverlay || this.completion || this.quiz) {
      return;
    }

    this.syncChapterProgressFromStore();
    const beforePurity = this.chapter.siliconPurityNines;
    const beforeOutputCount = refinedOutputCount(this.chapter.refinedOutputs);
    const beforeSlag = this.chapter.slag;
    const multiplier = debugCatchUpMultiplier(
      2,
      this.chapter.elapsedSeconds,
      this.progressRatio(),
      BALANCE.ch2.pacingTargetSeconds
    );
    const result = tickRefinery(this.chapter, this.resources, seconds, BALANCE.ch2, BALANCE.resources.caps, {
      progressMultiplier: multiplier
    });

    if (result.blockedReason) {
      playUiCue('warning');
      this.lastMessage = messageForBlocked(result.blockedReason, STRINGS.ch2.messages);
      if (result.blockedReason === 'insufficient-energy-water') {
        this.queueFact('ch2-energy-hungry');
      }
      this.refreshOverlay();
      return;
    }

    this.chapter = result.chapter;
    this.replaceResources(result.resources);
    this.persistChapterProgress(false);
    this.lastMessage = null;

    if (this.chapter.siliconPurityNines > beforePurity) {
      this.queueFact('ch2-nine-nines');
    }
    if (this.chapter.siliconPurityNines > beforePurity || refinedOutputCount(this.chapter.refinedOutputs) > beforeOutputCount) {
      playUiCue('refine');
    }
    if (this.chapter.slag > beforeSlag) {
      this.queueFact('ch2-energy-hungry');
      this.queueFact('ch2-recycling-ewaste');
    }

    this.refreshOverlay();

    if (this.showNextPendingFact()) {
      return;
    }

    if (this.maybeTriggerEvents()) {
      return;
    }

    if (getRefineryGoalProgress(this.chapter, BALANCE.ch2).complete) {
      this.showQuiz();
    }
  }

  private maybeTriggerEvents(): boolean {
    if (!this.chapter.triggeredEvents.includes(EVENTS.ch2EnergySpike.id)
      && this.chapter.elapsedSeconds >= BALANCE.ch2.eventTriggers.energySpikeAtSeconds) {
      this.showEventCard(EVENTS.ch2EnergySpike);
      return true;
    }

    if (!this.chapter.triggeredEvents.includes(EVENTS.ch2Inspection.id)
      && this.chapter.slag >= BALANCE.ch2.eventTriggers.inspectionAtSlag) {
      this.showEventCard(EVENTS.ch2Inspection);
      return true;
    }

    return false;
  }

  private showIntroDialogue(): void {
    this.pausedForOverlay = true;
    this.introInterruptible = gameStore.getState().chapters.ch2.completed;
    this.dialogue?.cleanup();
    this.dialogue = mountDialogue(documentRoot(), {
      lines: vegaGuideLines(STRINGS.ch2.intro, 2),
      textMode: this.textMode,
      labels: STRINGS.sandbox.dialogueLabels,
      onComplete: () => {
        this.dialogue = undefined;
        this.pausedForOverlay = false;
      }
    });
  }

  private bindKeyboard(): void {
    this.keyboardHandler = (event: KeyboardEvent) => {
      if (this.dialogue && this.introInterruptible && isReplayInterruptKey(event)) {
        event.preventDefault();
        this.dismissIntroDialogue();
        return;
      }

      if (this.pausedForOverlay || this.quiz || this.completion || this.factCard || this.eventCard || this.dialogue) {
        return;
      }

      if (isInteractiveElementFocused()) {
        return;
      }

      const moduleIndex = digitToIndex(event.key, 4);
      if (moduleIndex !== null) {
        this.selectedModule = (['crusher', 'furnace', 'chemicalBath', 'zoneRefiner'] as RefineryModuleType[])[moduleIndex];
        this.refreshOverlay();
        event.preventDefault();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.moveKeyboardCursor(0, -1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.moveKeyboardCursor(0, 1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.moveKeyboardCursor(-1, 0);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.moveKeyboardCursor(1, 0);
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        this.handleRecycleSlag();
        return;
      }

      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        this.handleStoreSlag();
        return;
      }

      if (isActivationKey(event)) {
        event.preventDefault();
        this.placeModule(this.currentLaneId(), this.keyboardCursor.column);
      }
    };

    this.input.keyboard?.on('keydown', this.keyboardHandler);
  }

  private moveKeyboardCursor(deltaLane: number, deltaColumn: number): void {
    if (BALANCE.ch2.lanes.length === 0) {
      return;
    }

    this.keyboardCursor = {
      laneIndex: clampIndex(this.keyboardCursor.laneIndex + deltaLane, BALANCE.ch2.lanes.length),
      column: clampIndex(this.keyboardCursor.column + deltaColumn, BALANCE.ch2.grid.columns)
    };
    this.updateKeyboardCursor();
    this.refreshOverlay();
  }

  private currentLaneId(): RefineryLaneId {
    return BALANCE.ch2.lanes[this.keyboardCursor.laneIndex]?.id ?? BALANCE.ch2.lanes[0].id;
  }

  private updateKeyboardCursor(): void {
    if (!this.keyboardCursorRect) {
      return;
    }

    const laneId = this.currentLaneId();
    this.keyboardCursorRect.setPosition(this.cellX(this.keyboardCursor.column), this.laneY(laneId));
    this.keyboardCursorRect.setVisible(true);
  }

  private dismissIntroDialogue(): void {
    if (!this.dialogue) {
      return;
    }

    this.dialogue.cleanup();
    this.dialogue = undefined;
    this.pausedForOverlay = false;
    this.introInterruptible = false;
    this.refreshOverlay();
  }

  private queueFact(factId: string): void {
    if (this.chapter.firstFacts.includes(factId) || this.pendingFactIds.includes(factId)) {
      return;
    }

    this.chapter = {
      ...this.chapter,
      firstFacts: [...this.chapter.firstFacts, factId]
    };
    this.pendingFactIds.push(factId);
  }

  private showNextPendingFact(): boolean {
    const factId = this.pendingFactIds.shift();
    if (!factId) {
      this.pausedForOverlay = false;
      return false;
    }

    const factKey = FACT_BY_ID[factId];
    if (!factKey) {
      return this.showNextPendingFact();
    }

    this.pausedForOverlay = true;
    this.factCard?.cleanup();
    this.factCard = mountFactCard(documentRoot(), {
      card: STRINGS.ch2.facts[factKey],
      textMode: this.textMode,
      labels: STRINGS.sandbox.factLabels,
      onDismiss: () => {
        this.factCard = undefined;
        this.showNextPendingFact();
      },
      onOpen: (factCardId) => {
        gameStore.events.emit('analytics:event', {
          name: 'factcard_opened',
          payload: {
            factCardId,
            scene: SceneKey.Ch2Refinery
          }
        });
      }
    });
    this.persistChapterProgress(false);
    return true;
  }

  private showEventCard(event: EventCardDefinition): void {
    this.pausedForOverlay = true;
    this.chapter = {
      ...this.chapter,
      triggeredEvents: [...new Set([...this.chapter.triggeredEvents, event.id])]
    };
    this.eventCard?.cleanup();
    this.eventCard = mountEventCard(documentRoot(), {
      event,
      textMode: this.textMode,
      labels: STRINGS.sandbox.eventLabels,
      onChoice: (choiceId) => {
        let nextChapter = this.chapter;
        let nextResources = this.resources;
        const result = applyEventChoice(nextResources, event, choiceId, BALANCE.resources.caps);
        nextResources = result.resources;

        if (event.id === EVENTS.ch2Inspection.id && choiceId === 'recycle-slag') {
          const slagResult = recycleSlag(nextChapter, nextResources, BALANCE.ch2, BALANCE.resources.caps);
          nextChapter = slagResult.chapter;
          nextResources = slagResult.resources;
        }

        if (event.id === EVENTS.ch2Inspection.id && choiceId === 'store-safely') {
          const slagResult = storeSlag(nextChapter, nextResources, BALANCE.ch2, BALANCE.resources.caps);
          nextChapter = slagResult.chapter;
          nextResources = slagResult.resources;
        }

        const timePenalty = result.choice.timePenaltySeconds ?? 0;
        this.chapter = {
          ...nextChapter,
          elapsedSeconds: nextChapter.elapsedSeconds + timePenalty
        };
        this.replaceResources(nextResources);
        this.persistChapterProgress(false);
        this.eventCard?.cleanup();
        this.eventCard = undefined;
        this.pausedForOverlay = false;
        this.refreshOverlay();
        gameStore.events.emit('analytics:event', {
          name: 'event_choice',
          payload: {
            eventId: event.id,
            choiceId,
            scene: SceneKey.Ch2Refinery
          }
        });
      }
    });
  }

  private showQuiz(): void {
    this.pausedForOverlay = true;
    this.quiz?.cleanup();
    this.quiz = mountChapterTwoQuiz(documentRoot(), {
      quiz: QUIZ.ch2FieldCheck,
      labels: STRINGS.ch2.labels,
      textMode: this.textMode,
      onAnswer: (answer) => {
        gameStore.events.emit('analytics:event', {
          name: 'quiz_answer',
          payload: {
            questionId: QUIZ.ch2FieldCheck.id,
            answerId: answer.id,
            correct: answer.correct,
            scene: SceneKey.Ch2Refinery
          }
        });

        if (!answer.correct) {
          this.lastMessage = answer.explanation;
          this.quiz?.cleanup();
          this.quiz = undefined;
          this.pausedForOverlay = true;
          this.refreshOverlay();
          window.setTimeout(() => this.showQuiz(), 1200);
          return;
        }

        this.quiz?.cleanup();
        this.quiz = undefined;
        this.lastMessage = null;
        this.refreshOverlay();
        this.persistChapterProgress(true, true);
        this.showCompletion();
      }
    });
  }

  private showCompletion(): void {
    this.completion?.cleanup();
    this.completion = mountChapterTwoComplete(documentRoot(), {
      title: STRINGS.ch2.completion.title,
      body: STRINGS.ch2.completion.body,
      labels: STRINGS.ch2.labels,
      textMode: this.textMode,
      elapsedSeconds: this.chapter.elapsedSeconds,
      refinedCount: Math.floor(this.chapter.siliconPurityNines
        + Object.values(this.chapter.refinedOutputs).reduce((sum, value) => sum + (value ?? 0), 0)),
      onNext: () => {
        window.location.hash = 'ch3';
        gameStore.enterScene(SceneKey.Ch3Crystal, 3);
        void startScene(this, SceneKey.Ch3Crystal);
      }
    });
  }

  private handleRecycleSlag(): void {
    const result = recycleSlag(this.chapter, this.resources, BALANCE.ch2, BALANCE.resources.caps);
    this.chapter = result.chapter;
    this.replaceResources(result.resources);
    this.queueFact('ch2-recycling-ewaste');
    this.persistChapterProgress(false);
    this.refreshOverlay();
    this.showNextPendingFact();
  }

  private handleStoreSlag(): void {
    const result = storeSlag(this.chapter, this.resources, BALANCE.ch2, BALANCE.resources.caps);
    this.chapter = result.chapter;
    this.replaceResources(result.resources);
    this.queueFact('ch2-recycling-ewaste');
    this.persistChapterProgress(false);
    this.refreshOverlay();
    this.showNextPendingFact();
  }

  private replaceResources(resources: ResourceState): void {
    gameStore.update((state) => ({
      ...state,
      resources
    }));
    for (const lane of BALANCE.ch2.lanes) {
      this.siloResourceTexts.get(lane.id)?.setText(`${Math.floor(resources.minerals[lane.mineral])} raw`);
    }
    this.hud?.update(resources, this.textMode);
    gameStore.saveNow();
  }

  private persistChapterProgress(completed: boolean, quizCorrect: boolean | null = null): void {
    gameStore.update((state) => ({
      ...state,
      chapters: {
        ...state.chapters,
        ch2: {
          completed,
          completedAtSeconds: completed ? Math.round(this.chapter.elapsedSeconds) : state.chapters.ch2.completedAtSeconds,
          quizCorrect,
          siliconPurityNines: this.chapter.siliconPurityNines,
          refinedOutputs: this.chapter.refinedOutputs,
          slag: this.chapter.slag,
          storedSlag: this.chapter.storedSlag,
          firstFacts: this.chapter.firstFacts
        }
      }
    }));
    gameStore.saveNow();
  }

  private syncChapterProgressFromStore(): void {
    const progress = gameStore.getState().chapters.ch2;
    this.chapter = {
      ...this.chapter,
      siliconPurityNines: Math.max(this.chapter.siliconPurityNines, progress.siliconPurityNines),
      refinedOutputs: {
        copper: Math.max(this.chapter.refinedOutputs.copper ?? 0, progress.refinedOutputs.copper ?? 0),
        lithium: Math.max(this.chapter.refinedOutputs.lithium ?? 0, progress.refinedOutputs.lithium ?? 0),
        cobalt: Math.max(this.chapter.refinedOutputs.cobalt ?? 0, progress.refinedOutputs.cobalt ?? 0)
      },
      slag: Math.max(this.chapter.slag, progress.slag),
      storedSlag: Math.max(this.chapter.storedSlag, progress.storedSlag),
      firstFacts: [...new Set([...this.chapter.firstFacts, ...progress.firstFacts])]
    };
  }

  private refreshOverlay(): void {
    this.emitDebugProgress();
    this.overlay?.update(this.overlayOptions());
  }

  private emitDebugProgress(): void {
    emitDebugProgress(2, this.chapter.elapsedSeconds, this.progressRatio(), BALANCE.ch2.pacingTargetSeconds);
  }

  private progressRatio(): number {
    const silicon = chapterProgressRatio(this.chapter.siliconPurityNines - 2, 7);
    const parallelTargets = Object.entries(BALANCE.ch2.parallelTargets);
    if (parallelTargets.length === 0) {
      return silicon;
    }

    const parallel = parallelTargets.reduce((sum, [laneId, target]) => {
      const output = this.chapter.refinedOutputs[laneId as Exclude<RefineryLaneId, 'silicon'>] ?? 0;
      return sum + chapterProgressRatio(output, target ?? 0);
    }, 0) / parallelTargets.length;
    return (silicon + parallel) / 2;
  }

  private overlayOptions() {
    return {
      resources: this.resources,
      chapter: this.chapter,
      balance: BALANCE.ch2,
      labels: STRINGS.ch2.labels,
      moduleNames: STRINGS.ch2.moduleNames,
      laneNames: STRINGS.ch2.laneNames,
      selectedModule: this.selectedModule,
      textMode: this.textMode,
      message: this.lastMessage,
      onSelectModule: (moduleType: RefineryModuleType) => {
        this.selectedModule = moduleType;
        this.refreshOverlay();
      },
      onRecycleSlag: () => this.handleRecycleSlag(),
      onStoreSlag: () => this.handleStoreSlag(),
      onToggleMode: () => this.toggleTextMode(),
      onMenu: () => {
        window.location.hash = 'menu';
        void startScene(this, SceneKey.Menu);
      }
    };
  }

  private toggleTextMode(): void {
    gameStore.setTextMode(this.textMode === 'kid' ? 'nerd' : 'kid');
    this.hud?.update(this.resources, this.textMode);
    this.overlay?.update(this.overlayOptions());
    this.dialogue?.updateMode(this.textMode);
    this.factCard?.updateMode(this.textMode);
    this.eventCard?.updateMode(this.textMode);
    this.quiz?.updateMode(this.textMode);
    this.completion?.updateMode(this.textMode);
    this.globalPanels?.update();
  }

  private laneY(laneId: RefineryLaneId): number {
    const lane = BALANCE.ch2.lanes.find((candidate) => candidate.id === laneId);
    return GRID_ORIGIN.y + (lane?.row ?? 0) * CELL.height;
  }

  private cellX(column: number): number {
    return GRID_ORIGIN.x + column * CELL.width;
  }

  private laneLabel(laneId: RefineryLaneId): string {
    return STRINGS.ch2.laneNames[laneId].kid;
  }

  private cleanup(): void {
    if (this.keyboardHandler) {
      this.input.keyboard?.off('keydown', this.keyboardHandler);
      this.keyboardHandler = undefined;
    }
    for (const cleanup of this.cleanupCallbacks.splice(0)) {
      cleanup();
    }
    this.cellZones.splice(0).forEach((zone) => zone.destroy());
    this.siloResourceTexts.clear();
    this.moduleObjects.splice(0).forEach((object) => object.destroy());
    this.conveyorGraphics?.destroy();
    this.dialogue?.cleanup();
    this.factCard?.cleanup();
    this.eventCard?.cleanup();
    this.quiz?.cleanup();
    this.completion?.cleanup();
    this.keyboardCursorRect?.destroy();
    this.keyboardCursorRect = undefined;
    this.dialogue = undefined;
    this.factCard = undefined;
    this.eventCard = undefined;
    this.quiz = undefined;
    this.completion = undefined;
    this.globalPanels = undefined;
    this.hud = undefined;
    this.overlay = undefined;
  }
}

function createInitialChapterTwoState(): RefineryChapterState {
  const progress = gameStore.getState().chapters.ch2;
  return {
    ...createInitialRefineryChapter(BALANCE.ch2),
    siliconPurityNines: progress.siliconPurityNines,
    refinedOutputs: progress.refinedOutputs,
    slag: progress.slag,
    storedSlag: progress.storedSlag,
    firstFacts: progress.firstFacts
  };
}

function messageForReason(
  reason: Exclude<ReturnType<typeof placeRefineryModule>, { ok: true }>['reason'],
  messages: ChapterTwoStrings['ch2']['messages']
): TextModeText {
  if (reason === 'lane-not-found') {
    return messages.laneNotFound;
  }
  if (reason === 'column-out-of-bounds') {
    return messages.columnOutOfBounds;
  }
  if (reason === 'cell-occupied') {
    return messages.cellOccupied;
  }
  if (reason === 'inactive sequence') {
    return messages.inactiveSequence;
  }
  return messages.insufficientResources;
}

function messageForBlocked(
  reason: RefineryBlockedReason,
  messages: ChapterTwoStrings['ch2']['messages']
): TextModeText {
  if (reason === 'insufficient-energy-water') {
    return messages.insufficientEnergyWater;
  }
  if (reason === 'insufficient-minerals') {
    return messages.insufficientMinerals;
  }
  return messages.slagCapacity;
}

function refinedOutputCount(outputs: Partial<Record<Exclude<RefineryLaneId, 'silicon'>, number>>): number {
  return Object.values(outputs).reduce((sum, value) => sum + (value ?? 0), 0);
}

function documentRoot(): HTMLElement {
  const root = document.getElementById('ui-root');
  if (!root) {
    throw new Error('Missing #ui-root element');
  }
  return root;
}
