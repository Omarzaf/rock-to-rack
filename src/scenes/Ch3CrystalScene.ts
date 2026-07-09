import Phaser from 'phaser';
import balanceJson from '../content/balance.json';
import eventsJson from '../content/events.json';
import { jensenGuideLines } from '../content/guide';
import quizJson from '../content/quiz.json';
import stringsJson from '../content/strings.json';
import { applyEventChoice, type EventCardDefinition } from '../sim/events';
import {
  applyVibrationPenalty,
  canRetryPull,
  completeSliceStage,
  createInitialCrystalChapter,
  generateIngotProfile,
  getSliceStageStatus,
  isSegmentCut,
  retryPull,
  sliceIngot,
  tickCrystalPull,
  type CrystalBalance,
  type CrystalChapterState,
  type CrystalStage
} from '../sim/crystal';
import { chapterProgressRatio } from '../sim/pace';
import { gameStore } from '../state/gameStore';
import type { ResourceState, TextMode } from '../state/types';
import {
  mountChapterThreeComplete,
  mountChapterThreeOverlay,
  mountChapterThreeQuiz,
  type ChapterThreeLabels,
  type MountedChapterThreeOverlay
} from '../ui/chapterThreeOverlay';
import { mountDialogue, type DialogueLabels, type DialogueLine, type MountedDialogue } from '../ui/dialogueOverlay';
import { mountEventCard, type EventCardLabels, type MountedEventCard } from '../ui/eventCardOverlay';
import { mountFactCard, type FactCardDefinition, type FactCardLabels, type MountedFactCard } from '../ui/factCard';
import { createGlobalPanelController, GLOBAL_TOOL_LABELS, type GlobalPanelController } from '../ui/globalPanels';
import { mountPipelineHud, type MountedPipelineHud, type PipelineHudLabels } from '../ui/pipelineHud';
import type { MountedModal, QuizDefinition } from '../ui/chapterOneOverlay';
import type { TextModeText } from '../ui/text';
import { debugCatchUpMultiplier, emitDebugProgress } from './debugProgress';
import { moduleNavOptions } from './moduleNavigation';
import { SceneKey } from './sceneKeys';

interface BalanceContent {
  resources: {
    caps: import('../sim/economy').ResourceCaps;
  };
  ch3: CrystalBalance;
}

interface ChapterThreeStrings {
  hud: PipelineHudLabels;
  sandbox: {
    dialogueLabels: DialogueLabels;
    factLabels: FactCardLabels;
    eventLabels: EventCardLabels;
  };
  ch3: {
    labels: ChapterThreeLabels;
    stageNames: Record<CrystalStage, TextModeText>;
    messages: Record<'pullHint' | 'sliceHint' | 'flawedDiscard' | 'missedGuide' | 'alreadyCut' | 'insufficientEnergyWater', TextModeText>;
    intro: DialogueLine[];
    facts: Record<'czochralski' | 'roundWafers' | 'diamondWire', FactCardDefinition>;
    completion: {
      title: TextModeText;
      body: TextModeText;
    };
  };
}

interface EventsContent {
  ch3TruckVibration: EventCardDefinition;
}

interface QuizContent {
  ch3FieldCheck: QuizDefinition;
}

const BALANCE = balanceJson as unknown as BalanceContent;
const STRINGS = stringsJson as ChapterThreeStrings;
const EVENTS = eventsJson as unknown as EventsContent;
const QUIZ = quizJson as QuizContent;

const FACT_BY_ID: Record<string, keyof ChapterThreeStrings['ch3']['facts']> = {
  'ch3-czochralski': 'czochralski',
  'ch3-round-wafers': 'roundWafers',
  'ch3-diamond-wire': 'diamondWire'
};

const INGOT_TOP = 176;
const INGOT_BOTTOM = 526;
const SLICE_X = 220;
const SLICE_Y = 382;
const SLICE_WIDTH = 700;

export class Ch3CrystalScene extends Phaser.Scene {
  private chapter = createInitialChapterThreeState();
  private cleanupCallbacks: Array<() => void> = [];
  private hud: MountedPipelineHud | undefined;
  private globalPanels: GlobalPanelController | undefined;
  private overlay: MountedChapterThreeOverlay | undefined;
  private dialogue: MountedDialogue | undefined;
  private factCard: MountedFactCard | undefined;
  private eventCard: MountedEventCard | undefined;
  private quiz: MountedModal | undefined;
  private completion: MountedModal | undefined;
  private worldGraphics: Phaser.GameObjects.Graphics | undefined;
  private sliceGuideZones: Phaser.GameObjects.Zone[] = [];
  private pendingFactIds: string[] = [];
  private pulling = false;
  private pausedForOverlay = false;
  private lastMessage: TextModeText | null = STRINGS.ch3.messages.pullHint;

  constructor() {
    super(SceneKey.Ch3Crystal);
  }

  create(): void {
    gameStore.enterScene(SceneKey.Ch3Crystal, 3);
    this.chapter = createInitialChapterThreeState();
    this.drawBackdrop();
    this.mountDom();
    this.showIntroDialogue();
    this.redrawCrystal();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer));
    this.input.on('pointerup', () => this.handlePointerUp());
    this.input.on('pointerupoutside', () => this.handlePointerUp());

    this.time.addEvent({
      delay: BALANCE.ch3.tickSeconds * 1000,
      loop: true,
      callback: () => this.tickPullStage(BALANCE.ch3.tickSeconds)
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
      stage: 3,
      resources: this.resources,
      textMode: this.textMode,
      labels: STRINGS.hud,
      moduleNav: moduleNavOptions(this, 3),
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

    this.overlay = mountChapterThreeOverlay(uiRoot, this.overlayOptions());
    this.cleanupCallbacks.push(this.overlay.cleanup);
    this.emitDebugProgress();
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x07121f);
    this.add.rectangle(640, 604, 1280, 232, 0x10283a);
    this.add.rectangle(640, 352, 980, 392, 0x0c2030, 0.82);

    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x9bf6ff, 0.1);
    for (let x = 150; x <= 1130; x += 84) {
      graphics.lineBetween(x, 220, x + 26, 552);
    }
    graphics.fillStyle(0x38bdf8, 0.1);
    graphics.fillCircle(1016, 186, 92);
    graphics.fillStyle(0xa78bfa, 0.1);
    graphics.fillCircle(190, 196, 72);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.pausedForOverlay || this.quiz || this.completion) {
      return;
    }

    if (this.chapter.stage === 'pull') {
      this.pulling = true;
      this.lastMessage = null;
      this.refreshOverlay();
      return;
    }

    if (this.chapter.stage === 'slice') {
      this.handleSlicePointer(pointer);
    }
  }

  private handlePointerUp(): void {
    if (!this.pulling) {
      return;
    }

    this.pulling = false;
    this.refreshOverlay();
  }

  private tickPullStage(seconds: number): void {
    if (this.pausedForOverlay || this.quiz || this.completion) {
      return;
    }

    this.syncChapterProgressFromStore();
    if (this.chapter.stage === 'complete') {
      this.redrawCrystal();
      this.refreshOverlay();
      if (gameStore.getState().chapters.ch3.completed) {
        this.showCompletion();
      } else {
        this.showQuiz();
      }
      return;
    }

    if (this.chapter.stage !== 'pull') {
      this.redrawCrystal();
      this.refreshOverlay();
      return;
    }

    const multiplier = debugCatchUpMultiplier(
      3,
      this.chapter.elapsedSeconds,
      this.progressRatio(),
      BALANCE.ch3.pacingTargetSeconds
    );
    const result = tickCrystalPull(this.chapter, this.resources, this.pulling, seconds, BALANCE.ch3, {
      growthMultiplier: multiplier
    });
    if (result.blockedReason) {
      this.lastMessage = STRINGS.ch3.messages.insufficientEnergyWater;
      this.refreshOverlay();
      return;
    }

    const wasPullStage = this.chapter.stage === 'pull';
    this.chapter = result.chapter;
    this.replaceResources(result.resources);
    this.persistChapterProgress(false);

    if (this.chapter.pullSeconds > 0) {
      this.queueFact('ch3-czochralski');
    }

    if (wasPullStage && this.chapter.stage === 'slice') {
      this.pulling = false;
      this.lastMessage = STRINGS.ch3.messages.sliceHint;
      this.queueFact('ch3-round-wafers');
      this.queueFact('ch3-diamond-wire');
      this.redrawCrystal();
      this.refreshOverlay();
      this.showNextPendingFact();
      return;
    }

    this.redrawCrystal();
    this.refreshOverlay();

    if (this.showNextPendingFact()) {
      return;
    }

    this.maybeTriggerEvents();
  }

  private handleSlicePointer(pointer: Phaser.Input.Pointer): void {
    if (pointer.x < SLICE_X - 30 || pointer.x > SLICE_X + SLICE_WIDTH + 30) {
      return;
    }

    const position = ((pointer.x - SLICE_X) / SLICE_WIDTH) * 100;
    const result = sliceIngot(this.chapter, position, BALANCE.ch3);
    this.chapter = result.chapter;

    if (result.alreadyCut) {
      this.lastMessage = STRINGS.ch3.messages.alreadyCut;
    } else if (result.missedGuide) {
      this.lastMessage = STRINGS.ch3.messages.missedGuide;
    } else if (result.discardedFlawed) {
      this.lastMessage = STRINGS.ch3.messages.flawedDiscard;
    } else {
      this.lastMessage = STRINGS.ch3.messages.sliceHint;
    }

    this.persistChapterProgress(false);
    this.redrawCrystal();
    this.refreshOverlay();

    if (getSliceStageStatus(this.chapter, BALANCE.ch3).complete) {
      const completed = completeSliceStage(this.chapter, this.resources, BALANCE.ch3, BALANCE.resources.caps);
      this.chapter = completed.chapter;
      this.replaceResources(completed.resources);
      this.persistChapterProgress(false);
      this.refreshOverlay();
      this.showQuiz();
    }
  }

  private maybeTriggerEvents(): boolean {
    if (this.chapter.triggeredEvents.includes(EVENTS.ch3TruckVibration.id)) {
      return false;
    }

    const triggerHeight = BALANCE.ch3.eventTriggers?.vibrationAtHeight ?? 35;
    if (this.chapter.ingotHeight < triggerHeight) {
      return false;
    }

    this.showEventCard(EVENTS.ch3TruckVibration);
    return true;
  }

  private redrawCrystal(): void {
    this.worldGraphics?.destroy();
    this.sliceGuideZones.splice(0).forEach((zone) => zone.destroy());

    const graphics = this.add.graphics();
    this.worldGraphics = graphics;

    if (this.chapter.stage === 'slice' || this.chapter.stage === 'complete') {
      this.drawSliceStage(graphics);
      return;
    }

    this.drawPullStage(graphics);
  }

  private drawPullStage(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x07121f, 0.66);
    graphics.fillRoundedRect(312, 178, 430, 408, 18);
    graphics.lineStyle(2, 0xd8f3dc, 0.18);
    graphics.strokeRoundedRect(312, 178, 430, 408, 18);

    graphics.fillStyle(0x22313f, 1);
    graphics.fillRoundedRect(404, 446, 246, 92, 34);
    graphics.fillStyle(0xff8c61, 0.92);
    graphics.fillEllipse(527, 446, 254, 72);
    graphics.fillStyle(0xfff7d6, 0.24);
    graphics.fillEllipse(527, 438, 152, 28);

    const height = (this.chapter.ingotHeight / BALANCE.ch3.targetIngotHeight) * (INGOT_BOTTOM - INGOT_TOP);
    const ingotTop = INGOT_BOTTOM - height;
    const width = 42 + this.chapter.quality * 34;

    graphics.lineStyle(4, 0x9bf6ff, 0.42);
    graphics.lineBetween(527, 116, 527, ingotTop);
    graphics.fillStyle(0xd6f6ef, 0.95);
    graphics.fillRoundedRect(527 - width / 2, ingotTop, width, height + 10, 18);
    graphics.lineStyle(3, 0x38bdf8, 0.62);
    graphics.strokeRoundedRect(527 - width / 2, ingotTop, width, height + 10, 18);

    graphics.fillStyle(0xa78bfa, 1);
    graphics.fillTriangle(500, 128, 554, 128, 527, 164);

    graphics.fillStyle(0x06141f, 0.82);
    graphics.fillRoundedRect(788, 236, 140, 256, 12);
    graphics.lineStyle(2, 0xd8f3dc, 0.2);
    graphics.strokeRoundedRect(788, 236, 140, 256, 12);
    graphics.fillStyle(0x38bdf8, 0.9);
    graphics.fillRoundedRect(826, 454 - this.chapter.quality * 180, 64, this.chapter.quality * 180, 8);
  }

  private drawSliceStage(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x07121f, 0.66);
    graphics.fillRoundedRect(160, 230, 960, 310, 18);
    graphics.lineStyle(2, 0xd8f3dc, 0.18);
    graphics.strokeRoundedRect(160, 230, 960, 310, 18);

    graphics.lineStyle(4, 0x9bf6ff, 0.22);
    graphics.lineBetween(SLICE_X - 40, SLICE_Y, SLICE_X + SLICE_WIDTH + 40, SLICE_Y);

    for (const segment of this.chapter.ingotProfile) {
      const x = SLICE_X + (segment.start / 100) * SLICE_WIDTH;
      const width = ((segment.end - segment.start) / 100) * SLICE_WIDTH;
      const height = segment.width * 1.65;
      graphics.fillStyle(segment.flawed ? 0xfb7185 : 0xd6f6ef, segment.flawed ? 0.7 : 0.95);
      graphics.fillRoundedRect(x, SLICE_Y - height / 2, width - 4, height, 20);
      graphics.lineStyle(2, 0x38bdf8, 0.46);
      graphics.strokeRoundedRect(x, SLICE_Y - height / 2, width - 4, height, 20);

      const guideX = x + width / 2;
      const alreadyTried = isSegmentCut(this.chapter, segment, BALANCE.ch3);
      graphics.lineStyle(3, alreadyTried ? 0xf8d45c : 0xfff7d6, alreadyTried ? 0.85 : 0.52);
      graphics.lineBetween(guideX, SLICE_Y - 116, guideX, SLICE_Y + 116);

      const zone = this.add.zone(guideX, SLICE_Y, Math.max(40, width), 240)
        .setInteractive({ useHandCursor: true });
      this.sliceGuideZones.push(zone);
    }
  }

  private showIntroDialogue(): void {
    this.pausedForOverlay = true;
    this.dialogue?.cleanup();
    this.dialogue = mountDialogue(documentRoot(), {
      lines: jensenGuideLines(STRINGS.ch3.intro, 3),
      textMode: this.textMode,
      labels: STRINGS.sandbox.dialogueLabels,
      onComplete: () => {
        this.dialogue = undefined;
        this.pausedForOverlay = false;
      }
    });
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
      card: STRINGS.ch3.facts[factKey],
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
            scene: SceneKey.Ch3Crystal
          }
        });
      }
    });
    this.persistChapterProgress(false);
    return true;
  }

  private showEventCard(event: EventCardDefinition): void {
    this.pausedForOverlay = true;
    this.pulling = false;
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
        const result = applyEventChoice(this.resources, event, choiceId, BALANCE.resources.caps);
        const chapterAfterChoice = choiceId === 'keep-pulling'
          ? applyVibrationPenalty(this.chapter, BALANCE.ch3)
          : this.chapter;
        this.replaceResources(result.resources);
        this.chapter = {
          ...chapterAfterChoice,
          elapsedSeconds: chapterAfterChoice.elapsedSeconds + (result.choice.timePenaltySeconds ?? 0)
        };
        this.persistChapterProgress(false);
        this.eventCard?.cleanup();
        this.eventCard = undefined;
        this.pausedForOverlay = false;
        this.redrawCrystal();
        this.refreshOverlay();
        gameStore.events.emit('analytics:event', {
          name: 'event_choice',
          payload: {
            eventId: event.id,
            choiceId,
            scene: SceneKey.Ch3Crystal
          }
        });
      }
    });
  }

  private showQuiz(): void {
    this.pausedForOverlay = true;
    this.quiz?.cleanup();
    this.quiz = mountChapterThreeQuiz(documentRoot(), {
      quiz: QUIZ.ch3FieldCheck,
      labels: STRINGS.ch3.labels,
      textMode: this.textMode,
      onAnswer: (answer) => {
        gameStore.events.emit('analytics:event', {
          name: 'quiz_answer',
          payload: {
            questionId: QUIZ.ch3FieldCheck.id,
            answerId: answer.id,
            correct: answer.correct,
            scene: SceneKey.Ch3Crystal
          }
        });

        if (!answer.correct) {
          this.lastMessage = answer.explanation;
          this.quiz?.cleanup();
          this.quiz = undefined;
          this.refreshOverlay();
          window.setTimeout(() => {
            if (!this.completion) {
              this.showQuiz();
            }
          }, 1200);
          return;
        }

        this.quiz?.cleanup();
        this.quiz = undefined;
        this.lastMessage = null;
        this.persistChapterProgress(true, true);
        this.refreshOverlay();
        this.showCompletion();
      }
    });
  }

  private showCompletion(): void {
    this.quiz?.cleanup();
    this.quiz = undefined;
    removeQuizBackdrops();
    this.completion?.cleanup();
    this.completion = mountChapterThreeComplete(documentRoot(), {
      title: STRINGS.ch3.completion.title,
      body: STRINGS.ch3.completion.body,
      labels: STRINGS.ch3.labels,
      textMode: this.textMode,
      elapsedSeconds: this.chapter.elapsedSeconds,
      wafersProduced: this.chapter.wafersProduced,
      waferQuality: this.chapter.waferQuality,
      onNext: () => {
        window.location.hash = 'ch4';
        gameStore.enterScene(SceneKey.Ch4Fab, 4);
        this.scene.start(SceneKey.Ch4Fab);
      }
    });
    window.setTimeout(() => removeQuizBackdrops(), 0);
    window.setTimeout(() => removeQuizBackdrops(), 150);
  }

  private handleRetryPull(): void {
    if (!canRetryPull(this.chapter, BALANCE.ch3)) {
      return;
    }

    this.chapter = retryPull(this.chapter, BALANCE.ch3);
    this.pulling = false;
    this.lastMessage = STRINGS.ch3.messages.pullHint;
    this.persistChapterProgress(false);
    this.redrawCrystal();
    this.refreshOverlay();
  }

  private replaceResources(resources: ResourceState): void {
    gameStore.update((state) => ({
      ...state,
      resources
    }));
    this.hud?.update(resources, this.textMode);
    gameStore.saveNow();
  }

  private persistChapterProgress(completed: boolean, quizCorrect: boolean | null = null): void {
    gameStore.update((state) => ({
      ...state,
      chapters: {
        ...state.chapters,
        ch3: {
          completed: completed || state.chapters.ch3.completed,
          completedAtSeconds: completed ? Math.round(this.chapter.elapsedSeconds) : state.chapters.ch3.completedAtSeconds,
          quizCorrect: completed ? quizCorrect : state.chapters.ch3.quizCorrect,
          ingotQuality: Math.round(this.chapter.quality * 100),
          waferQuality: this.chapter.waferQuality,
          wafersProduced: this.chapter.wafersProduced,
          retryUsed: this.chapter.retryCount > 0,
          firstFacts: this.chapter.firstFacts
        }
      }
    }));
    gameStore.saveNow();
  }

  private syncChapterProgressFromStore(): void {
    const progress = gameStore.getState().chapters.ch3;
    const hasCompletedSlices = progress.wafersProduced > 0 && progress.waferQuality > 0;
    if (progress.completed || hasCompletedSlices) {
      this.chapter = {
        ...this.chapter,
        stage: 'complete',
        quality: Math.max(this.chapter.quality, progress.ingotQuality / 100),
        waferQuality: Math.max(this.chapter.waferQuality, progress.waferQuality),
        wafersProduced: Math.max(this.chapter.wafersProduced, progress.wafersProduced),
        firstFacts: [...new Set([...this.chapter.firstFacts, ...progress.firstFacts])]
      };
      return;
    }

    if (progress.waferQuality > 0) {
      const quality = Math.max(this.chapter.quality, progress.ingotQuality / 100, progress.waferQuality / 100);
      this.chapter = {
        ...this.chapter,
        stage: 'slice',
        quality,
        ingotHeight: BALANCE.ch3.targetIngotHeight,
        ingotProfile: this.chapter.ingotProfile.length > 0
          ? this.chapter.ingotProfile
          : generateIngotProfile(quality, BALANCE.ch3),
        waferQuality: Math.max(this.chapter.waferQuality, progress.waferQuality),
        wafersProduced: Math.max(this.chapter.wafersProduced, progress.wafersProduced),
        retryCount: progress.retryUsed ? Math.max(this.chapter.retryCount, 1) : this.chapter.retryCount,
        firstFacts: [...new Set([...this.chapter.firstFacts, ...progress.firstFacts])]
      };
      return;
    }

    this.chapter = {
      ...this.chapter,
      quality: Math.max(this.chapter.quality, progress.ingotQuality / 100),
      waferQuality: Math.max(this.chapter.waferQuality, progress.waferQuality),
      wafersProduced: Math.max(this.chapter.wafersProduced, progress.wafersProduced),
      retryCount: progress.retryUsed ? Math.max(this.chapter.retryCount, 1) : this.chapter.retryCount,
      firstFacts: [...new Set([...this.chapter.firstFacts, ...progress.firstFacts])]
    };
  }

  private refreshOverlay(): void {
    this.emitDebugProgress();
    this.overlay?.update(this.overlayOptions());
  }

  private emitDebugProgress(): void {
    emitDebugProgress(3, this.chapter.elapsedSeconds, this.progressRatio(), BALANCE.ch3.pacingTargetSeconds);
  }

  private progressRatio(): number {
    if (this.chapter.stage === 'complete') {
      return 1;
    }

    if (this.chapter.stage === 'slice') {
      const sliceStatus = getSliceStageStatus(this.chapter, BALANCE.ch3);
      return 0.6 + chapterProgressRatio(sliceStatus.cutSegments, Math.max(1, sliceStatus.totalSegments)) * 0.4;
    }

    return chapterProgressRatio(this.chapter.ingotHeight, BALANCE.ch3.targetIngotHeight) * 0.6;
  }

  private overlayOptions() {
    return {
      chapter: this.chapter,
      balance: BALANCE.ch3,
      labels: STRINGS.ch3.labels,
      stageNames: STRINGS.ch3.stageNames,
      textMode: this.textMode,
      message: this.lastMessage,
      pulling: this.pulling,
      onRetryPull: () => this.handleRetryPull(),
      onToggleMode: () => this.toggleTextMode(),
      onMenu: () => {
        window.location.hash = 'menu';
        this.scene.start(SceneKey.Menu);
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

  private cleanup(): void {
    for (const cleanup of this.cleanupCallbacks.splice(0)) {
      cleanup();
    }
    this.worldGraphics?.destroy();
    this.sliceGuideZones.splice(0).forEach((zone) => zone.destroy());
    this.dialogue?.cleanup();
    this.factCard?.cleanup();
    this.eventCard?.cleanup();
    this.quiz?.cleanup();
    this.completion?.cleanup();
    this.globalPanels = undefined;
    this.dialogue = undefined;
    this.factCard = undefined;
    this.eventCard = undefined;
    this.quiz = undefined;
    this.completion = undefined;
    this.hud = undefined;
    this.overlay = undefined;
  }
}

function createInitialChapterThreeState(): CrystalChapterState {
  const progress = gameStore.getState().chapters.ch3;
  return {
    ...createInitialCrystalChapter(BALANCE.ch3),
    quality: progress.ingotQuality / 100,
    waferQuality: progress.waferQuality,
    wafersProduced: progress.wafersProduced,
    retryCount: progress.retryUsed ? 1 : 0,
    firstFacts: progress.firstFacts
  };
}

function documentRoot(): HTMLElement {
  const root = document.getElementById('ui-root');
  if (!root) {
    throw new Error('Missing #ui-root element');
  }
  return root;
}

function removeQuizBackdrops(): void {
  documentRoot().querySelectorAll('.ch1-quiz-card').forEach((card) => {
    card.closest('.ch1-modal-backdrop')?.remove();
  });
}
