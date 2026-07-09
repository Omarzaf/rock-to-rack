import Phaser from 'phaser';
import balanceJson from '../content/balance.json';
import eventsJson from '../content/events.json';
import { jensenGuideLines } from '../content/guide';
import quizJson from '../content/quiz.json';
import stringsJson from '../content/strings.json';
import { applyEventChoice, type EventCardDefinition } from '../sim/events';
import {
  applyFabEventPenalty,
  completeFabWafer,
  createInitialFabChapter,
  generateDieMap,
  scoreCoatStation,
  scoreDopeStation,
  scoreEtchStation,
  scoreExposeStation,
  type FabBalance,
  type FabChapterState,
  type FabDie,
  type FabNodeBalance,
  type FabStage,
  type FabStationScores
} from '../sim/fab';
import { addResources, type ResourceCaps } from '../sim/economy';
import { chapterProgressRatio } from '../sim/pace';
import { gameStore } from '../state/gameStore';
import type { ResourceState, TextMode } from '../state/types';
import {
  mountChapterFourComplete,
  mountChapterFourOverlay,
  mountChapterFourQuiz,
  type ChapterFourLabels,
  type MountedChapterFourOverlay
} from '../ui/chapterFourOverlay';
import { mountDialogue, type DialogueLabels, type DialogueLine, type MountedDialogue } from '../ui/dialogueOverlay';
import { mountEventCard, type EventCardLabels, type MountedEventCard } from '../ui/eventCardOverlay';
import { mountFactCard, type FactCardDefinition, type FactCardLabels, type MountedFactCard } from '../ui/factCard';
import { createGlobalPanelController, GLOBAL_TOOL_LABELS, type GlobalPanelController } from '../ui/globalPanels';
import { mountPipelineHud, type MountedPipelineHud, type PipelineHudLabels } from '../ui/pipelineHud';
import type { MountedModal, QuizDefinition } from '../ui/chapterOneOverlay';
import type { TextModeText } from '../ui/text';
import { emitDebugProgress } from './debugProgress';
import { moduleNavOptions } from './moduleNavigation';
import { SceneKey } from './sceneKeys';

interface BalanceContent {
  resources: {
    caps: ResourceCaps;
  };
  ch4: FabBalance;
}

interface ChapterFourStrings {
  hud: PipelineHudLabels;
  sandbox: {
    dialogueLabels: DialogueLabels;
    factLabels: FactCardLabels;
    eventLabels: EventCardLabels;
  };
  ch4: {
    labels: ChapterFourLabels;
    stageNames: Record<FabStage, TextModeText>;
    messages: Record<
      | 'coatHint'
      | 'exposeHint'
      | 'etchHint'
      | 'dopeHint'
      | 'reviewHint'
      | 'needAction'
      | 'dustPenalty'
      | 'calibrationPenalty',
      TextModeText
    >;
    intro: DialogueLine[];
    facts: Record<'bunnySuits' | 'dustSpeck' | 'euvAsml', FactCardDefinition>;
    completion: {
      title: TextModeText;
      body: TextModeText;
    };
  };
}

interface EventsContent {
  ch4DustContamination: EventCardDefinition;
  ch4ToolCalibration: EventCardDefinition;
}

interface QuizContent {
  ch4FieldCheck: QuizDefinition;
}

const BALANCE = balanceJson as unknown as BalanceContent;
const STRINGS = stringsJson as ChapterFourStrings;
const EVENTS = eventsJson as unknown as EventsContent;
const QUIZ = quizJson as QuizContent;

const FACT_BY_ID: Record<string, keyof ChapterFourStrings['ch4']['facts']> = {
  'ch4-bunny-suits': 'bunnySuits',
  'ch4-dust-speck': 'dustSpeck',
  'ch4-euv-asml': 'euvAsml'
};

const WAFER_X = 548;
const WAFER_Y = 382;
const WAFER_RADIUS = 128;
const MASK_TARGET_X = 548;
const MASK_TARGET_Y = 382;
const DIE_CELL = 32;
const DOPE_ZONES = [
  { id: 'blue', x: WAFER_X - 62, y: WAFER_Y - 42, color: 0x38bdf8 },
  { id: 'gold', x: WAFER_X + 58, y: WAFER_Y - 44, color: 0xf8d45c },
  { id: 'pink', x: WAFER_X - 48, y: WAFER_Y + 54, color: 0xfb7185 },
  { id: 'green', x: WAFER_X + 54, y: WAFER_Y + 50, color: 0x60d394 }
] as const;

export class Ch4FabScene extends Phaser.Scene {
  private chapter = createInitialFabChapterState();
  private cleanupCallbacks: Array<() => void> = [];
  private hud: MountedPipelineHud | undefined;
  private globalPanels: GlobalPanelController | undefined;
  private overlay: MountedChapterFourOverlay | undefined;
  private dialogue: MountedDialogue | undefined;
  private factCard: MountedFactCard | undefined;
  private eventCard: MountedEventCard | undefined;
  private quiz: MountedModal | undefined;
  private completion: MountedModal | undefined;
  private worldGraphics: Phaser.GameObjects.Graphics | undefined;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private pendingFactIds: string[] = [];
  private pausedForOverlay = false;
  private draggingCoat = false;
  private draggingExpose = false;
  private etching = false;
  private stationLocked = false;
  private coatCells = new Set<string>();
  private exposeOffset = { x: 42, y: -30 };
  private etchHeldSeconds = 0;
  private dopeMatches = 0;
  private dopeMisses = 0;
  private dopeAttempts = 0;
  private lastDieMap: FabDie[] = [];
  private lastMessage: TextModeText | null = STRINGS.ch4.messages.coatHint;
  private activeScore = 0;
  private currentYield = 0;

  constructor() {
    super(SceneKey.Ch4Fab);
  }

  create(): void {
    gameStore.enterScene(SceneKey.Ch4Fab, 4);
    this.chapter = createInitialFabChapterState();
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.drawBackdrop();
    this.mountDom();
    this.showIntroDialogue();
    this.enterCurrentStage();
    this.redrawFab();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer));
    this.input.on('pointerup', () => this.handlePointerUp());
    this.input.on('pointerupoutside', () => this.handlePointerUp());

    this.time.addEvent({
      delay: BALANCE.ch4.tickSeconds * 1000,
      loop: true,
      callback: () => this.tickFab(BALANCE.ch4.tickSeconds)
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  update(_time: number, delta: number): void {
    if (this.pausedForOverlay || this.quiz || this.completion || this.chapter.stage !== 'expose' || this.stationLocked) {
      return;
    }

    const step = Math.max(1, delta / 16.67) * 1.8;
    if (this.cursors?.left?.isDown) {
      this.exposeOffset.x -= step;
    }
    if (this.cursors?.right?.isDown) {
      this.exposeOffset.x += step;
    }
    if (this.cursors?.up?.isDown) {
      this.exposeOffset.y -= step;
    }
    if (this.cursors?.down?.isDown) {
      this.exposeOffset.y += step;
    }

    this.exposeOffset.x = clamp(this.exposeOffset.x + Math.sin(this.time.now / 760) * 0.06, -92, 92);
    this.exposeOffset.y = clamp(this.exposeOffset.y + Math.cos(this.time.now / 880) * 0.05, -92, 92);
    this.activeScore = scoreExposeStation({ distance: exposeDistance(this.exposeOffset) }, BALANCE.ch4, this.currentNode());
    this.currentYield = this.estimateYield();
    this.redrawFab();
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
      stage: 4,
      resources: this.resources,
      textMode: this.textMode,
      labels: STRINGS.hud,
      moduleNav: moduleNavOptions(this, 4),
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

    this.overlay = mountChapterFourOverlay(uiRoot, this.overlayOptions());
    this.cleanupCallbacks.push(this.overlay.cleanup);
    this.emitDebugProgress();
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x07121f);
    this.add.rectangle(640, 590, 1280, 260, 0x10283a);
    this.add.rectangle(640, 354, 980, 396, 0x0b1b2a, 0.86);

    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xd8f3dc, 0.1);
    for (let x = 162; x <= 1120; x += 72) {
      graphics.lineBetween(x, 220, x + 18, 552);
    }
    graphics.fillStyle(0xf8d45c, 0.1);
    graphics.fillCircle(230, 194, 72);
    graphics.fillStyle(0x38bdf8, 0.1);
    graphics.fillCircle(1018, 184, 88);
  }

  private tickFab(seconds: number): void {
    if (this.pausedForOverlay || this.quiz || this.completion) {
      return;
    }

    this.chapter = {
      ...this.chapter,
      elapsedSeconds: this.chapter.elapsedSeconds + seconds
    };

    if (this.etching && this.chapter.stage === 'etch' && !this.stationLocked) {
      this.etchHeldSeconds += seconds;
      this.activeScore = scoreEtchStation({ heldSeconds: this.etchHeldSeconds }, BALANCE.ch4);
      this.currentYield = this.estimateYield();
      this.redrawFab();
      this.refreshOverlay();
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.pausedForOverlay || this.quiz || this.completion) {
      return;
    }

    if (this.chapter.stage === 'coat' && pointInWafer(pointer.x, pointer.y)) {
      this.draggingCoat = true;
      this.markCoat(pointer.x, pointer.y);
      return;
    }

    if (this.chapter.stage === 'expose' && pointInFabArea(pointer.x, pointer.y)) {
      this.draggingExpose = true;
      this.moveMask(pointer.x, pointer.y);
      return;
    }

    if (this.chapter.stage === 'etch' && pointInBath(pointer.x, pointer.y) && !this.stationLocked) {
      this.etching = true;
      return;
    }

    if (this.chapter.stage === 'dope' && !this.stationLocked) {
      this.handleDopeClick(pointer.x, pointer.y);
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.pausedForOverlay || this.quiz || this.completion) {
      return;
    }

    if (this.draggingCoat && this.chapter.stage === 'coat') {
      this.markCoat(pointer.x, pointer.y);
      return;
    }

    if (this.draggingExpose && this.chapter.stage === 'expose' && !this.stationLocked) {
      this.moveMask(pointer.x, pointer.y);
    }
  }

  private handlePointerUp(): void {
    if (this.draggingCoat) {
      this.draggingCoat = false;
    }

    if (this.draggingExpose) {
      this.draggingExpose = false;
    }

    if (this.etching && this.chapter.stage === 'etch' && !this.stationLocked) {
      this.etching = false;
      this.activeScore = scoreEtchStation({ heldSeconds: this.etchHeldSeconds }, BALANCE.ch4);
      this.lockScore('etch', this.activeScore);
      this.currentYield = this.estimateYield();
      this.redrawFab();
      this.refreshOverlay();
    }
  }

  private markCoat(x: number, y: number): void {
    if (!pointInWafer(x, y)) {
      return;
    }

    const cellX = Math.floor((x - (WAFER_X - WAFER_RADIUS)) / 24);
    const cellY = Math.floor((y - (WAFER_Y - WAFER_RADIUS)) / 24);
    this.coatCells.add(`${cellX}:${cellY}`);
    const coverage = clamp(this.coatCells.size / 84, 0, 1);
    const evenness = clamp(1 - Math.abs(0.72 - coverage) * 0.9, 0.25, 1);
    this.activeScore = scoreCoatStation({ coverage, evenness }, BALANCE.ch4);
    this.currentYield = this.estimateYield();
    this.chapter = {
      ...this.chapter,
      stationScores: {
        ...this.chapter.stationScores,
        coat: this.activeScore
      }
    };
    this.redrawFab();
    this.refreshOverlay();
  }

  private moveMask(x: number, y: number): void {
    this.exposeOffset = {
      x: clamp(x - MASK_TARGET_X, -92, 92),
      y: clamp(y - MASK_TARGET_Y, -92, 92)
    };
    this.activeScore = scoreExposeStation({ distance: exposeDistance(this.exposeOffset) }, BALANCE.ch4, this.currentNode());
    this.currentYield = this.estimateYield();
    this.redrawFab();
    this.refreshOverlay();
  }

  private handleDopeClick(x: number, y: number): void {
    const zone = DOPE_ZONES.find((candidate) => Phaser.Math.Distance.Between(x, y, candidate.x, candidate.y) <= 42);
    if (!zone) {
      return;
    }

    const expected = DOPE_ZONES[this.dopeAttempts]?.id;
    if (zone.id === expected) {
      this.dopeMatches += 1;
    } else {
      this.dopeMisses += 1;
    }
    this.dopeAttempts += 1;
    this.activeScore = scoreDopeStation({ matches: this.dopeMatches, misses: this.dopeMisses }, BALANCE.ch4);
    this.currentYield = this.estimateYield();

    if (this.dopeAttempts >= BALANCE.ch4.stations.dope.zonesRequired) {
      this.lockScore('dope', this.activeScore);
    }

    this.redrawFab();
    this.refreshOverlay();
  }

  private onFlash(): void {
    if (this.chapter.stage !== 'expose' || this.stationLocked) {
      return;
    }

    this.activeScore = scoreExposeStation({ distance: exposeDistance(this.exposeOffset) }, BALANCE.ch4, this.currentNode());
    this.lockScore('expose', this.activeScore);
    this.currentYield = this.estimateYield();
    this.redrawFab();
    this.refreshOverlay();
  }

  private advanceStation(): void {
    if (!this.canAdvanceStation()) {
      this.lastMessage = STRINGS.ch4.messages.needAction;
      this.refreshOverlay();
      return;
    }

    if (this.chapter.stage === 'coat') {
      this.lockScore('coat', Math.max(1, this.activeScore));
      this.chapter = { ...this.chapter, stage: 'expose' };
    } else if (this.chapter.stage === 'expose') {
      this.chapter = { ...this.chapter, stage: 'etch' };
    } else if (this.chapter.stage === 'etch') {
      this.chapter = { ...this.chapter, stage: 'dope' };
    } else if (this.chapter.stage === 'dope') {
      this.completeCurrentWafer();
      return;
    }

    this.enterCurrentStage();
    this.persistChapterProgress(false);
    this.redrawFab();
    this.refreshOverlay();
    this.maybeTriggerEvents();
  }

  private completeCurrentWafer(): void {
    const node = this.currentNode();
    const result = completeFabWafer(this.chapter, this.chapter.stationScores, BALANCE.ch4, node);
    this.lastDieMap = result.dieMap;
    this.chapter = {
      ...result.chapter,
      stage: result.chapter.stage === 'complete' ? 'complete' : 'review'
    };
    this.replaceResources(addResources(this.resources, { chips: result.chipsProduced }, BALANCE.resources.caps));
    this.currentYield = result.nodeYield.yieldPercent;
    this.activeScore = result.nodeYield.yieldPercent;
    this.lastMessage = STRINGS.ch4.messages.reviewHint;
    this.queueFact('ch4-dust-speck');
    if (node.id === '7nm') {
      this.queueFact('ch4-euv-asml');
    }
    this.persistChapterProgress(false);
    this.redrawFab();
    this.refreshOverlay();
    this.showNextPendingFact();
  }

  private nextWafer(): void {
    if (this.chapter.stage === 'complete') {
      this.showQuiz();
      return;
    }

    if (this.chapter.stage !== 'review') {
      return;
    }

    this.chapter = {
      ...this.chapter,
      stage: 'coat'
    };
    this.enterCurrentStage();
    this.persistChapterProgress(false);
    this.redrawFab();
    this.refreshOverlay();
    this.maybeTriggerEvents();
  }

  private lockScore(stage: keyof FabStationScores, score: number): void {
    this.stationLocked = true;
    this.chapter = {
      ...this.chapter,
      stationScores: {
        ...this.chapter.stationScores,
        [stage]: Math.round(score)
      }
    };
  }

  private enterCurrentStage(): void {
    this.draggingCoat = false;
    this.draggingExpose = false;
    this.etching = false;
    this.stationLocked = false;

    if (this.chapter.stage === 'coat') {
      this.coatCells.clear();
      this.activeScore = this.chapter.stationScores.coat;
      this.currentYield = this.estimateYield();
      this.lastMessage = STRINGS.ch4.messages.coatHint;
      this.queueFact('ch4-bunny-suits');
      this.showNextPendingFact();
      return;
    }

    if (this.chapter.stage === 'expose') {
      this.exposeOffset = { x: 42 - this.chapter.currentWaferIndex * 12, y: -30 + this.chapter.currentWaferIndex * 8 };
      this.activeScore = scoreExposeStation({ distance: exposeDistance(this.exposeOffset) }, BALANCE.ch4, this.currentNode());
      this.currentYield = this.estimateYield();
      this.lastMessage = STRINGS.ch4.messages.exposeHint;
      return;
    }

    if (this.chapter.stage === 'etch') {
      this.etchHeldSeconds = 0;
      this.activeScore = 0;
      this.currentYield = this.estimateYield();
      this.lastMessage = STRINGS.ch4.messages.etchHint;
      return;
    }

    if (this.chapter.stage === 'dope') {
      this.dopeMatches = 0;
      this.dopeMisses = 0;
      this.dopeAttempts = 0;
      this.activeScore = 0;
      this.currentYield = this.estimateYield();
      this.lastMessage = STRINGS.ch4.messages.dopeHint;
      return;
    }

    this.lastMessage = STRINGS.ch4.messages.reviewHint;
  }

  private maybeTriggerEvents(): boolean {
    if (this.pausedForOverlay || this.chapter.stage === 'review' || this.chapter.stage === 'complete') {
      return false;
    }

    if (
      this.chapter.currentWaferIndex === BALANCE.ch4.eventTriggers?.dustAtWaferIndex
      && !this.chapter.triggeredEvents.includes('dust')
    ) {
      this.showEventCard(EVENTS.ch4DustContamination, 'dust');
      return true;
    }

    if (
      this.chapter.currentWaferIndex === BALANCE.ch4.eventTriggers?.calibrationAtWaferIndex
      && !this.chapter.triggeredEvents.includes('calibration')
    ) {
      this.showEventCard(EVENTS.ch4ToolCalibration, 'calibration');
      return true;
    }

    return false;
  }

  private showEventCard(event: EventCardDefinition, penaltyType: 'dust' | 'calibration'): void {
    this.pausedForOverlay = true;
    this.eventCard?.cleanup();
    this.eventCard = mountEventCard(documentRoot(), {
      event,
      textMode: this.textMode,
      labels: STRINGS.sandbox.eventLabels,
      onChoice: (choiceId) => {
        const result = applyEventChoice(this.resources, event, choiceId, BALANCE.resources.caps);
        this.replaceResources(result.resources);
        const applyPenalty = choiceId === 'risk-the-run' || choiceId === 'push-through';
        this.chapter = {
          ...(applyPenalty ? applyFabEventPenalty(this.chapter, penaltyType, BALANCE.ch4) : this.chapter),
          elapsedSeconds: this.chapter.elapsedSeconds + (result.choice.timePenaltySeconds ?? 0),
          triggeredEvents: [...new Set([...this.chapter.triggeredEvents, penaltyType])]
        };
        this.lastMessage = penaltyType === 'dust' && applyPenalty
          ? STRINGS.ch4.messages.dustPenalty
          : penaltyType === 'calibration' && applyPenalty
            ? STRINGS.ch4.messages.calibrationPenalty
            : this.lastMessage;
        this.persistChapterProgress(false);
        this.eventCard?.cleanup();
        this.eventCard = undefined;
        this.pausedForOverlay = false;
        this.redrawFab();
        this.refreshOverlay();
        gameStore.events.emit('analytics:event', {
          name: 'event_choice',
          payload: {
            eventId: event.id,
            choiceId,
            scene: SceneKey.Ch4Fab
          }
        });
      }
    });
  }

  private redrawFab(): void {
    this.worldGraphics?.destroy();
    const graphics = this.add.graphics();
    this.worldGraphics = graphics;

    if (this.chapter.stage === 'coat') {
      this.drawCoatStage(graphics);
      return;
    }
    if (this.chapter.stage === 'expose') {
      this.drawExposeStage(graphics);
      return;
    }
    if (this.chapter.stage === 'etch') {
      this.drawEtchStage(graphics);
      return;
    }
    if (this.chapter.stage === 'dope') {
      this.drawDopeStage(graphics);
      return;
    }
    this.drawReviewStage(graphics);
  }

  private drawStageShell(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x07121f, 0.72);
    graphics.fillRoundedRect(168, 218, 774, 344, 18);
    graphics.lineStyle(2, 0xd8f3dc, 0.18);
    graphics.strokeRoundedRect(168, 218, 774, 344, 18);
  }

  private drawWafer(graphics: Phaser.GameObjects.Graphics, tint = 0xd6f6ef): void {
    graphics.fillStyle(tint, 0.96);
    graphics.fillCircle(WAFER_X, WAFER_Y, WAFER_RADIUS);
    graphics.lineStyle(4, 0x38bdf8, 0.38);
    graphics.strokeCircle(WAFER_X, WAFER_Y, WAFER_RADIUS);
    graphics.lineStyle(1, 0x07121f, 0.14);
    for (let x = WAFER_X - 92; x <= WAFER_X + 92; x += 46) {
      graphics.lineBetween(x, WAFER_Y - 102, x, WAFER_Y + 102);
    }
    for (let y = WAFER_Y - 92; y <= WAFER_Y + 92; y += 46) {
      graphics.lineBetween(WAFER_X - 104, y, WAFER_X + 104, y);
    }
  }

  private drawCoatStage(graphics: Phaser.GameObjects.Graphics): void {
    this.drawStageShell(graphics);
    this.drawWafer(graphics);
    graphics.fillStyle(0x38bdf8, 0.32);
    for (const key of this.coatCells) {
      const [cellX, cellY] = key.split(':').map(Number);
      const x = WAFER_X - WAFER_RADIUS + cellX * 24 + 12;
      const y = WAFER_Y - WAFER_RADIUS + cellY * 24 + 12;
      if (pointInWafer(x, y)) {
        graphics.fillCircle(x, y, 18);
      }
    }
    graphics.lineStyle(5, 0x7dd3fc, 0.84);
    graphics.lineBetween(WAFER_X - 174, WAFER_Y - 150, WAFER_X + 86, WAFER_Y - 150);
    graphics.fillStyle(0x7dd3fc, 0.9);
    graphics.fillRoundedRect(WAFER_X + 76, WAFER_Y - 166, 120, 34, 10);
  }

  private drawExposeStage(graphics: Phaser.GameObjects.Graphics): void {
    this.drawStageShell(graphics);
    this.drawWafer(graphics, 0xe0f2fe);
    graphics.lineStyle(2, 0xf8d45c, 0.8);
    graphics.lineBetween(MASK_TARGET_X - 146, MASK_TARGET_Y, MASK_TARGET_X + 146, MASK_TARGET_Y);
    graphics.lineBetween(MASK_TARGET_X, MASK_TARGET_Y - 146, MASK_TARGET_X, MASK_TARGET_Y + 146);

    const maskX = MASK_TARGET_X + this.exposeOffset.x;
    const maskY = MASK_TARGET_Y + this.exposeOffset.y;
    graphics.fillStyle(0x17202a, 0.5);
    graphics.fillRoundedRect(maskX - 138, maskY - 100, 276, 200, 12);
    graphics.lineStyle(4, 0xa78bfa, 0.92);
    graphics.strokeRoundedRect(maskX - 138, maskY - 100, 276, 200, 12);
    graphics.lineStyle(2, 0x9bf6ff, 0.7);
    for (let x = maskX - 90; x <= maskX + 90; x += 45) {
      graphics.lineBetween(x, maskY - 74, x, maskY + 74);
    }
    for (let y = maskY - 60; y <= maskY + 60; y += 40) {
      graphics.lineBetween(maskX - 110, y, maskX + 110, y);
    }
  }

  private drawEtchStage(graphics: Phaser.GameObjects.Graphics): void {
    this.drawStageShell(graphics);
    graphics.fillStyle(0x0f766e, 0.74);
    graphics.fillRoundedRect(WAFER_X - 204, WAFER_Y + 56, 408, 118, 22);
    graphics.fillStyle(0x60d394, 0.22);
    graphics.fillEllipse(WAFER_X, WAFER_Y + 58, 410, 52);
    const dunk = clamp(this.etchHeldSeconds / BALANCE.ch4.stations.etch.targetSeconds, 0, 1);
    this.drawWafer(graphics, 0xd6f6ef);
    graphics.fillStyle(0x60d394, 0.26 + dunk * 0.24);
    graphics.fillCircle(WAFER_X, WAFER_Y + 24 + dunk * 44, WAFER_RADIUS);
    graphics.lineStyle(4, 0xf8d45c, 0.8);
    const targetX = WAFER_X - 170 + (BALANCE.ch4.stations.etch.targetSeconds / 5) * 340;
    graphics.lineBetween(targetX, WAFER_Y + 202, targetX, WAFER_Y + 236);
    graphics.fillStyle(0xd8f3dc, 0.22);
    graphics.fillRoundedRect(WAFER_X - 170, WAFER_Y + 210, 340, 14, 999);
    graphics.fillStyle(0xf8d45c, 0.84);
    graphics.fillRoundedRect(WAFER_X - 170, WAFER_Y + 210, clamp(this.etchHeldSeconds / 5, 0, 1) * 340, 14, 999);
  }

  private drawDopeStage(graphics: Phaser.GameObjects.Graphics): void {
    this.drawStageShell(graphics);
    this.drawWafer(graphics, 0xf8fafc);
    DOPE_ZONES.forEach((zone, index) => {
      const attempted = index < this.dopeAttempts;
      graphics.fillStyle(zone.color, attempted ? 0.92 : 0.48);
      graphics.fillCircle(zone.x, zone.y, 42);
      graphics.lineStyle(3, attempted ? 0xfff7d6 : 0x17202a, attempted ? 0.85 : 0.26);
      graphics.strokeCircle(zone.x, zone.y, 42);
    });
  }

  private drawReviewStage(graphics: Phaser.GameObjects.Graphics): void {
    this.drawStageShell(graphics);
    const totalWidth = BALANCE.ch4.dieGrid.columns * DIE_CELL;
    const totalHeight = BALANCE.ch4.dieGrid.rows * DIE_CELL;
    const startX = WAFER_X - totalWidth / 2;
    const startY = WAFER_Y - totalHeight / 2;
    graphics.fillStyle(0xd6f6ef, 0.95);
    graphics.fillCircle(WAFER_X, WAFER_Y, WAFER_RADIUS + 18);
    graphics.lineStyle(4, 0x38bdf8, 0.42);
    graphics.strokeCircle(WAFER_X, WAFER_Y, WAFER_RADIUS + 18);

    const map = this.lastDieMap.length > 0
      ? this.lastDieMap
      : generateDieMap(this.currentYield, BALANCE.ch4, this.currentNode().id);
    for (const die of map) {
      const x = startX + die.x * DIE_CELL;
      const y = startY + die.y * DIE_CELL;
      graphics.fillStyle(die.good ? 0x60d394 : 0xfb7185, die.good ? 0.92 : 0.86);
      graphics.fillRoundedRect(x + 2, y + 2, DIE_CELL - 4, DIE_CELL - 4, 5);
      graphics.lineStyle(1, 0x07121f, 0.28);
      graphics.strokeRoundedRect(x + 2, y + 2, DIE_CELL - 4, DIE_CELL - 4, 5);
    }
  }

  private currentNode(): FabNodeBalance {
    return BALANCE.ch4.nodes[Math.min(this.chapter.currentWaferIndex, BALANCE.ch4.nodes.length - 1)];
  }

  private estimateYield(): number {
    const scores = this.chapter.stationScores;
    const stationAverage = (scores.coat + scores.expose + scores.etch + scores.dope + this.activeScore) / 5;
    return Math.round(clamp((this.chapter.waferQuality * 0.42) + (stationAverage * 0.58), 0, 100));
  }

  private canAdvanceStation(): boolean {
    if (this.chapter.stage === 'coat') {
      return this.activeScore > 0;
    }
    if (this.chapter.stage === 'expose' || this.chapter.stage === 'etch' || this.chapter.stage === 'dope') {
      return this.stationLocked;
    }
    return false;
  }

  private showIntroDialogue(): void {
    this.pausedForOverlay = true;
    this.dialogue?.cleanup();
    this.dialogue = mountDialogue(documentRoot(), {
      lines: jensenGuideLines(STRINGS.ch4.intro, 4),
      textMode: this.textMode,
      labels: STRINGS.sandbox.dialogueLabels,
      onComplete: () => {
        this.dialogue = undefined;
        this.pausedForOverlay = false;
        this.showNextPendingFact();
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
      card: STRINGS.ch4.facts[factKey],
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
            scene: SceneKey.Ch4Fab
          }
        });
      }
    });
    this.persistChapterProgress(false);
    return true;
  }

  private showQuiz(): void {
    this.pausedForOverlay = true;
    this.quiz?.cleanup();
    this.quiz = mountChapterFourQuiz(documentRoot(), {
      quiz: QUIZ.ch4FieldCheck,
      labels: STRINGS.ch4.labels,
      textMode: this.textMode,
      onAnswer: (answer) => {
        gameStore.events.emit('analytics:event', {
          name: 'quiz_answer',
          payload: {
            questionId: QUIZ.ch4FieldCheck.id,
            answerId: answer.id,
            correct: answer.correct,
            scene: SceneKey.Ch4Fab
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
    const summary = this.progressSummary();
    this.completion = mountChapterFourComplete(documentRoot(), {
      title: STRINGS.ch4.completion.title,
      body: STRINGS.ch4.completion.body,
      labels: STRINGS.ch4.labels,
      textMode: this.textMode,
      elapsedSeconds: this.chapter.elapsedSeconds,
      chipsProduced: this.chapter.chipsProduced,
      averageYield: summary.averageYield,
      bestYield: summary.bestYield,
      onNext: () => {
        window.location.hash = 'ch5';
        gameStore.enterScene(SceneKey.Ch5Package, 5);
        this.scene.start(SceneKey.Ch5Package);
      }
    });
    window.setTimeout(() => removeQuizBackdrops(), 0);
    window.setTimeout(() => removeQuizBackdrops(), 150);
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
    const summary = this.progressSummary();
    gameStore.update((state) => ({
      ...state,
      chapters: {
        ...state.chapters,
        ch4: {
          completed: completed || state.chapters.ch4.completed,
          completedAtSeconds: completed ? Math.round(this.chapter.elapsedSeconds) : state.chapters.ch4.completedAtSeconds,
          quizCorrect: completed ? quizCorrect : state.chapters.ch4.quizCorrect,
          wafersProcessed: this.chapter.nodeYields.length,
          averageYield: summary.averageYield,
          bestYield: summary.bestYield,
          chipsProduced: this.chapter.chipsProduced,
          nodeYields: this.chapter.nodeYields,
          firstFacts: this.chapter.firstFacts
        }
      }
    }));
    gameStore.saveNow();
  }

  private progressSummary(): { averageYield: number; bestYield: number } {
    if (this.chapter.nodeYields.length === 0) {
      return { averageYield: 0, bestYield: 0 };
    }

    const yields = this.chapter.nodeYields.map((nodeYield) => nodeYield.yieldPercent);
    return {
      averageYield: Math.round(yields.reduce((total, value) => total + value, 0) / yields.length),
      bestYield: Math.max(...yields)
    };
  }

  private refreshOverlay(): void {
    this.emitDebugProgress();
    this.overlay?.update(this.overlayOptions());
  }

  private emitDebugProgress(): void {
    emitDebugProgress(4, this.chapter.elapsedSeconds, this.progressRatio(), BALANCE.ch4.pacingTargetSeconds);
  }

  private progressRatio(): number {
    return chapterProgressRatio(this.chapter.nodeYields.length, BALANCE.ch4.wafersRequired);
  }

  private overlayOptions() {
    return {
      chapter: this.chapter,
      balance: BALANCE.ch4,
      labels: STRINGS.ch4.labels,
      stageNames: STRINGS.ch4.stageNames,
      textMode: this.textMode,
      message: this.lastMessage,
      currentYield: this.currentYield,
      activeScore: this.activeScore,
      canFlash: this.chapter.stage === 'expose' && !this.stationLocked,
      canAdvanceStation: this.canAdvanceStation(),
      canNextWafer: this.chapter.stage === 'review' || this.chapter.stage === 'complete',
      onFlash: () => this.onFlash(),
      onAdvanceStation: () => this.advanceStation(),
      onNextWafer: () => this.nextWafer(),
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
    this.dialogue?.cleanup();
    this.factCard?.cleanup();
    this.eventCard?.cleanup();
    this.quiz?.cleanup();
    this.completion?.cleanup();
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

function createInitialFabChapterState(): FabChapterState {
  const state = gameStore.getState();
  const progress = state.chapters.ch4;
  const chapter = createInitialFabChapter(BALANCE.ch4, state.chapters.ch3.waferQuality);
  if (progress.completed || progress.wafersProcessed >= BALANCE.ch4.wafersRequired) {
    return {
      ...chapter,
      stage: 'complete',
      currentWaferIndex: BALANCE.ch4.wafersRequired,
      nodeYields: progress.nodeYields,
      chipsProduced: progress.chipsProduced,
      firstFacts: progress.firstFacts
    };
  }

  return {
    ...chapter,
    currentWaferIndex: progress.wafersProcessed,
    nodeYields: progress.nodeYields,
    chipsProduced: progress.chipsProduced,
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

function pointInWafer(x: number, y: number): boolean {
  return Phaser.Math.Distance.Between(x, y, WAFER_X, WAFER_Y) <= WAFER_RADIUS;
}

function pointInFabArea(x: number, y: number): boolean {
  return x >= 260 && x <= 820 && y >= 240 && y <= 536;
}

function pointInBath(x: number, y: number): boolean {
  return x >= WAFER_X - 220 && x <= WAFER_X + 220 && y >= WAFER_Y - 40 && y <= WAFER_Y + 190;
}

function exposeDistance(offset: { x: number; y: number }): number {
  return Math.sqrt(offset.x ** 2 + offset.y ** 2);
}

function removeQuizBackdrops(): void {
  documentRoot().querySelectorAll('.ch1-quiz-card').forEach((card) => {
    card.closest('.ch1-modal-backdrop')?.remove();
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
