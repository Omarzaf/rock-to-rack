import Phaser from 'phaser';
import balanceJson from '../content/balance.json';
import chipsJson from '../content/chips.json';
import eventsJson from '../content/events.json';
import { jensenGuideLines } from '../content/guide';
import quizJson from '../content/quiz.json';
import stringsJson from '../content/strings.json';
import { applyEventChoice, type EventCardDefinition } from '../sim/events';
import {
  applyPackageEvent,
  buildChip,
  canBuildChip,
  createInitialPackageChapter,
  sortTestDie,
  type ChipDefinition,
  type PackageBalance,
  type PackageChapterState,
  type PackageStage,
  type TestDie
} from '../sim/package';
import { chapterProgressRatio } from '../sim/pace';
import { gameStore } from '../state/gameStore';
import type { ChipTypeId, DieBinId, ResourceState, TextMode } from '../state/types';
import {
  mountChapterFiveComplete,
  mountChapterFiveOverlay,
  mountChapterFiveQuiz,
  type ChapterFiveLabels,
  type MountedChapterFiveOverlay
} from '../ui/chapterFiveOverlay';
import { mountDialogue, type DialogueLabels, type DialogueLine, type MountedDialogue } from '../ui/dialogueOverlay';
import { mountEventCard, type EventCardLabels, type MountedEventCard } from '../ui/eventCardOverlay';
import { mountFactCard, type FactCardDefinition, type FactCardLabels, type MountedFactCard } from '../ui/factCard';
import { createGlobalPanelController, GLOBAL_TOOL_LABELS, type GlobalPanelController } from '../ui/globalPanels';
import { mountPipelineHud, type MountedPipelineHud, type PipelineHudLabels } from '../ui/pipelineHud';
import type { MountedModal, QuizDefinition } from '../ui/chapterOneOverlay';
import type { TextModeText } from '../ui/text';
import { textForMode } from '../ui/text';
import { cycleIndex, digitToIndex, isActivationKey, isInteractiveElementFocused, isReplayInterruptKey } from './chapterKeyboard';
import { emitDebugProgress } from './debugProgress';
import { moduleNavOptions } from './moduleNavigation';
import { SceneKey } from './sceneKeys';

interface BalanceContent {
  resources: {
    caps: import('../sim/economy').ResourceCaps;
  };
  ch5: PackageBalance;
}

interface ChapterFiveStrings {
  hud: PipelineHudLabels;
  sandbox: {
    dialogueLabels: DialogueLabels;
    factLabels: FactCardLabels;
    eventLabels: EventCardLabels;
  };
  ch5: {
    title: TextModeText;
    subtitle: TextModeText;
    labels: ChapterFiveLabels;
    stageNames: Record<PackageStage, TextModeText>;
    messages: Record<
      | 'diceHint'
      | 'sortHint'
      | 'correctSort'
      | 'wrongSort'
      | 'rosterHint'
      | 'maxChoices'
      | 'cantAfford'
      | 'novaLocked'
      | 'probePenalty'
      | 'substratePenalty',
      TextModeText
    >;
    intro: DialogueLine[];
    facts: Record<'packaging' | 'binning' | 'chipRoster', FactCardDefinition>;
    completion: {
      title: TextModeText;
      body: TextModeText;
    };
  };
}

interface EventsContent {
  ch5ProbeDrift: EventCardDefinition;
  ch5SubstrateShortage: EventCardDefinition;
}

interface QuizContent {
  ch5FieldCheck: QuizDefinition;
}

const BALANCE = balanceJson as unknown as BalanceContent;
const STRINGS = stringsJson as ChapterFiveStrings;
const EVENTS = eventsJson as unknown as EventsContent;
const QUIZ = quizJson as QuizContent;
const CHIP_LIST = chipsJson as unknown as ChipDefinition[];
const CHIP_BY_ID = new Map(CHIP_LIST.map((chip) => [chip.id, chip] as const));

const FACT_BY_ID: Record<string, keyof ChapterFiveStrings['ch5']['facts']> = {
  'ch5-packaging': 'packaging',
  'ch5-binning': 'binning',
  'ch5-chip-roster': 'chipRoster'
};

const BIN_COLORS: Record<DieBinId, number> = {
  perfect: 0xf8d45c,
  good: 0x60d394,
  salvage: 0xfb7185
};

const WAFER = { x: 336, y: 318, radius: 126 };
const CHUTE = { x: 620, y: 330 };
const BIN_LAYOUT = [
  { id: 'perfect' as const, x: 874, y: 294 },
  { id: 'good' as const, x: 1030, y: 294 },
  { id: 'salvage' as const, x: 1186, y: 294 }
];
const CHIP_CARD_LAYOUT = [
  { x: 720, y: 472 },
  { x: 862, y: 472 },
  { x: 1004, y: 472 },
  { x: 1146, y: 472 },
  { x: 790, y: 560 },
  { x: 932, y: 560 },
  { x: 1074, y: 560 }
];
const CHIP_CARD_SIZE = { width: 130, height: 74 };

export class Ch5PackageScene extends Phaser.Scene {
  private chapter = createInitialPackageChapter(BALANCE.ch5, [], 0);
  private cleanupCallbacks: Array<() => void> = [];
  private hud: MountedPipelineHud | undefined;
  private globalPanels: GlobalPanelController | undefined;
  private overlay: MountedChapterFiveOverlay | undefined;
  private dialogue: MountedDialogue | undefined;
  private factCard: MountedFactCard | undefined;
  private eventCard: MountedEventCard | undefined;
  private quiz: MountedModal | undefined;
  private completion: MountedModal | undefined;
  private worldLayer: Phaser.GameObjects.Container | undefined;
  private cardZones: Phaser.GameObjects.Zone[] = [];
  private pendingFactIds: string[] = [];
  private pausedForOverlay = false;
  private introInterruptible = false;
  private keyboardHandler: ((event: KeyboardEvent) => void) | undefined;
  private waferDiced = false;
  private selectedChipId: ChipTypeId | null = null;
  private lastMessage: TextModeText | null = null;
  private quizRetryTimeout: number | undefined;

  constructor() {
    super(SceneKey.Ch5Package);
  }

  create(): void {
    gameStore.enterScene(SceneKey.Ch5Package, 5);
    this.chapter = createChapterFiveState();
    this.resetTransientState();
    this.drawBackdrop();
    this.worldLayer = this.add.container(0, 0);
    this.mountDom();
    this.bindKeyboard();
    this.showIntroDialogue();
    this.redrawWorld();

    this.time.addEvent({
      delay: BALANCE.ch5.tickSeconds * 1000,
      loop: true,
      callback: () => this.tickChapter(BALANCE.ch5.tickSeconds)
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
      stage: 5,
      resources: this.resources,
      textMode: this.textMode,
      labels: STRINGS.hud,
      moduleNav: moduleNavOptions(this, 5),
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

    this.overlay = mountChapterFiveOverlay(uiRoot, this.overlayOptions());
    this.cleanupCallbacks.push(this.overlay.cleanup);
    this.emitDebugProgress();
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x06111d);
    this.add.rectangle(640, 350, 1280, 410, 0x0a1f2c, 0.88);
    this.add.rectangle(640, 612, 1280, 216, 0x11283a, 1);

    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x9bf6ff, 0.08);
    for (let x = 120; x <= 1180; x += 78) {
      graphics.lineBetween(x, 188, x + 24, 580);
    }
    graphics.fillStyle(0xf8d45c, 0.1);
    graphics.fillCircle(160, 170, 72);
    graphics.fillStyle(0x60d394, 0.1);
    graphics.fillCircle(1100, 164, 86);
  }

  private tickChapter(seconds: number): void {
    if (this.pausedForOverlay || this.quiz || this.completion || this.dialogue) {
      return;
    }

    this.chapter = {
      ...this.chapter,
      elapsedSeconds: this.chapter.elapsedSeconds + seconds
    };
  }

  private redrawWorld(): void {
    if (!this.worldLayer) {
      return;
    }

    this.worldLayer.removeAll(true);
    this.cardZones.splice(0).forEach((zone) => zone.destroy());

    const graphics = this.add.graphics();
    this.worldLayer?.add(graphics);

    this.drawWaferStage(graphics);
    this.drawChute(graphics);
    this.drawBins(graphics);
    this.drawDieStacks(graphics);
    this.drawChipRoster(graphics);
  }

  private drawWaferStage(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0xe7f7ef, 0.96);
    graphics.fillCircle(WAFER.x, WAFER.y, WAFER.radius);
    graphics.lineStyle(4, 0x9bf6ff, 0.28);
    graphics.strokeCircle(WAFER.x, WAFER.y, WAFER.radius);
    graphics.lineStyle(1, 0x06111d, 0.14);

    for (let x = WAFER.x - 86; x <= WAFER.x + 86; x += 34) {
      graphics.lineBetween(x, WAFER.y - 92, x, WAFER.y + 92);
    }
    for (let y = WAFER.y - 86; y <= WAFER.y + 86; y += 34) {
      graphics.lineBetween(WAFER.x - 94, y, WAFER.x + 94, y);
    }

    graphics.fillStyle(0x0a1f2c, 0.82);
    graphics.fillRoundedRect(WAFER.x - 82, WAFER.y - 18, 164, 36, 18);
    graphics.fillRoundedRect(WAFER.x - 18, WAFER.y - 82, 36, 164, 18);
    graphics.lineStyle(2, 0xf8d45c, 0.36);
    graphics.strokeRoundedRect(WAFER.x - 82, WAFER.y - 18, 164, 36, 18);
    graphics.strokeRoundedRect(WAFER.x - 18, WAFER.y - 82, 36, 164, 18);

    graphics.fillStyle(0xf8d45c, 0.16);
    graphics.fillRoundedRect(176, 286, 112, 18, 9);
    graphics.fillRoundedRect(162, 336, 142, 18, 9);

    const title = this.add.text(186, 264, textForMode(STRINGS.ch5.labels.cutWafer, this.textMode), {
      color: '#fff7d6',
      fontFamily: 'Nunito, system-ui',
      fontSize: '14px',
      fontStyle: '700'
    });
    this.worldLayer?.add(title);

    const blade = this.add.graphics();
    blade.fillStyle(0x9bf6ff, 0.72);
    blade.fillRoundedRect(194, 304, 150, 12, 6);
    blade.lineStyle(2, 0x17202a, 0.52);
    blade.strokeRoundedRect(194, 304, 150, 12, 6);
    blade.fillStyle(0x17202a, 0.44);
    blade.fillTriangle(330, 288, 356, 310, 330, 332);
    blade.lineStyle(2, 0xf8d45c, 0.24);
    blade.lineBetween(176, 325, 348, 325);
    this.worldLayer?.add(blade);

    if (this.chapter.stage === 'dice') {
      const hint = this.add.text(190, 356, textForMode(STRINGS.ch5.messages.diceHint, this.textMode), {
        color: '#d6f6ef',
        fontFamily: 'Nunito, system-ui',
        fontSize: '14px',
        wordWrap: { width: 250 }
      });
      this.worldLayer?.add(hint);
    }
  }

  private drawChute(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x0a1f2c, 0.96);
    graphics.fillRoundedRect(CHUTE.x - 36, CHUTE.y - 20, 188, 34, 16);
    graphics.lineStyle(2, 0x9bf6ff, 0.14);
    graphics.strokeRoundedRect(CHUTE.x - 36, CHUTE.y - 20, 188, 34, 16);
    graphics.fillStyle(0xf8d45c, 0.12);
    graphics.fillTriangle(CHUTE.x - 18, CHUTE.y - 2, CHUTE.x + 82, CHUTE.y - 52, CHUTE.x + 96, CHUTE.y - 42);
    graphics.fillTriangle(CHUTE.x + 76, CHUTE.y - 50, CHUTE.x + 154, CHUTE.y - 6, CHUTE.x + 166, CHUTE.y - 20);
  }

  private drawBins(graphics: Phaser.GameObjects.Graphics): void {
    for (const bin of BIN_LAYOUT) {
      graphics.fillStyle(0x0b1d2d, 0.92);
      graphics.fillRoundedRect(bin.x, bin.y, 122, 106, 14);
      graphics.lineStyle(2, BIN_COLORS[bin.id], 0.28);
      graphics.strokeRoundedRect(bin.x, bin.y, 122, 106, 14);
      graphics.fillStyle(BIN_COLORS[bin.id], 0.16);
      graphics.fillRoundedRect(bin.x + 8, bin.y + 8, 106, 20, 10);
      const label = this.add.text(bin.x + 14, bin.y + 9, textForMode(STRINGS.ch5.labels[bin.id], this.textMode), {
        color: '#fff7d6',
        fontFamily: 'Nunito, system-ui',
        fontSize: '12px',
        fontStyle: '700'
      });
      const count = this.add.text(bin.x + 14, bin.y + 34, String(this.chapter.bins[bin.id]), {
        color: '#f8fafc',
        fontFamily: 'Nunito, system-ui',
        fontSize: '24px',
        fontStyle: '900'
      });
      this.worldLayer?.add(label);
      this.worldLayer?.add(count);
    }
  }

  private drawDieStacks(graphics: Phaser.GameObjects.Graphics): void {
    const sortedDies = this.chapter.testDies.filter((die) => die.sorted);
    const stackedCounts: Record<DieBinId, number> = { perfect: 0, good: 0, salvage: 0 };

    for (const die of sortedDies) {
      const bin = die.actualBin ?? 'salvage';
      const base = BIN_LAYOUT.find((entry) => entry.id === bin);
      if (!base) {
        continue;
      }

      const index = stackedCounts[bin];
      stackedCounts[bin] += 1;
      const x = base.x + 14 + (index % 3) * 28;
      const y = base.y + 62 + Math.floor(index / 3) * 22;
      this.drawDieCard(graphics, die, x, y, 22, 18, BIN_COLORS[bin], true);
    }

    if (this.chapter.stage === 'sort') {
      const die = this.activeDie();
      if (die) {
        this.drawDieCard(graphics, die, 484, 258, 88, 110, 0x9bf6ff, false);
        const note = this.add.text(448, 382, `${textForMode(STRINGS.ch5.labels.score, this.textMode)} ${Math.round(die.testScore)}`, {
          color: '#fff7d6',
          fontFamily: 'Nunito, system-ui',
          fontSize: '13px',
          fontStyle: '800'
        });
        this.worldLayer?.add(note);
      }
    }
  }

  private drawDieCard(
    graphics: Phaser.GameObjects.Graphics,
    die: TestDie,
    x: number,
    y: number,
    width: number,
    height: number,
    tint: number,
    compact: boolean
  ): void {
    graphics.fillStyle(tint, compact ? 0.42 : 0.86);
    graphics.fillRoundedRect(x, y, width, height, 6);
    graphics.lineStyle(2, compact ? 0x17202a : tint, compact ? 0.5 : 0.9);
    graphics.strokeRoundedRect(x, y, width, height, 6);
    graphics.fillStyle(0xffffff, 0.12);
    graphics.fillRoundedRect(x + 4, y + 4, Math.max(6, width - 8), 6, 3);

    const score = this.add.text(x + 3, y + (compact ? 4 : 10), `${Math.round(die.testScore)}`, {
      color: '#fff7d6',
      fontFamily: 'Nunito, system-ui',
      fontSize: compact ? '10px' : '16px',
      fontStyle: '900'
    });
    const node = this.add.text(x + 3, y + (compact ? 14 : 34), die.node, {
      color: '#d6f6ef',
      fontFamily: 'Nunito, system-ui',
      fontSize: compact ? '8px' : '11px',
      fontStyle: '700'
    });
    this.worldLayer?.add(score);
    this.worldLayer?.add(node);
  }

  private drawChipRoster(graphics: Phaser.GameObjects.Graphics): void {
    if (this.chapter.stage !== 'roster' && this.chapter.stage !== 'complete') {
      return;
    }

    const selectedId = this.selectedChipId ?? this.chapter.selectedChipIds[this.chapter.selectedChipIds.length - 1] ?? null;
    for (const [index, chip] of CHIP_LIST.entries()) {
      const position = CHIP_CARD_LAYOUT[index];
      if (!position) {
        continue;
      }

      const selected = selectedId === chip.id;
      const built = this.chapter.selectedChipIds.includes(chip.id);
      const buildable = canBuildChip(this.chapter, chip, BALANCE.ch5.maxBuildChoices);

      graphics.fillStyle(parseColor(chip.cardColor), built ? 0.88 : 0.76);
      graphics.fillRoundedRect(position.x, position.y, CHIP_CARD_SIZE.width, CHIP_CARD_SIZE.height, 12);
      graphics.lineStyle(2, selected ? 0xf8d45c : 0x17202a, selected ? 0.96 : 0.6);
      graphics.strokeRoundedRect(position.x, position.y, CHIP_CARD_SIZE.width, CHIP_CARD_SIZE.height, 12);
      graphics.fillStyle(0x06111d, 0.26);
      graphics.fillRoundedRect(position.x + 8, position.y + 8, CHIP_CARD_SIZE.width - 16, 18, 8);

      const title = this.add.text(position.x + 10, position.y + 8, textForMode(chip.name, this.textMode), {
        color: '#fff7d6',
        fontFamily: 'Nunito, system-ui',
        fontSize: '14px',
        fontStyle: '900'
      });
      const nickname = this.add.text(position.x + 10, position.y + 28, textForMode(chip.nickname, this.textMode), {
        color: '#17202a',
        fontFamily: 'Nunito, system-ui',
        fontSize: '10px',
        fontStyle: '800'
      });
      const hint = this.add.text(position.x + 10, position.y + 44, textForMode(chip.ch6Hint, this.textMode), {
        color: '#f8fafc',
        fontFamily: 'Nunito, system-ui',
        fontSize: '9px',
        wordWrap: { width: 112 }
      });

      const costRow = this.add.graphics();
      costRow.fillStyle(0xf8d45c, 0.86);
      costRow.fillCircle(position.x + 20, position.y + 68, 4);
      costRow.fillStyle(0x60d394, 0.86);
      costRow.fillCircle(position.x + 48, position.y + 68, 4);
      costRow.fillStyle(0xfb7185, 0.86);
      costRow.fillCircle(position.x + 76, position.y + 68, 4);

      const costLabels = [
        this.add.text(position.x + 28, position.y + 62, String(chip.cost.perfect), chipCostTextStyle()),
        this.add.text(position.x + 56, position.y + 62, String(chip.cost.good), chipCostTextStyle()),
        this.add.text(position.x + 84, position.y + 62, String(chip.cost.salvage), chipCostTextStyle())
      ];

      const badge = this.add.text(position.x + 94, position.y + 8, built ? '■' : selected ? '●' : buildable ? '○' : '×', {
        color: selected ? '#f8d45c' : buildable ? '#d6f6ef' : '#fb7185',
        fontFamily: 'Nunito, system-ui',
        fontSize: '14px',
        fontStyle: '900'
      });

      this.worldLayer?.add(title);
      this.worldLayer?.add(nickname);
      this.worldLayer?.add(hint);
      this.worldLayer?.add(costRow);
      this.worldLayer?.add(badge);
      for (const costLabel of costLabels) {
        this.worldLayer?.add(costLabel);
      }

      const zone = this.add.zone(
        position.x + CHIP_CARD_SIZE.width / 2,
        position.y + CHIP_CARD_SIZE.height / 2,
        CHIP_CARD_SIZE.width,
        CHIP_CARD_SIZE.height
      )
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectChip(chip.id));
      this.cardZones.push(zone);
    }
  }

  private selectChip(chipId: ChipTypeId): void {
    if (this.chapter.stage !== 'roster') {
      return;
    }

    this.selectedChipId = chipId;
    this.refreshOverlay();
    this.redrawWorld();
  }

  private cutWafer(): void {
    if (!this.canCutWafer()) {
      return;
    }

    this.waferDiced = true;
    this.queueFact('ch5-packaging');
    this.lastMessage = STRINGS.ch5.messages.sortHint;
    this.redrawWorld();
    this.refreshOverlay();
    this.showNextPendingFact();
  }

  private startSorting(): void {
    if (!this.canStartSort()) {
      return;
    }

    this.chapter = {
      ...this.chapter,
      stage: 'sort'
    };
    this.queueFact('ch5-binning');
    this.lastMessage = STRINGS.ch5.messages.sortHint;
    this.persistChapterProgress(false);
    this.redrawWorld();
    this.refreshOverlay();
    this.showNextPendingFact();
  }

  private sortCurrentDie(bin: DieBinId): void {
    if (this.chapter.stage !== 'sort' || this.pausedForOverlay) {
      return;
    }

    const activeDie = this.activeDie();
    if (!activeDie) {
      return;
    }

    const result = sortTestDie(this.chapter, activeDie.id, bin, BALANCE.ch5);
    this.chapter = result.chapter;
    this.lastMessage = result.sortedDie?.actualBin === activeDie.expectedBin
      ? STRINGS.ch5.messages.correctSort
      : STRINGS.ch5.messages.wrongSort;
    this.persistChapterProgress(false);
    this.redrawWorld();
    this.refreshOverlay();

    if (this.maybeTriggerEvents()) {
      return;
    }

    if (this.chapter.stage === 'roster') {
      this.enterRosterStage();
    }
  }

  private enterRosterStage(): void {
    this.selectedChipId = this.firstBuildableChipId() ?? CHIP_LIST[0]?.id ?? null;
    this.queueFact('ch5-chip-roster');
    this.lastMessage = STRINGS.ch5.messages.rosterHint;
    this.persistChapterProgress(false);
    this.redrawWorld();
    this.refreshOverlay();
    this.showNextPendingFact();
  }

  private buildSelectedChip(): void {
    if (this.chapter.stage !== 'roster' || !this.selectedChipId) {
      return;
    }

    const chip = CHIP_BY_ID.get(this.selectedChipId);
    if (!chip) {
      return;
    }

    const result = buildChip(this.chapter, chip, BALANCE.ch5.maxBuildChoices);
    if (!result.ok) {
      this.lastMessage = buildFailureMessage(result.reason, STRINGS.ch5.messages);
      this.refreshOverlay();
      return;
    }

    this.chapter = result.chapter;
    this.lastMessage = null;
    this.persistChapterProgress(false);
    this.redrawWorld();
    this.refreshOverlay();

    if (this.maybeTriggerEvents()) {
      return;
    }
  }

  private maybeTriggerEvents(): boolean {
    if (this.pausedForOverlay) {
      return false;
    }

    const probeTarget = BALANCE.ch5.eventTriggers?.probeDriftAtSortedCount ?? Number.POSITIVE_INFINITY;
    if (!this.chapter.triggeredEvents.includes('probeDrift') && this.chapter.sortedCount >= probeTarget) {
      this.showEventCard(EVENTS.ch5ProbeDrift, 'probeDrift');
      return true;
    }

    const substrateTarget = BALANCE.ch5.eventTriggers?.substrateShortageAtBuiltCount ?? Number.POSITIVE_INFINITY;
    if (!this.chapter.triggeredEvents.includes('substrateShortage') && this.chapter.builtChips.length >= substrateTarget) {
      this.showEventCard(EVENTS.ch5SubstrateShortage, 'substrateShortage');
      return true;
    }

    return false;
  }

  private showIntroDialogue(): void {
    this.pausedForOverlay = true;
    this.introInterruptible = gameStore.getState().chapters.ch5.completed;
    this.dialogue?.cleanup();
    this.dialogue = mountDialogue(documentRoot(), {
      lines: jensenGuideLines(STRINGS.ch5.intro, 5),
      textMode: this.textMode,
      labels: STRINGS.sandbox.dialogueLabels,
      onComplete: () => {
        this.dialogue = undefined;
        this.pausedForOverlay = false;
        if (this.chapter.stage === 'complete') {
          this.showCompletion();
          return;
        }
        this.showNextPendingFact();
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

      if (this.chapter.stage === 'dice') {
        this.handleDiceKeyboard(event);
        return;
      }

      if (this.chapter.stage === 'sort') {
        this.handleSortKeyboard(event);
        return;
      }

      if (this.chapter.stage === 'roster') {
        this.handleRosterKeyboard(event);
      }
    };

    this.input.keyboard?.on('keydown', this.keyboardHandler);
  }

  private handleDiceKeyboard(event: KeyboardEvent): void {
    if (isActivationKey(event) || event.key === 'c' || event.key === 'C') {
      event.preventDefault();
      if (this.canCutWafer()) {
        this.cutWafer();
      } else if (this.canStartSort()) {
        this.startSorting();
      }
      return;
    }

    if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      this.startSorting();
    }
  }

  private handleSortKeyboard(event: KeyboardEvent): void {
    const bins: DieBinId[] = ['perfect', 'good', 'salvage'];
    const digitIndex = digitToIndex(event.key, bins.length);
    if (digitIndex !== null) {
      event.preventDefault();
      this.sortCurrentDie(bins[digitIndex]);
      return;
    }

    if (event.key === 'p' || event.key === 'P') {
      event.preventDefault();
      this.sortCurrentDie('perfect');
      return;
    }

    if (event.key === 'g' || event.key === 'G') {
      event.preventDefault();
      this.sortCurrentDie('good');
      return;
    }

    if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      this.sortCurrentDie('salvage');
    }
  }

  private handleRosterKeyboard(event: KeyboardEvent): void {
    const digitIndex = digitToIndex(event.key, CHIP_LIST.length);
    if (digitIndex !== null && CHIP_LIST[digitIndex]) {
      event.preventDefault();
      this.selectChip(CHIP_LIST[digitIndex].id);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.cycleSelectedChip(-1);
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.cycleSelectedChip(1);
      return;
    }

    if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      if (this.canAdvanceToQuiz()) {
        this.showQuiz();
      }
      return;
    }

    if (isActivationKey(event)) {
      event.preventDefault();
      this.buildSelectedChip();
    }
  }

  private cycleSelectedChip(offset: number): void {
    const currentIndex = this.selectedChipId
      ? CHIP_LIST.findIndex((chip) => chip.id === this.selectedChipId)
      : 0;
    const nextIndex = cycleIndex(currentIndex < 0 ? 0 : currentIndex, offset, CHIP_LIST.length);
    const chip = CHIP_LIST[nextIndex];
    if (chip) {
      this.selectChip(chip.id);
    }
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
    this.persistChapterProgress(false);
  }

  private showNextPendingFact(): boolean {
    const factId = this.pendingFactIds.shift();
    if (!factId) {
      this.pausedForOverlay = false;
      this.redrawWorld();
      this.refreshOverlay();
      return false;
    }

    const factKey = FACT_BY_ID[factId];
    if (!factKey) {
      return this.showNextPendingFact();
    }

    this.pausedForOverlay = true;
    this.factCard?.cleanup();
    this.factCard = mountFactCard(documentRoot(), {
      card: STRINGS.ch5.facts[factKey],
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
            scene: SceneKey.Ch5Package
          }
        });
      }
    });
    return true;
  }

  private showEventCard(event: EventCardDefinition, eventKey: 'probeDrift' | 'substrateShortage'): void {
    this.pausedForOverlay = true;
    this.chapter = applyPackageEvent(this.chapter, eventKey);
    this.eventCard?.cleanup();
    this.eventCard = mountEventCard(documentRoot(), {
      event,
      textMode: this.textMode,
      labels: STRINGS.sandbox.eventLabels,
      onChoice: (choiceId) => {
        const result = applyEventChoice(this.resources, event, choiceId, BALANCE.resources.caps);
        this.replaceResources(result.resources);
        this.chapter = {
          ...this.chapter,
          elapsedSeconds: this.chapter.elapsedSeconds + (result.choice.timePenaltySeconds ?? 0)
        };
        this.lastMessage = eventKey === 'probeDrift' && choiceId === 'sort-through-noise'
          ? STRINGS.ch5.messages.probePenalty
          : eventKey === 'substrateShortage' && choiceId === 'use-salvage-package'
            ? STRINGS.ch5.messages.substratePenalty
            : null;
        this.persistChapterProgress(false);
        this.eventCard?.cleanup();
        this.eventCard = undefined;
        this.pausedForOverlay = false;
        this.redrawWorld();
        this.refreshOverlay();
        gameStore.events.emit('analytics:event', {
          name: 'event_choice',
          payload: {
            eventId: event.id,
            choiceId,
            scene: SceneKey.Ch5Package
          }
        });
        if (this.chapter.stage === 'roster') {
          this.enterRosterStage();
        }
      }
    });
  }

  private showQuiz(): void {
    this.pausedForOverlay = true;
    this.quiz?.cleanup();
    this.quiz = mountChapterFiveQuiz(documentRoot(), {
      quiz: QUIZ.ch5FieldCheck,
      labels: STRINGS.ch5.labels,
      textMode: this.textMode,
      onAnswer: (answer) => {
        gameStore.events.emit('analytics:event', {
          name: 'quiz_answer',
          payload: {
            questionId: QUIZ.ch5FieldCheck.id,
            answerId: answer.id,
            correct: answer.correct,
            scene: SceneKey.Ch5Package
          }
        });

        if (!answer.correct) {
          this.lastMessage = answer.explanation;
          this.quiz?.cleanup();
          this.quiz = undefined;
          this.refreshOverlay();
          this.clearQuizRetryTimeout();
          this.quizRetryTimeout = window.setTimeout(() => {
            this.quizRetryTimeout = undefined;
            if (!this.completion) {
              this.showQuiz();
            }
          }, 1200);
          return;
        }

        this.clearQuizRetryTimeout();
        this.quiz?.cleanup();
        this.quiz = undefined;
        this.chapter = {
          ...this.chapter,
          stage: 'complete'
        };
        this.persistChapterProgress(true, true);
        this.lastMessage = null;
        this.redrawWorld();
        this.refreshOverlay();
        this.showCompletion();
      }
    });
  }

  private showCompletion(): void {
    this.completion?.cleanup();
    this.completion = mountChapterFiveComplete(documentRoot(), {
      title: STRINGS.ch5.completion.title,
      body: STRINGS.ch5.completion.body,
      labels: STRINGS.ch5.labels,
      chipsLabel: STRINGS.hud.chips,
      textMode: this.textMode,
      elapsedSeconds: this.chapter.elapsedSeconds,
      sortedCount: this.chapter.sortedCount,
      builtCount: this.chapter.builtChips.length,
      perfect7nmDies: this.chapter.perfect7nmDies,
      selectedChips: this.chapter.selectedChipIds
        .map((chipId) => CHIP_BY_ID.get(chipId))
        .filter((chip): chip is ChipDefinition => Boolean(chip)),
      onNext: () => {
        window.location.hash = 'ch6';
        gameStore.enterScene(SceneKey.Ch6Datacenter, 6);
        this.scene.start(SceneKey.Ch6Datacenter);
      }
    });
  }

  private persistChapterProgress(completed: boolean, quizCorrect: boolean | null = null): void {
    gameStore.update((state) => ({
      ...state,
      chapters: {
        ...state.chapters,
        ch5: {
          completed: completed || state.chapters.ch5.completed,
          completedAtSeconds: completed ? Math.round(this.chapter.elapsedSeconds) : state.chapters.ch5.completedAtSeconds,
          quizCorrect: completed ? quizCorrect : state.chapters.ch5.quizCorrect,
          sortedDies: this.chapter.sortedCount,
          bins: this.chapter.bins,
          selectedChipIds: this.chapter.selectedChipIds,
          builtChips: this.chapter.builtChips,
          perfect7nmDies: this.chapter.perfect7nmDies,
          triggeredEvents: this.chapter.triggeredEvents,
          firstFacts: this.chapter.firstFacts
        }
      }
    }));
    gameStore.saveNow();
  }

  private replaceResources(resources: ResourceState): void {
    gameStore.update((state) => ({
      ...state,
      resources
    }));
    this.hud?.update(resources, this.textMode);
    gameStore.saveNow();
  }

  private refreshOverlay(): void {
    this.emitDebugProgress();
    this.overlay?.update(this.overlayOptions());
  }

  private emitDebugProgress(): void {
    emitDebugProgress(5, this.chapter.elapsedSeconds, this.progressRatio(), BALANCE.ch5.pacingTargetSeconds);
  }

  private progressRatio(): number {
    if (this.chapter.stage === 'complete') {
      return 1;
    }

    const sorted = chapterProgressRatio(this.chapter.sortedCount, BALANCE.ch5.sortSampleSize);
    const built = chapterProgressRatio(this.chapter.builtChips.length, BALANCE.ch5.maxBuildChoices);
    return (sorted + built) / 2;
  }

  private overlayOptions() {
    return {
      chapter: this.chapter,
      balance: BALANCE.ch5,
      chips: CHIP_LIST,
      labels: STRINGS.ch5.labels,
      stageNames: STRINGS.ch5.stageNames,
      textMode: this.textMode,
      message: this.lastMessage,
      activeDie: this.activeDie(),
      selectedChip: this.selectedChip(),
      canCutWafer: this.canCutWafer(),
      canStartSort: this.canStartSort(),
      canSortPerfect: this.canSort('perfect'),
      canSortGood: this.canSort('good'),
      canSortSalvage: this.canSort('salvage'),
      canBuildSelected: this.canBuildSelected(),
      canAdvanceToQuiz: this.canAdvanceToQuiz(),
      onCutWafer: () => this.cutWafer(),
      onStartSort: () => this.startSorting(),
      onSortDie: (bin: DieBinId) => this.sortCurrentDie(bin),
      onSelectChip: (chipId: ChipTypeId) => this.selectChip(chipId),
      onBuildSelectedChip: () => this.buildSelectedChip(),
      onAdvanceToQuiz: () => this.showQuiz(),
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
    this.redrawWorld();
  }

  private cleanup(): void {
    if (this.keyboardHandler) {
      this.input.keyboard?.off('keydown', this.keyboardHandler);
      this.keyboardHandler = undefined;
    }
    this.clearQuizRetryTimeout();
    for (const cleanup of this.cleanupCallbacks.splice(0)) {
      cleanup();
    }
    this.worldLayer?.destroy(true);
    this.cardZones.splice(0).forEach((zone) => zone.destroy());
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
    this.resetTransientState();
  }

  private dismissIntroDialogue(): void {
    if (!this.dialogue) {
      return;
    }

    this.dialogue.cleanup();
    this.dialogue = undefined;
    this.pausedForOverlay = false;
    this.introInterruptible = false;
    if (this.chapter.stage === 'complete') {
      this.showCompletion();
      return;
    }
    this.showNextPendingFact();
  }

  private canCutWafer(): boolean {
    return this.chapter.stage === 'dice' && !this.waferDiced && !this.pausedForOverlay;
  }

  private clearQuizRetryTimeout(): void {
    if (this.quizRetryTimeout === undefined) {
      return;
    }

    window.clearTimeout(this.quizRetryTimeout);
    this.quizRetryTimeout = undefined;
  }

  private resetTransientState(): void {
    this.pendingFactIds = [];
    this.pausedForOverlay = false;
    this.waferDiced = false;
    this.selectedChipId = null;
    this.lastMessage = this.chapter.stage === 'complete'
      ? null
      : this.chapter.stage === 'roster'
        ? STRINGS.ch5.messages.rosterHint
        : this.chapter.stage === 'sort'
          ? STRINGS.ch5.messages.sortHint
          : STRINGS.ch5.messages.diceHint;
  }

  private canStartSort(): boolean {
    return this.chapter.stage === 'dice' && this.waferDiced && !this.pausedForOverlay;
  }

  private canSort(bin: DieBinId): boolean {
    if (this.chapter.stage !== 'sort' || this.pausedForOverlay) {
      return false;
    }

    const activeDie = this.activeDie();
    return Boolean(activeDie) && (bin === 'perfect' || bin === 'good' || bin === 'salvage');
  }

  private canBuildSelected(): boolean {
    if (this.chapter.stage !== 'roster' || this.pausedForOverlay || !this.selectedChip()) {
      return false;
    }

    return canBuildChip(this.chapter, this.selectedChip()!, BALANCE.ch5.maxBuildChoices);
  }

  private canAdvanceToQuiz(): boolean {
    return this.chapter.stage === 'roster' && this.chapter.builtChips.length > 0 && !this.pausedForOverlay;
  }

  private selectedChip(): ChipDefinition | null {
    if (!this.selectedChipId) {
      return null;
    }

    return CHIP_BY_ID.get(this.selectedChipId) ?? null;
  }

  private activeDie(): TestDie | null {
    if (this.chapter.stage !== 'sort') {
      return null;
    }

    return this.chapter.testDies[this.chapter.activeDieIndex] ?? null;
  }

  private firstBuildableChipId(): ChipTypeId | null {
    for (const chip of CHIP_LIST) {
      if (canBuildChip(this.chapter, chip, BALANCE.ch5.maxBuildChoices)) {
        return chip.id;
      }
    }

    return null;
  }
}

function createChapterFiveState(): PackageChapterState {
  const state = gameStore.getState();
  const progress = state.chapters.ch5;
  const hasFabYields = state.chapters.ch4.nodeYields.some((nodeYield) => nodeYield.goodDies > 0);
  const nodeYields = hasFabYields
    ? state.chapters.ch4.nodeYields
    : BALANCE.ch5.fallbackNodeYields ?? [];
  const chapter = createInitialPackageChapter(BALANCE.ch5, nodeYields, state.resources.chips);

  if (progress.completed) {
    return {
      ...chapter,
      stage: 'complete',
      sortedCount: progress.sortedDies,
      bins: progress.bins,
      selectedChipIds: progress.selectedChipIds,
      builtChips: progress.builtChips,
      perfect7nmDies: progress.perfect7nmDies,
      triggeredEvents: progress.triggeredEvents,
      firstFacts: progress.firstFacts
    };
  }

  // Only resume straight into the roster once every sampled die was sorted or
  // a chip was already built; otherwise a mid-sort save would strand the
  // player in the roster with too few binned dies to build anything.
  const reachedRoster = progress.selectedChipIds.length > 0
    || progress.builtChips.length > 0
    || progress.sortedDies >= chapter.testDies.length;
  if (reachedRoster && progress.sortedDies > 0) {
    return {
      ...chapter,
      stage: 'roster',
      testDies: chapter.testDies.map((die) => ({ ...die, sorted: true, actualBin: die.actualBin ?? die.expectedBin })),
      sortedCount: progress.sortedDies,
      bins: progress.bins,
      selectedChipIds: progress.selectedChipIds,
      builtChips: progress.builtChips,
      perfect7nmDies: progress.perfect7nmDies,
      triggeredEvents: progress.triggeredEvents,
      firstFacts: progress.firstFacts
    };
  }

  if (progress.sortedDies > 0) {
    const sortedCount = Math.min(progress.sortedDies, chapter.testDies.length);
    return {
      ...chapter,
      stage: 'sort',
      testDies: chapter.testDies.map((die, index) => (index < sortedCount
        ? { ...die, sorted: true, actualBin: die.expectedBin }
        : die)),
      activeDieIndex: sortedCount,
      sortedCount,
      bins: progress.bins,
      selectedChipIds: progress.selectedChipIds,
      builtChips: progress.builtChips,
      perfect7nmDies: progress.perfect7nmDies,
      triggeredEvents: progress.triggeredEvents,
      firstFacts: progress.firstFacts
    };
  }

  return chapter;
}

function buildFailureMessage(
  reason: string | undefined,
  messages: ChapterFiveStrings['ch5']['messages']
): TextModeText {
  if (reason === 'max choices reached' || reason === 'already built') {
    return messages.maxChoices;
  }

  if (reason === 'locked' || reason === 'needs perfect 7nm die') {
    return messages.novaLocked;
  }

  return messages.cantAfford;
}

function chipCostTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    color: '#fff7d6',
    fontFamily: 'Nunito, system-ui',
    fontSize: '9px',
    fontStyle: '800'
  };
}

function parseColor(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

function documentRoot(): HTMLElement {
  const root = document.getElementById('ui-root');
  if (!root) {
    throw new Error('Missing #ui-root element');
  }

  return root;
}
