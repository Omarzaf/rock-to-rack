import Phaser from 'phaser';
import { playUiCue } from '../audio/soundDesign';
import balanceJson from '../content/balance.json';
import eventsJson from '../content/events.json';
import { jensenGuideLines } from '../content/guide';
import quizJson from '../content/quiz.json';
import stringsJson from '../content/strings.json';
import { addResources } from '../sim/economy';
import { applyEventChoice, type EventCardDefinition } from '../sim/events';
import {
  isGoalComplete,
  placeMiner,
  removeMinerWithRefund,
  tickMining,
  type MineDeposit,
  type MiningBalance,
  type MiningChapterState
} from '../sim/mining';
import { catchUpBonusDelta, chapterProgressRatio } from '../sim/pace';
import { gameStore } from '../state/gameStore';
import type { MineralType, ResourceState, TextMode } from '../state/types';
import {
  mountChapterCompleteOverlay,
  mountChapterOneOverlay,
  mountQuizOverlay,
  type ChapterOneLabels,
  type ChapterOneMessages,
  type MountedChapterOneOverlay,
  type MountedModal,
  type QuizDefinition
} from '../ui/chapterOneOverlay';
import { flyGemToHud } from '../ui/collectFx';
import { mountDialogue, type DialogueLabels, type DialogueLine, type MountedDialogue } from '../ui/dialogueOverlay';
import { mountEventCard, type EventCardLabels, type MountedEventCard } from '../ui/eventCardOverlay';
import { mountFactCard, type FactCardDefinition, type FactCardLabels, type MountedFactCard } from '../ui/factCard';
import { createGlobalPanelController, GLOBAL_TOOL_LABELS, type GlobalPanelController } from '../ui/globalPanels';
import { mountPipelineHud, type MountedPipelineHud, type PipelineHudLabels } from '../ui/pipelineHud';
import type { TextModeText } from '../ui/text';
import { debugCatchUpMultiplier, emitDebugProgress } from './debugProgress';
import { moduleNavOptions } from './moduleNavigation';
import { SceneKey } from './sceneKeys';

interface BalanceContent {
  resources: {
    caps: import('../sim/economy').ResourceCaps;
  };
  ch1: MiningBalance & {
    tickSeconds: number;
    eventTriggers: {
      mineFloodAtSeconds: number;
      copperSpikeAtCopper: number;
    };
    deposits: MineDeposit[];
  };
}

interface ChapterOneStrings {
  hud: PipelineHudLabels;
  sandbox: {
    dialogueLabels: DialogueLabels;
    factLabels: FactCardLabels;
    eventLabels: EventCardLabels;
  };
  ch1: {
    title: TextModeText;
    subtitle: TextModeText;
    labels: ChapterOneLabels;
    messages: ChapterOneMessages;
    depositNames: Record<MineralType, TextModeText>;
    intro: DialogueLine[];
    facts: Record<MineralType, FactCardDefinition>;
    completion: {
      title: TextModeText;
      body: TextModeText;
    };
  };
}

interface EventsContent {
  ch1MineFlood: EventCardDefinition;
  ch1CopperSpike: EventCardDefinition;
}

interface QuizContent {
  ch1FieldCheck: QuizDefinition;
}

const BALANCE = balanceJson as unknown as BalanceContent;
const STRINGS = stringsJson as ChapterOneStrings;
const EVENTS = eventsJson as unknown as EventsContent;
const QUIZ = quizJson as QuizContent;

const MINERAL_COLORS: Record<MineralType, number> = {
  quartz: 0xf8fafc,
  copper: 0xf59e0b,
  lithium: 0xfb7185,
  cobalt: 0x60a5fa,
  rareEarths: 0xa78bfa
};

const MINERALS: MineralType[] = ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'];

export class Ch1MineScene extends Phaser.Scene {
  private chapter = createInitialMiningChapter();
  private selectedDepositId: string | null = null;
  private cleanupCallbacks: Array<() => void> = [];
  private depositObjects = new Map<string, Phaser.GameObjects.Container>();
  private depositRings = new Map<string, Phaser.GameObjects.Ellipse>();
  private minerObjects = new Map<string, Phaser.GameObjects.Container>();
  private hud: MountedPipelineHud | undefined;
  private globalPanels: GlobalPanelController | undefined;
  private overlay: MountedChapterOneOverlay | undefined;
  private dialogue: MountedDialogue | undefined;
  private factCard: MountedFactCard | undefined;
  private eventCard: MountedEventCard | undefined;
  private quiz: MountedModal | undefined;
  private completion: MountedModal | undefined;
  private pendingFactMinerals: MineralType[] = [];
  private pausedForOverlay = false;
  private lastMessage: TextModeText | null = null;

  constructor() {
    super(SceneKey.Ch1Mine);
  }

  create(): void {
    gameStore.enterScene(SceneKey.Ch1Mine, 1);
    this.chapter = createInitialMiningChapter();
    this.drawTerrain();
    this.drawDeposits();
    this.drawPersistedMiners();
    this.mountDom();
    this.showIntroDialogue();

    this.time.addEvent({
      delay: BALANCE.ch1.tickSeconds * 1000,
      loop: true,
      callback: () => this.tickChapter(BALANCE.ch1.tickSeconds)
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
      stage: 1,
      resources: this.resources,
      textMode: this.textMode,
      labels: STRINGS.hud,
      moduleNav: moduleNavOptions(this, 1),
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

    this.overlay = mountChapterOneOverlay(uiRoot, this.overlayOptions());
    this.cleanupCallbacks.push(this.overlay.cleanup);
    this.emitDebugProgress();
  }

  private drawTerrain(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x071116);
    this.add.rectangle(640, 148, 1280, 296, 0x0d1d25, 1);

    const graphics = this.add.graphics();
    graphics.fillStyle(0x132d34, 1);
    fillTerrainLayer(graphics, [
      [0, 250], [170, 232], [360, 244], [560, 222], [790, 238], [1010, 218], [1280, 246],
      [1280, 330], [0, 330]
    ]);

    graphics.fillStyle(0x6a552e, 1);
    fillTerrainLayer(graphics, [
      [0, 292], [168, 284], [336, 304], [520, 286], [736, 302], [936, 286], [1130, 298], [1280, 286],
      [1280, 384], [0, 380]
    ]);

    graphics.fillStyle(0x584733, 1);
    fillTerrainLayer(graphics, [
      [0, 382], [220, 374], [450, 366], [690, 378], [930, 368], [1280, 376],
      [1280, 488], [0, 488]
    ]);

    graphics.fillStyle(0x3d352c, 1);
    fillTerrainLayer(graphics, [
      [0, 488], [210, 492], [408, 482], [640, 490], [830, 480], [1040, 492], [1280, 484],
      [1280, 590], [0, 590]
    ]);

    graphics.fillStyle(0x201f1e, 1);
    fillTerrainLayer(graphics, [
      [0, 590], [230, 584], [470, 594], [710, 586], [980, 596], [1280, 588],
      [1280, 720], [0, 720]
    ]);

    graphics.lineStyle(3, 0x071116, 0.46);
    graphics.beginPath();
    graphics.moveTo(0, 328);
    graphics.lineTo(1280, 318);
    graphics.moveTo(0, 382);
    graphics.lineTo(1280, 356);
    graphics.moveTo(0, 488);
    graphics.lineTo(1280, 488);
    graphics.moveTo(0, 590);
    graphics.lineTo(1280, 578);
    graphics.strokePath();

    graphics.lineStyle(2, 0xf7d37a, 0.16);
    for (const [startX, startY, endX, endY] of [
      [116, 332, 210, 360],
      [450, 394, 540, 370],
      [712, 500, 820, 462],
      [930, 524, 1040, 560],
      [238, 606, 330, 632],
      [1090, 348, 1184, 330]
    ] as Array<[number, number, number, number]>) {
      graphics.lineBetween(startX, startY, endX, endY);
    }

    graphics.fillStyle(0xf8d45c, 0.11);
    graphics.fillRect(0, 268, 1280, 18);
    graphics.fillStyle(0x000000, 0.18);
    graphics.fillRect(0, 330, 1280, 4);
    graphics.fillRect(0, 456, 1280, 5);
    graphics.fillRect(0, 550, 1280, 6);

    for (let index = 0; index < 90; index += 1) {
      const x = (index * 137) % 1280;
      const y = 306 + ((index * 83) % 374);
      const width = 2 + (index % 4);
      const height = 1 + (index % 3);
      this.add.rectangle(x, y, width, height, index % 5 === 0 ? 0xf8d45c : 0xd7c2a1, 0.12)
        .setRotation((index % 7) * 0.18);
    }
  }

  private drawDeposits(): void {
    for (const deposit of this.chapter.deposits) {
      this.drawDeposit(deposit);
    }
  }

  private drawDeposit(deposit: MineDeposit): void {
    const container = this.add.container(deposit.x, deposit.y);
    const color = MINERAL_COLORS[deposit.mineral];

    const glow = this.add.ellipse(0, 4, 104, 70, color, deposit.remaining > 0 ? 0.18 : 0.06);
    const ring = this.add.ellipse(0, 4, 118, 82, color, 0.04);
    ring.setStrokeStyle(3, 0xfff7d6, 0.92);
    ring.setVisible(false);
    const shadow = this.add.ellipse(0, 28, 86, 22, 0x000000, 0.26);
    container.add([glow, ring, shadow]);

    for (const [index, offset] of [[0, 0], [-18, 14], [20, 12], [2, -18]] as Array<[number, number]>) {
      const gem = this.add.polygon(
        offset,
        index,
        [0, -18, 15, -4, 9, 17, -9, 17, -15, -4],
        color,
        deposit.remaining > 0 ? 0.95 : 0.26
      );
      gem.setStrokeStyle(2, 0x061116, 0.72);
      container.add(gem);

      const shine = this.add.line(offset - 3, index - 3, -3, -8, 6, -15, 0xffffff, deposit.remaining > 0 ? 0.44 : 0.12);
      shine.setLineWidth(2);
      container.add(shine);
    }

    this.add.zone(deposit.x, deposit.y, 104, 104)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.selectDeposit(deposit.id));

    this.depositObjects.set(deposit.id, container);
    this.depositRings.set(deposit.id, ring);
  }

  private selectDeposit(depositId: string): void {
    this.selectedDepositId = depositId;
    this.lastMessage = null;
    this.refreshOverlay();
    this.highlightSelectedDeposit();
  }

  private placeSelectedMiner(): void {
    if (!this.selectedDepositId) {
      return;
    }

    const result = placeMiner(this.chapter, this.resources, this.selectedDepositId, BALANCE.ch1);
    if (!result.ok) {
      this.lastMessage = messageForReason(result.reason, STRINGS.ch1.messages);
      this.refreshOverlay();
      return;
    }

    this.chapter = result.chapter;
    this.replaceResources(result.resources);
    playUiCue('place');
    this.drawMiner(result.miner.depositId);
    this.playPlacementBurst(result.miner.depositId);
    this.persistChapterProgress(false);
    this.lastMessage = null;
    this.refreshOverlay();
  }

  private playPlacementBurst(depositId: string): void {
    const rig = this.minerObjects.get(depositId);
    const deposit = this.chapter.deposits.find((candidate) => candidate.id === depositId);
    if (!rig || !deposit || prefersReducedMotion()) {
      return;
    }

    rig.setScale(0.2);
    this.tweens.add({
      targets: rig,
      scale: 1,
      duration: 420,
      ease: 'Back.easeOut'
    });

    const pulse = this.add.ellipse(deposit.x, deposit.y + 4, 40, 28, 0xf8d45c, 0.4);
    this.tweens.add({
      targets: pulse,
      scaleX: 3.4,
      scaleY: 3.4,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => pulse.destroy()
    });
  }

  private emitCollectionGems(): void {
    const canvas = this.game.canvas;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / this.scale.gameSize.width;
    const scaleY = rect.height / this.scale.gameSize.height;

    for (const miner of this.chapter.miners) {
      const deposit = this.chapter.deposits.find((candidate) => candidate.id === miner.depositId);
      if (!deposit || deposit.remaining <= 0) {
        continue;
      }

      flyGemToHud(
        rect.left + deposit.x * scaleX,
        rect.top + (deposit.y - 40) * scaleY,
        deposit.mineral
      );
    }
  }

  private drawMiner(depositId: string): void {
    const deposit = this.chapter.deposits.find((candidate) => candidate.id === depositId);
    if (!deposit || this.minerObjects.has(depositId)) {
      return;
    }

    const rig = this.add.container(deposit.x, deposit.y - 50);
    const shadow = this.add.ellipse(0, 76, 78, 18, 0x000000, 0.22);
    const frame = this.add.graphics();
    frame.lineStyle(5, 0xfff7d6, 0.94);
    frame.beginPath();
    frame.moveTo(-30, 44);
    frame.lineTo(0, -32);
    frame.lineTo(30, 44);
    frame.moveTo(-18, 14);
    frame.lineTo(18, 14);
    frame.moveTo(0, -32);
    frame.lineTo(0, 64);
    frame.strokePath();
    frame.lineStyle(2, 0x071116, 0.65);
    frame.strokeTriangle(-30, 44, 0, -32, 30, 44);
    frame.fillStyle(0xf8d45c, 0.95);
    frame.fillCircle(0, -30, 8);
    frame.fillStyle(0x9bf6ff, 0.82);
    frame.fillRoundedRect(-4, 56, 8, 34, 4);
    rig.add([shadow, frame]);
    this.minerObjects.set(depositId, rig);
  }

  private tickChapter(seconds: number): void {
    if (this.pausedForOverlay || this.completion || this.quiz) {
      return;
    }

    const beforeFirstMined = new Set(this.chapter.firstMined);
    const multiplier = debugCatchUpMultiplier(
      1,
      this.chapter.elapsedSeconds,
      this.progressRatio(),
      BALANCE.ch1.pacingTargetSeconds
    );
    const result = tickMining(this.chapter, this.resources, seconds, BALANCE.ch1, BALANCE.resources.caps);
    const resources = multiplier > 1
      ? addResources(result.resources, catchUpBonusDelta(result.extracted, multiplier), BALANCE.resources.caps)
      : result.resources;
    this.chapter = result.chapter;
    this.replaceResources(resources);
    this.emitCollectionGems();
    this.updateDepositAlpha();
    this.persistChapterProgress(false);
    this.refreshOverlay();

    const newlyMined = this.chapter.firstMined.filter((mineral) => !beforeFirstMined.has(mineral));
    if (newlyMined.length > 0) {
      this.pendingFactMinerals.push(...newlyMined);
      this.showNextPendingFact();
      return;
    }

    if (this.maybeTriggerEvents()) {
      return;
    }

    if (isGoalComplete(this.resources, BALANCE.ch1.targetBasket)) {
      this.showQuiz();
    }
  }

  private maybeTriggerEvents(): boolean {
    if (!this.chapter.triggeredEvents.includes(EVENTS.ch1MineFlood.id)
      && this.chapter.elapsedSeconds >= BALANCE.ch1.eventTriggers.mineFloodAtSeconds) {
      this.showEventCard(EVENTS.ch1MineFlood);
      return true;
    }

    if (!this.chapter.triggeredEvents.includes(EVENTS.ch1CopperSpike.id)
      && this.resources.minerals.copper >= BALANCE.ch1.eventTriggers.copperSpikeAtCopper) {
      this.showEventCard(EVENTS.ch1CopperSpike);
      return true;
    }

    return false;
  }

  private showIntroDialogue(): void {
    this.pausedForOverlay = true;
    this.dialogue?.cleanup();
    this.dialogue = mountDialogue(documentRoot(), {
      lines: jensenGuideLines(STRINGS.ch1.intro, 1),
      textMode: this.textMode,
      labels: STRINGS.sandbox.dialogueLabels,
      onComplete: () => {
        this.dialogue = undefined;
        this.pausedForOverlay = false;
      }
    });
  }

  private showNextPendingFact(): void {
    const mineral = this.pendingFactMinerals.shift();
    if (!mineral) {
      this.pausedForOverlay = false;
      return;
    }

    this.showFactCard(mineral);
  }

  private showFactCard(mineral: MineralType): void {
    this.pausedForOverlay = true;
    this.factCard?.cleanup();
    this.factCard = mountFactCard(documentRoot(), {
      card: STRINGS.ch1.facts[mineral],
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
            scene: SceneKey.Ch1Mine,
            mineral
          }
        });
      }
    });
  }

  private showEventCard(event: EventCardDefinition): void {
    this.pausedForOverlay = true;
    this.chapter = {
      ...this.chapter,
      triggeredEvents: [...new Set([...this.chapter.triggeredEvents, event.id])]
    };
    this.persistChapterProgress(false);
    this.eventCard?.cleanup();
    this.eventCard = mountEventCard(documentRoot(), {
      event,
      textMode: this.textMode,
      labels: STRINGS.sandbox.eventLabels,
      onChoice: (choiceId) => {
        const result = applyEventChoice(this.resources, event, choiceId, BALANCE.resources.caps);
        const timePenalty = result.choice.timePenaltySeconds ?? 0;
        this.chapter = {
          ...this.chapter,
          elapsedSeconds: this.chapter.elapsedSeconds + timePenalty
        };
        this.replaceResources(result.resources);
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
            scene: SceneKey.Ch1Mine
          }
        });
      }
    });
  }

  private showQuiz(): void {
    this.pausedForOverlay = true;
    this.quiz?.cleanup();
    this.quiz = mountQuizOverlay(documentRoot(), {
      quiz: QUIZ.ch1FieldCheck,
      labels: STRINGS.ch1.labels,
      textMode: this.textMode,
      onAnswer: (answer) => {
        gameStore.events.emit('analytics:event', {
          name: 'quiz_answer',
          payload: {
            questionId: QUIZ.ch1FieldCheck.id,
            answerId: answer.id,
            correct: answer.correct,
            scene: SceneKey.Ch1Mine
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
    this.completion = mountChapterCompleteOverlay(documentRoot(), {
      title: STRINGS.ch1.completion.title,
      body: STRINGS.ch1.completion.body,
      labels: STRINGS.ch1.labels,
      textMode: this.textMode,
      elapsedSeconds: this.chapter.elapsedSeconds,
      minedCount: MINERALS.reduce((sum, mineral) => sum + Math.floor(this.resources.minerals[mineral]), 0),
      onNext: () => {
        window.location.hash = 'ch2';
        gameStore.enterScene(SceneKey.Ch2Refinery, 2);
        this.scene.start(SceneKey.Ch2Refinery);
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

  private persistChapterProgress(completed: boolean, quizCorrect: boolean | null = null): void {
    gameStore.update((state) => ({
      ...state,
      chapters: {
        ...state.chapters,
        ch1: {
          firstMined: this.chapter.firstMined,
          deposits: this.chapter.deposits,
          miners: this.chapter.miners,
          elapsedSeconds: this.chapter.elapsedSeconds,
          triggeredEvents: this.chapter.triggeredEvents,
          completed,
          completedAtSeconds: completed ? Math.round(this.chapter.elapsedSeconds) : state.chapters.ch1.completedAtSeconds,
          quizCorrect
        }
      }
    }));
    gameStore.saveNow();
  }

  private refreshOverlay(): void {
    this.emitDebugProgress();
    this.overlay?.update(this.overlayOptions());
  }

  private emitDebugProgress(): void {
    emitDebugProgress(1, this.chapter.elapsedSeconds, this.progressRatio(), BALANCE.ch1.pacingTargetSeconds);
  }

  private progressRatio(): number {
    const items = Object.entries(BALANCE.ch1.targetBasket) as Array<[MineralType, number]>;
    if (items.length === 0) {
      return 1;
    }

    const completed = items.reduce((sum, [mineral, target]) => {
      return sum + chapterProgressRatio(this.resources.minerals[mineral], target);
    }, 0);
    return completed / items.length;
  }

  private overlayOptions() {
    return {
      resources: this.resources,
      chapter: this.chapter,
      balance: BALANCE.ch1,
      labels: STRINGS.ch1.labels,
      depositNames: STRINGS.ch1.depositNames,
      selectedDeposit: this.selectedDeposit(),
      message: this.lastMessage,
      textMode: this.textMode,
      onPlaceMiner: () => this.placeSelectedMiner(),
      onRemoveMiner: () => this.removeSelectedMiner(),
      onToggleMode: () => this.toggleTextMode(),
      onMenu: () => {
        window.location.hash = 'menu';
        this.scene.start(SceneKey.Menu);
      }
    };
  }

  private selectedDeposit(): MineDeposit | null {
    if (!this.selectedDepositId) {
      return null;
    }

    return this.chapter.deposits.find((deposit) => deposit.id === this.selectedDepositId) ?? null;
  }

  private removeSelectedMiner(): void {
    if (!this.selectedDepositId) {
      return;
    }

    const result = removeMinerWithRefund(this.chapter, this.resources, this.selectedDepositId, BALANCE.ch1, BALANCE.resources.caps);
    if (!result.ok) {
      return;
    }

    this.chapter = result.chapter;
    this.replaceResources(result.resources);
    this.minerObjects.get(this.selectedDepositId)?.destroy();
    this.minerObjects.delete(this.selectedDepositId);
    this.persistChapterProgress(false);
    this.refreshOverlay();
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

  private highlightSelectedDeposit(): void {
    for (const [depositId, object] of this.depositObjects.entries()) {
      object.setScale(depositId === this.selectedDepositId ? 1.18 : 1);
      this.depositRings.get(depositId)?.setVisible(depositId === this.selectedDepositId);
    }
  }

  private updateDepositAlpha(): void {
    for (const deposit of this.chapter.deposits) {
      const object = this.depositObjects.get(deposit.id);
      if (object) {
        object.setAlpha(deposit.remaining > 0 ? 1 : 0.36);
      }
    }
  }

  private drawPersistedMiners(): void {
    for (const miner of this.chapter.miners) {
      this.drawMiner(miner.depositId);
    }
  }

  private cleanup(): void {
    for (const cleanup of this.cleanupCallbacks.splice(0)) {
      cleanup();
    }
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

function createInitialMiningChapter(): MiningChapterState {
  const progress = gameStore.getState().chapters.ch1;
  return {
    deposits: progress.deposits.map((deposit) => ({ ...deposit })),
    miners: progress.miners.map((miner) => ({ ...miner })),
    firstMined: [...progress.firstMined],
    elapsedSeconds: progress.elapsedSeconds,
    triggeredEvents: [...progress.triggeredEvents]
  };
}

function fillTerrainLayer(graphics: Phaser.GameObjects.Graphics, points: Array<[number, number]>): void {
  const [firstPoint, ...remainingPoints] = points;
  graphics.beginPath();
  graphics.moveTo(firstPoint[0], firstPoint[1]);
  for (const [x, y] of remainingPoints) {
    graphics.lineTo(x, y);
  }
  graphics.closePath();
  graphics.fillPath();
}

function messageForReason(
  reason: Exclude<ReturnType<typeof placeMiner>, { ok: true }>['reason'],
  messages: ChapterOneMessages
): TextModeText {
  if (reason === 'insufficient-resources') {
    return messages.insufficientResources;
  }

  if (reason === 'slot-limit') {
    return messages.slotLimit;
  }

  if (reason === 'already-mined') {
    return messages.alreadyMined;
  }

  if (reason === 'deposit-depleted') {
    return messages.depositDepleted;
  }

  return messages.depositNotFound;
}

function documentRoot(): HTMLElement {
  const root = document.getElementById('ui-root');
  if (!root) {
    throw new Error('Missing #ui-root element');
  }

  return root;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
