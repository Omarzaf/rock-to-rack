import Phaser from 'phaser';
import { playUiCue } from '../audio/soundDesign';
import balanceJson from '../content/balance.json';
import chipsJson from '../content/chips.json';
import eventsJson from '../content/events.json';
import { jensenGuideLines } from '../content/guide';
import quizJson from '../content/quiz.json';
import stringsJson from '../content/strings.json';
import {
  applyDatacenterEvent,
  canServeContract,
  completeNovaChallenge,
  createInitialDatacenterChapter,
  getDatacenterGoalProgress,
  installChip,
  placeDatacenterBuilding,
  serveContract,
  tickDatacenter,
  type DatacenterBalance,
  type DatacenterChapterState,
  type DatacenterContractDefinition
} from '../sim/datacenter';
import { applyEventChoice, type EventCardDefinition } from '../sim/events';
import type { ChipDefinition } from '../sim/package';
import { chapterProgressRatio } from '../sim/pace';
import { gameStore } from '../state/gameStore';
import type {
  ChapterSixProgress,
  ChipTypeId,
  DatacenterBuildingProgress,
  DatacenterBuildingType,
  DatacenterContractId,
  DatacenterGridPosition,
  ResourceState,
  TextMode
} from '../state/types';
import type { MountedModal, QuizDefinition } from '../ui/chapterOneOverlay';
import {
  mountChapterSixComplete,
  mountChapterSixOverlay,
  mountChapterSixQuiz,
  type ChapterSixLabels,
  type MountedChapterSixOverlay
} from '../ui/chapterSixOverlay';
import { mountDialogue, type DialogueLabels, type DialogueLine, type MountedDialogue } from '../ui/dialogueOverlay';
import { mountEventCard, type EventCardLabels, type MountedEventCard } from '../ui/eventCardOverlay';
import { mountFactCard, type FactCardDefinition, type FactCardLabels, type MountedFactCard } from '../ui/factCard';
import { createGlobalPanelController, GLOBAL_TOOL_LABELS, type GlobalPanelController } from '../ui/globalPanels';
import { mountPipelineHud, type MountedPipelineHud, type PipelineHudLabels } from '../ui/pipelineHud';
import type { TextModeText } from '../ui/text';
import { textForMode } from '../ui/text';
import { clampIndex, cycleIndex, digitToIndex, isActivationKey, isInteractiveElementFocused, isReplayInterruptKey } from './chapterKeyboard';
import { debugCatchUpMultiplier, emitDebugProgress } from './debugProgress';
import { moduleNavOptions } from './moduleNavigation';
import { SceneKey } from './sceneKeys';

interface BalanceContent {
  resources: {
    caps: import('../sim/economy').ResourceCaps;
  };
  ch6: DatacenterBalance;
}

interface ChapterSixStrings {
  hud: PipelineHudLabels;
  sandbox: {
    dialogueLabels: DialogueLabels;
    factLabels: FactCardLabels;
    eventLabels: EventCardLabels;
  };
  ch6: {
    title: TextModeText;
    subtitle: TextModeText;
    labels: ChapterSixLabels;
    stageNames: ChapterSixOverlayStageNames;
    messages: Record<
      | 'buildHint'
      | 'selectRack'
      | 'contractReady'
      | 'contractBlocked'
      | 'heatWarning'
      | 'powerWarning'
      | 'novaLocked'
      | 'victoryReady',
      TextModeText
    >;
    intro: DialogueLine[];
    facts: Record<'datacenterAnatomy' | 'cooling' | 'network', FactCardDefinition>;
    completion: {
      title: TextModeText;
      body: TextModeText;
      tablet: TextModeText;
      epilogue: Array<{ title: TextModeText; caption: TextModeText }>;
    };
  };
}

type ChapterSixOverlayStageNames = Record<DatacenterChapterState['stage'], TextModeText>;

interface EventsContent {
  ch6Contracts: DatacenterContractDefinition[];
  ch6Heatwave: EventCardDefinition;
  ch6Brownout: EventCardDefinition;
}

interface QuizContent {
  ch6FieldCheck: QuizDefinition;
}

const BALANCE = balanceJson as unknown as BalanceContent;
const STRINGS = stringsJson as ChapterSixStrings;
const EVENTS = eventsJson as unknown as EventsContent;
const QUIZ = quizJson as QuizContent;
const CHIP_LIST = chipsJson as unknown as ChipDefinition[];
const CHIP_BY_ID = new Map(CHIP_LIST.map((chip) => [chip.id, chip] as const));
const CONTRACTS = EVENTS.ch6Contracts;

const BUILD_TYPE_ORDER: DatacenterBuildingType[] = ['rack', 'power', 'cooling', 'network', 'battery'];
const GRID = {
  x: 284,
  y: 184,
  cellWidth: 82,
  cellHeight: 56,
  columns: 8,
  rows: 5
};
const SUPPORT_CHIPS: ChipTypeId[] = ['cpu', 'gpu', 'dram', 'nand', 'nic', 'pmic'];
const BUILD_COLORS: Record<DatacenterBuildingType, number> = {
  rack: 0x60a5fa,
  power: 0xf8d45c,
  cooling: 0x22d3ee,
  network: 0x60d394,
  battery: 0xa78bfa
};
const BUILD_GLYPHS: Record<DatacenterBuildingType, string> = {
  rack: 'R',
  power: 'P',
  cooling: 'C',
  network: 'N',
  battery: 'B'
};
const FACT_BY_ID: Record<string, keyof ChapterSixStrings['ch6']['facts']> = {
  'ch6-datacenter-anatomy': 'datacenterAnatomy',
  'ch6-cooling': 'cooling',
  'ch6-network': 'network'
};

export class Ch6DatacenterScene extends Phaser.Scene {
  private chapter = createInitialDatacenterChapter(gameStore.getState().chapters.ch5, BALANCE.ch6);
  private cleanupCallbacks: Array<() => void> = [];
  private hud: MountedPipelineHud | undefined;
  private globalPanels: GlobalPanelController | undefined;
  private overlay: MountedChapterSixOverlay | undefined;
  private dialogue: MountedDialogue | undefined;
  private factCard: MountedFactCard | undefined;
  private eventCard: MountedEventCard | undefined;
  private quiz: MountedModal | undefined;
  private completion: MountedModal | undefined;
  private worldLayer: Phaser.GameObjects.Container | undefined;
  private gridZones: Phaser.GameObjects.Zone[] = [];
  private pendingFactIds: string[] = [];
  private selectedBuildType: DatacenterBuildingType = 'rack';
  private selectedChipId: ChipTypeId | null = null;
  private selectedContractId: DatacenterContractId | null = null;
  private pausedForOverlay = false;
  private introInterruptible = false;
  private keyboardHandler: ((event: KeyboardEvent) => void) | undefined;
  private keyboardCursor: DatacenterGridPosition = { column: 1, row: 1 };
  private lastMessage: TextModeText | null = null;
  private quizRetryTimeout: number | undefined;
  private persistTicks = 0;

  constructor() {
    super(SceneKey.Ch6Datacenter);
  }

  create(): void {
    gameStore.enterScene(SceneKey.Ch6Datacenter, 6);
    this.chapter = createChapterSixState();
    this.selectedChipId = this.firstAvailableChipId();
    this.selectedContractId = this.chapter.selectedContractId ?? CONTRACTS[0]?.id ?? null;
    this.resetTransientState();
    this.drawBackdrop();
    this.worldLayer = this.add.container(0, 0);
    this.mountDom();
    this.bindKeyboard();
    this.showIntroDialogue();
    this.redrawWorld();

    this.time.addEvent({
      delay: BALANCE.ch6.tickSeconds * 1000,
      loop: true,
      callback: () => this.tickChapter(BALANCE.ch6.tickSeconds)
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
      stage: 6,
      resources: this.resources,
      textMode: this.textMode,
      labels: STRINGS.hud,
      moduleNav: moduleNavOptions(this, 6),
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

    this.overlay = mountChapterSixOverlay(uiRoot, this.overlayOptions());
    this.cleanupCallbacks.push(this.overlay.cleanup);
    this.emitDebugProgress();
  }

  private resetTransientState(): void {
    this.cleanupCallbacks = [];
    this.gridZones = [];
    this.pendingFactIds = [];
    this.pausedForOverlay = false;
    this.lastMessage = STRINGS.ch6.messages.buildHint;
    this.clearQuizRetryTimeout();
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x06111d);
    this.add.rectangle(640, 322, 1280, 390, 0x082238, 0.94);
    this.add.rectangle(640, 610, 1280, 220, 0x0d1b2a, 1);

    const skyline = this.add.graphics();
    const lights = Math.max(0.18, this.chapter.cityLights / 100);
    for (let i = 0; i < 18; i += 1) {
      const x = 68 + i * 68;
      const h = 38 + (i % 5) * 16;
      skyline.fillStyle(0x13293f, 0.98);
      skyline.fillRect(x, 558 - h, 42, h);
      skyline.fillStyle(i % 2 === 0 ? 0xf8d45c : 0x60d394, 0.12 + lights * 0.58);
      for (let y = 558 - h + 10; y < 548; y += 15) {
        skyline.fillRect(x + 9, y, 6, 6);
        skyline.fillRect(x + 25, y, 6, 6);
      }
    }

    const grid = this.add.graphics();
    grid.lineStyle(2, 0x9bf6ff, 0.08);
    for (let x = 120; x <= 1160; x += 80) {
      grid.lineBetween(x, 150, x + 120, 560);
    }
  }

  private tickChapter(seconds: number): void {
    if (this.pausedForOverlay || this.quiz || this.completion || this.dialogue || this.eventCard || this.factCard) {
      return;
    }

    this.chapter = tickDatacenter(this.chapter, seconds, BALANCE.ch6);
    this.persistTicks += 1;
    this.refreshAfterMutation(this.persistTicks % 8 === 0);
  }

  private placeBuilding(column: number, row: number): void {
    if (this.pausedForOverlay || this.completion) {
      return;
    }

    const result = placeDatacenterBuilding(this.chapter, this.resources, this.selectedBuildType, { column, row }, BALANCE.ch6);
    if (!result.ok) {
      playUiCue('warning');
      this.lastMessage = STRINGS.ch6.messages.buildHint;
      this.refreshOverlay();
      return;
    }

    this.chapter = tickDatacenter({
      ...result.chapter,
      stage: result.chapter.stage === 'build' ? 'contracts' : result.chapter.stage
    }, 0, BALANCE.ch6);
    playUiCue('rack');
    this.replaceResources(result.resources);
    this.queueFact('ch6-datacenter-anatomy');
    this.lastMessage = this.selectedBuildType === 'rack' ? STRINGS.ch6.messages.selectRack : STRINGS.ch6.messages.buildHint;
    this.refreshAfterMutation(true);
    this.showNextPendingFact();
  }

  private selectBuilding(buildingId: string): void {
    this.chapter = {
      ...this.chapter,
      selectedBuildingId: buildingId
    };
    const building = this.chapter.buildings.find((candidate) => candidate.id === buildingId);
    this.lastMessage = building?.type === 'rack' ? STRINGS.ch6.messages.selectRack : STRINGS.ch6.messages.buildHint;
    this.refreshAfterMutation(false);
  }

  private selectBuildType(type: DatacenterBuildingType): void {
    this.selectedBuildType = type;
    if (type === 'cooling') {
      this.queueFact('ch6-cooling');
      this.showNextPendingFact();
    }
    if (type === 'network') {
      this.queueFact('ch6-network');
      this.showNextPendingFact();
    }
    this.refreshOverlay();
  }

  private selectChip(chipId: ChipTypeId): void {
    this.selectedChipId = chipId;
    this.refreshOverlay();
  }

  private installSelectedChip(): void {
    const buildingId = this.chapter.selectedBuildingId;
    if (!buildingId || !this.selectedChipId) {
      this.lastMessage = STRINGS.ch6.messages.selectRack;
      this.refreshOverlay();
      return;
    }

    const result = installChip(this.chapter, buildingId, this.selectedChipId, BALANCE.ch6);
    if (!result.ok) {
      playUiCue('warning');
      this.lastMessage = STRINGS.ch6.messages.selectRack;
      this.refreshOverlay();
      return;
    }

    this.chapter = tickDatacenter(result.chapter, 0, BALANCE.ch6);
    playUiCue('rack');
    this.selectedChipId = this.firstAvailableChipId();
    this.lastMessage = STRINGS.ch6.messages.contractBlocked;
    this.refreshAfterMutation(true);
  }

  private selectContract(contractId: DatacenterContractId): void {
    this.selectedContractId = contractId;
    this.chapter = {
      ...this.chapter,
      selectedContractId: contractId
    };
    const contract = selectedContract(contractId);
    this.lastMessage = contract && canServeContract(this.chapter, contract, BALANCE.ch6).ok
      ? STRINGS.ch6.messages.contractReady
      : STRINGS.ch6.messages.contractBlocked;
    this.refreshAfterMutation(false);
  }

  private serveSelectedContract(): void {
    const contract = this.selectedContract();
    if (!contract) {
      return;
    }

    const multiplier = debugCatchUpMultiplier(
      6,
      this.chapter.elapsedSeconds,
      this.progressRatio(),
      BALANCE.ch6.pacingTargetSeconds
    );
    const result = serveContract(this.chapter, this.resources, contract, BALANCE.ch6, {
      rewardMultiplier: multiplier,
      caps: BALANCE.resources.caps
    });
    if (!result.ok) {
      playUiCue('warning');
      this.lastMessage = result.reason === 'nova locked' ? STRINGS.ch6.messages.novaLocked : STRINGS.ch6.messages.contractBlocked;
      this.refreshOverlay();
      return;
    }

    const servedHospitalNova = result.chapter.servedContracts.includes('hospitalNova');
    this.chapter = tickDatacenter(result.chapter, 0, BALANCE.ch6);
    this.replaceResources(result.resources);
    playUiCue(servedHospitalNova ? 'victory' : 'success');
    this.lastMessage = this.chapter.stage === 'victory' ? STRINGS.ch6.messages.victoryReady : STRINGS.ch6.messages.contractReady;
    this.refreshAfterMutation(true);

    if (servedHospitalNova) {
      this.showCompletion();
      return;
    }

    if (this.maybeTriggerEvents()) {
      return;
    }
  }

  private runNovaChallenge(): void {
    const result = completeNovaChallenge(this.chapter, { mask: 86, etch: 84, cooling: 83 }, BALANCE.ch6);
    if (!result.ok) {
      playUiCue('warning');
      this.lastMessage = STRINGS.ch6.messages.novaLocked;
      this.refreshOverlay();
      return;
    }

    this.chapter = tickDatacenter(result.chapter, 0, BALANCE.ch6);
    playUiCue('victory');
    this.selectedChipId = 'nova';
    this.lastMessage = STRINGS.ch6.messages.selectRack;
    this.refreshAfterMutation(true);
  }

  private maybeTriggerEvents(): boolean {
    const nonFinalServed = this.chapter.servedContracts.filter((contractId) => contractId !== 'hospitalNova').length;
    if (nonFinalServed >= 2 && !this.chapter.triggeredEvents.includes('heatwave')) {
      this.showEventCard(EVENTS.ch6Heatwave, 'heatwave');
      return true;
    }

    if (nonFinalServed >= 3 && !this.chapter.triggeredEvents.includes('brownout')) {
      this.showEventCard(EVENTS.ch6Brownout, 'brownout');
      return true;
    }

    return false;
  }

  private showIntroDialogue(): void {
    this.pausedForOverlay = true;
    this.introInterruptible = gameStore.getState().chapters.ch6.completed;
    this.dialogue?.cleanup();
    this.dialogue = mountDialogue(documentRoot(), {
      lines: jensenGuideLines(STRINGS.ch6.intro, 6),
      textMode: this.textMode,
      labels: STRINGS.sandbox.dialogueLabels,
      onComplete: () => {
        this.dialogue = undefined;
        this.pausedForOverlay = false;
        if (this.chapter.quizCorrect === true || this.chapter.servedContracts.includes('hospitalNova')) {
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

      const buildIndex = digitToIndex(event.key, BUILD_TYPE_ORDER.length);
      if (buildIndex !== null) {
        event.preventDefault();
        this.selectBuildType(BUILD_TYPE_ORDER[buildIndex]);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.moveKeyboardCursor(-1, 0);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.moveKeyboardCursor(1, 0);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.moveKeyboardCursor(0, -1);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.moveKeyboardCursor(0, 1);
        return;
      }

      if (event.key === 'i' || event.key === 'I') {
        event.preventDefault();
        this.installSelectedChip();
        return;
      }

      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        this.serveSelectedContract();
        return;
      }

      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        this.runNovaChallenge();
        return;
      }

      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        this.cycleSelectedContract(1);
        return;
      }

      if (event.key === 'v' || event.key === 'V') {
        event.preventDefault();
        this.cycleSelectedChip(1);
        return;
      }

      if (isActivationKey(event)) {
        event.preventDefault();
        this.activateKeyboardGridCell();
      }
    };

    this.input.keyboard?.on('keydown', this.keyboardHandler);
  }

  private moveKeyboardCursor(deltaColumn: number, deltaRow: number): void {
    this.keyboardCursor = {
      column: clampIndex(this.keyboardCursor.column - 1 + deltaColumn, GRID.columns) + 1,
      row: clampIndex(this.keyboardCursor.row - 1 + deltaRow, GRID.rows) + 1
    };
    this.redrawWorld();
  }

  private activateKeyboardGridCell(): void {
    const building = this.chapter.buildings.find((candidate) => (
      candidate.column === this.keyboardCursor.column && candidate.row === this.keyboardCursor.row
    ));
    if (building) {
      this.selectBuilding(building.id);
      return;
    }

    this.placeBuilding(this.keyboardCursor.column, this.keyboardCursor.row);
  }

  private cycleSelectedChip(offset: number): void {
    const available = this.chapter.availableChipIds.filter((chipId) => !this.chapter.installedChipIds.includes(chipId));
    if (available.length === 0) {
      return;
    }

    const currentIndex = this.selectedChipId ? available.indexOf(this.selectedChipId) : 0;
    this.selectChip(available[cycleIndex(currentIndex < 0 ? 0 : currentIndex, offset, available.length)]);
  }

  private cycleSelectedContract(offset: number): void {
    if (CONTRACTS.length === 0) {
      return;
    }

    const currentIndex = this.selectedContractId
      ? CONTRACTS.findIndex((contract) => contract.id === this.selectedContractId)
      : 0;
    this.selectContract(CONTRACTS[cycleIndex(currentIndex < 0 ? 0 : currentIndex, offset, CONTRACTS.length)].id);
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
      card: STRINGS.ch6.facts[factKey],
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
            scene: SceneKey.Ch6Datacenter
          }
        });
      }
    });
    return true;
  }

  private showEventCard(event: EventCardDefinition, eventKey: 'heatwave' | 'brownout'): void {
    this.pausedForOverlay = true;
    this.chapter = {
      ...this.chapter,
      stage: 'crisis'
    };
    this.eventCard?.cleanup();
    this.eventCard = mountEventCard(documentRoot(), {
      event,
      textMode: this.textMode,
      labels: STRINGS.sandbox.eventLabels,
      onChoice: (choiceId) => {
        const result = applyEventChoice(this.resources, event, choiceId, BALANCE.resources.caps);
        this.replaceResources(result.resources);
        this.chapter = applyDatacenterEvent({
          ...this.chapter,
          elapsedSeconds: this.chapter.elapsedSeconds + (result.choice.timePenaltySeconds ?? 0),
          stage: this.chapter.servedContracts.filter((contractId) => contractId !== 'hospitalNova').length >= BALANCE.ch6.contractsToUnlockNova
            ? 'nova'
            : 'contracts'
        }, eventKey, choiceId, BALANCE.ch6);
        this.lastMessage = eventKey === 'heatwave' ? STRINGS.ch6.messages.heatWarning : STRINGS.ch6.messages.powerWarning;
        this.persistChapterProgress(false);
        this.eventCard?.cleanup();
        this.eventCard = undefined;
        this.pausedForOverlay = false;
        this.refreshAfterMutation(true);
        gameStore.events.emit('analytics:event', {
          name: 'event_choice',
          payload: {
            eventId: event.id,
            choiceId,
            scene: SceneKey.Ch6Datacenter
          }
        });
      }
    });
  }

  private showQuiz(): void {
    this.pausedForOverlay = true;
    this.quiz?.cleanup();
    this.quiz = mountChapterSixQuiz(documentRoot(), {
      quiz: QUIZ.ch6FieldCheck,
      labels: STRINGS.ch6.labels,
      textMode: this.textMode,
      onAnswer: (answer) => {
        gameStore.events.emit('analytics:event', {
          name: 'quiz_answer',
          payload: {
            questionId: QUIZ.ch6FieldCheck.id,
            answerId: answer.id,
            correct: answer.correct,
            scene: SceneKey.Ch6Datacenter
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
          completed: true,
          quizCorrect: true,
          completedAtSeconds: Math.round(this.chapter.elapsedSeconds),
          stage: 'victory'
        };
        this.lastMessage = STRINGS.ch6.messages.victoryReady;
        this.persistChapterProgress(true);
        this.refreshAfterMutation(true);
        this.showCompletion();
      }
    });
  }

  private showCompletion(): void {
    this.pausedForOverlay = true;
    this.completion?.cleanup();
    const progress = getDatacenterGoalProgress(this.chapter, CONTRACTS);
    this.completion = mountChapterSixComplete(documentRoot(), {
      title: STRINGS.ch6.completion.title,
      body: STRINGS.ch6.completion.body,
      tablet: STRINGS.ch6.completion.tablet,
      labels: STRINGS.ch6.labels,
      textMode: this.textMode,
      elapsedSeconds: this.chapter.completedAtSeconds ?? this.chapter.elapsedSeconds,
      servedContracts: progress.servedContracts,
      cityLights: progress.cityLights,
      installedChipIds: this.chapter.installedChipIds,
      epilogue: STRINGS.ch6.completion.epilogue,
      onNext: () => {
        this.persistChapterProgress(true);
        this.scene.start(SceneKey.Menu);
      }
    });
    this.cleanupCallbacks.push(this.completion.cleanup);
  }

  private redrawWorld(): void {
    if (!this.worldLayer) {
      return;
    }

    this.worldLayer.removeAll(true);
    this.gridZones.splice(0).forEach((zone) => zone.destroy());

    const graphics = this.add.graphics();
    this.worldLayer.add(graphics);
    this.drawCityLights(graphics);
    this.drawGrid(graphics);
    this.drawBuildings(graphics);
    this.drawKeyboardCursor(graphics);
    this.drawPipeline(graphics);
    this.drawWorldReadouts();
  }

  private drawCityLights(graphics: Phaser.GameObjects.Graphics): void {
    const lightAlpha = 0.18 + (this.chapter.cityLights / 100) * 0.82;
    graphics.fillStyle(this.chapter.novaBuilt ? 0x60d394 : 0xf8d45c, this.chapter.novaBuilt ? 0.12 + lightAlpha * 0.2 : 0.08 + lightAlpha * 0.14);
    graphics.fillRoundedRect(36, 444, 1208, 140, 18);
    graphics.fillStyle(0x9bf6ff, 0.06 + (this.chapter.cityLights / 100) * 0.1);
    graphics.fillRoundedRect(0, 500, 1280, 92, 0);
    for (let i = 0; i < 18; i += 1) {
      const x = 68 + i * 68;
      const h = 38 + (i % 5) * 16;
      graphics.fillStyle(i % 3 === 0 ? 0xf8d45c : i % 3 === 1 ? 0x60d394 : 0xa78bfa, lightAlpha);
      for (let y = 558 - h + 10; y < 548; y += 15) {
        graphics.fillRoundedRect(x + 9, y, 6, 6, 2);
        graphics.fillRoundedRect(x + 25, y, 6, 6, 2);
      }
    }
  }

  private drawGrid(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x071c2a, 0.9);
    graphics.fillRoundedRect(GRID.x - 32, GRID.y - 28, GRID.columns * GRID.cellWidth + 64, GRID.rows * GRID.cellHeight + 64, 8);
    graphics.lineStyle(2, 0x9bf6ff, 0.14);
    graphics.strokeRoundedRect(GRID.x - 32, GRID.y - 28, GRID.columns * GRID.cellWidth + 64, GRID.rows * GRID.cellHeight + 64, 8);

    for (let row = 1; row <= GRID.rows; row += 1) {
      for (let column = 1; column <= GRID.columns; column += 1) {
        const { x, y } = gridToScreen(column, row);
        const occupied = this.chapter.buildings.some((building) => building.column === column && building.row === row);
        graphics.fillStyle(occupied ? 0x0f2f44 : 0x0b2536, occupied ? 0.84 : 0.52);
        graphics.fillRoundedRect(x, y, GRID.cellWidth - 8, GRID.cellHeight - 8, 8);
        graphics.lineStyle(1, 0x60a5fa, occupied ? 0.22 : 0.12);
        graphics.strokeRoundedRect(x, y, GRID.cellWidth - 8, GRID.cellHeight - 8, 8);

        const zone = this.add.zone(x + (GRID.cellWidth - 8) / 2, y + (GRID.cellHeight - 8) / 2, GRID.cellWidth - 8, GRID.cellHeight - 8)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            const building = this.chapter.buildings.find((candidate) => candidate.column === column && candidate.row === row);
            if (building) {
              this.selectBuilding(building.id);
            } else {
              this.placeBuilding(column, row);
            }
          });
        this.gridZones.push(zone);
      }
    }
  }

  private drawBuildings(graphics: Phaser.GameObjects.Graphics): void {
    for (const building of this.chapter.buildings) {
      const { x, y } = gridToScreen(building.column, building.row);
      const selected = this.chapter.selectedBuildingId === building.id;
      const color = BUILD_COLORS[building.type];
      graphics.fillStyle(color, selected ? 0.9 : 0.72);
      graphics.fillRoundedRect(x + 8, y + 6, GRID.cellWidth - 24, GRID.cellHeight - 18, 8);
      graphics.fillStyle(0xffffff, 0.1);
      graphics.fillRoundedRect(x + 14, y + 12, GRID.cellWidth - 36, 8, 4);
      graphics.lineStyle(3, selected ? 0xf8d45c : 0x06111d, selected ? 0.92 : 0.42);
      graphics.strokeRoundedRect(x + 8, y + 6, GRID.cellWidth - 24, GRID.cellHeight - 18, 8);

      const label = this.add.text(x + 18, y + 16, BUILD_GLYPHS[building.type], {
        color: '#06111d',
        fontFamily: 'Nunito, system-ui',
        fontSize: '18px',
        fontStyle: '900'
      });
      this.worldLayer?.add(label);

      if (building.type === 'rack') {
        this.drawRackSlots(building, x, y);
      }
    }

    if (this.chapter.heat >= BALANCE.ch6.heatWarning) {
      graphics.fillStyle(0xfb7185, Math.min(0.34, this.chapter.heat / 280));
      graphics.fillRoundedRect(GRID.x - 24, GRID.y - 20, GRID.columns * GRID.cellWidth + 48, GRID.rows * GRID.cellHeight + 48, 8);
    }
  }

  private drawKeyboardCursor(graphics: Phaser.GameObjects.Graphics): void {
    const { x, y } = gridToScreen(this.keyboardCursor.column, this.keyboardCursor.row);
    graphics.lineStyle(4, 0xfff7d6, 0.95);
    graphics.strokeRoundedRect(x + 2, y + 2, GRID.cellWidth - 12, GRID.cellHeight - 12, 8);
    graphics.fillStyle(0xfff7d6, 0.08);
    graphics.fillRoundedRect(x + 2, y + 2, GRID.cellWidth - 12, GRID.cellHeight - 12, 8);
  }

  private drawRackSlots(building: DatacenterBuildingProgress, x: number, y: number): void {
    const installed = building.installedChipIds;
    for (let index = 0; index < BALANCE.ch6.rackChipSlots; index += 1) {
      const chipId = installed[index];
      const chip = chipId ? CHIP_BY_ID.get(chipId) : undefined;
      const slot = this.add.graphics();
      slot.fillStyle(chip ? parseColor(chip.cardColor) : 0x06111d, chip ? 0.88 : 0.3);
      slot.fillRoundedRect(x + 13 + index * 13, y + 38, 10, 8, 3);
      this.worldLayer?.add(slot);
    }
  }

  private drawWorldReadouts(): void {
    const title = this.add.text(320, 130, textForMode(STRINGS.ch6.title, this.textMode), {
      color: '#fff7d6',
      fontFamily: 'Nunito, system-ui',
      fontSize: '22px',
      fontStyle: '900'
    });
    const subtitle = this.add.text(320, 158, textForMode(STRINGS.ch6.subtitle, this.textMode), {
      color: '#d6f6ef',
      fontFamily: 'Nunito, system-ui',
      fontSize: '14px',
      fontStyle: '700'
    });
    const payoff = this.add.rectangle(966, 518, 286, 78, 0x06111d, 0.6);
    payoff.setStrokeStyle(1, 0x60d394, 0.26);
    const city = this.add.text(832, 498, `${textForMode(STRINGS.ch6.labels.cityLights, this.textMode)} ${Math.round(this.chapter.cityLights)}%`, {
      color: '#f8d45c',
      fontFamily: 'Nunito, system-ui',
      fontSize: '18px',
      fontStyle: '900'
    });
    const nova = this.add.text(832, 526, this.chapter.novaBuilt ? 'Nova online · the city lights are responding' : 'Nova offline · power and cooling are still under pressure', {
      color: this.chapter.novaBuilt ? '#60d394' : '#d6f6ef',
      fontFamily: 'Nunito, system-ui',
      fontSize: '13px',
      fontStyle: '800'
    });
    this.worldLayer?.add(title);
    this.worldLayer?.add(subtitle);
    this.worldLayer?.add(payoff);
    this.worldLayer?.add(city);
    this.worldLayer?.add(nova);
  }

  private drawPipeline(graphics: Phaser.GameObjects.Graphics): void {
    const nodes = ['Mine', 'Refine', 'Grow', 'Fab', 'Package', 'Rack'];
    const startX = 276;
    const y = 642;
    graphics.lineStyle(3, 0x60a5fa, 0.32);
    graphics.lineBetween(startX, y, startX + 620, y);
    for (const [index, node] of nodes.entries()) {
      const x = startX + index * 124;
      const active = index === nodes.length - 1;
      graphics.fillStyle(active ? 0xf8d45c : 0x0f2f44, active ? 0.95 : 0.88);
      graphics.fillCircle(x, y, active ? 19 : 15);
      graphics.lineStyle(2, active ? 0xfff7d6 : 0x60a5fa, active ? 0.8 : 0.32);
      graphics.strokeCircle(x, y, active ? 19 : 15);
      const label = this.add.text(x - 32, y + 24, node, {
        color: active ? '#fff7d6' : '#d6f6ef',
        fontFamily: 'Nunito, system-ui',
        fontSize: '12px',
        fontStyle: '800'
      });
      this.worldLayer?.add(label);
    }
  }

  private overlayOptions() {
    const selectedContractId = this.selectedContractId ?? CONTRACTS[0]?.id ?? null;
    return {
      chapter: this.chapter,
      balance: BALANCE.ch6,
      contracts: CONTRACTS,
      chips: CHIP_LIST,
      resources: this.resources,
      labels: STRINGS.ch6.labels,
      stageNames: STRINGS.ch6.stageNames,
      textMode: this.textMode,
      message: this.statusMessage(),
      selectedBuildType: this.selectedBuildType,
      selectedBuildingId: this.chapter.selectedBuildingId,
      selectedChipId: this.selectedChipId,
      selectedContractId,
      canBuildType: this.canBuildType(),
      canInstallSelectedChip: this.canInstallSelectedChip(),
      canServeSelectedContract: this.canServeSelectedContract(),
      canRunNovaChallenge: this.canRunNovaChallenge(),
      onSelectBuildType: (type: DatacenterBuildingType) => this.selectBuildType(type),
      onSelectChip: (chipId: ChipTypeId) => this.selectChip(chipId),
      onInstallSelectedChip: () => this.installSelectedChip(),
      onSelectContract: (contractId: DatacenterContractId) => this.selectContract(contractId),
      onServeSelectedContract: () => this.serveSelectedContract(),
      onRunNovaChallenge: () => this.runNovaChallenge(),
      onToggleMode: () => this.toggleTextMode(),
      onMenu: () => this.scene.start(SceneKey.Menu)
    };
  }

  private statusMessage(): TextModeText | null {
    if (this.chapter.powerLoad > this.chapter.powerCapacity) {
      return STRINGS.ch6.messages.powerWarning;
    }
    if (this.chapter.heat >= BALANCE.ch6.heatWarning) {
      return STRINGS.ch6.messages.heatWarning;
    }
    return this.lastMessage;
  }

  private canBuildType(): Record<DatacenterBuildingType, boolean> {
    return {
      rack: canAffordBuilding(this.resources, 'rack'),
      power: canAffordBuilding(this.resources, 'power'),
      cooling: canAffordBuilding(this.resources, 'cooling'),
      network: canAffordBuilding(this.resources, 'network'),
      battery: canAffordBuilding(this.resources, 'battery')
    };
  }

  private canInstallSelectedChip(): boolean {
    if (!this.selectedChipId || !this.chapter.selectedBuildingId) {
      return false;
    }

    const building = this.chapter.buildings.find((candidate) => candidate.id === this.chapter.selectedBuildingId);
    return Boolean(
      building
      && building.type === 'rack'
      && building.installedChipIds.length < BALANCE.ch6.rackChipSlots
      && this.chapter.availableChipIds.includes(this.selectedChipId)
      && !this.chapter.installedChipIds.includes(this.selectedChipId)
    );
  }

  private canServeSelectedContract(): boolean {
    const contract = this.selectedContract();
    return Boolean(contract && !this.chapter.servedContracts.includes(contract.id) && canServeContract(this.chapter, contract, BALANCE.ch6).ok);
  }

  private canRunNovaChallenge(): boolean {
    return this.chapter.stage === 'nova' && !this.chapter.novaBuilt && this.chapter.perfect7nmDies >= BALANCE.ch6.novaChallenge.perfectDieCost;
  }

  private selectedContract(): DatacenterContractDefinition | undefined {
    return selectedContract(this.selectedContractId ?? this.chapter.selectedContractId);
  }

  private firstAvailableChipId(): ChipTypeId | null {
    return this.chapter.availableChipIds.find((chipId) => CHIP_BY_ID.has(chipId)) ?? null;
  }

  private refreshAfterMutation(persist: boolean): void {
    if (persist) {
      this.persistChapterProgress(false);
    }
    this.hud?.update(this.resources, this.textMode);
    this.redrawWorld();
    this.refreshOverlay();
  }

  private refreshOverlay(): void {
    this.emitDebugProgress();
    this.overlay?.update(this.overlayOptions());
    this.completion?.updateMode(this.textMode);
  }

  private emitDebugProgress(): void {
    emitDebugProgress(6, this.chapter.elapsedSeconds, this.progressRatio(), BALANCE.ch6.pacingTargetSeconds);
  }

  private progressRatio(): number {
    if (this.chapter.stage === 'victory' || this.chapter.servedContracts.includes('hospitalNova')) {
      return 1;
    }

    const nonHospitalServed = this.chapter.servedContracts.filter((contractId) => contractId !== 'hospitalNova').length;
    const contracts = chapterProgressRatio(nonHospitalServed, BALANCE.ch6.contractsToUnlockNova);
    const nova = this.chapter.novaBuilt ? 1 : 0;
    const hospital = this.chapter.servedContracts.includes('hospitalNova') ? 1 : 0;
    return (contracts + nova + hospital) / 3;
  }

  private replaceResources(resources: ResourceState): void {
    gameStore.update((state) => ({
      ...state,
      resources
    }));
    gameStore.saveNow();
    this.hud?.update(resources, this.textMode);
  }

  private persistChapterProgress(saveNow: boolean): void {
    const progress = chapterProgressFrom(this.chapter);
    gameStore.update((state) => ({
      ...state,
      chapters: {
        ...state.chapters,
        ch6: progress
      }
    }));
    if (saveNow) {
      gameStore.saveNow();
    }
  }

  private toggleTextMode(): void {
    gameStore.setTextMode(this.textMode === 'kid' ? 'nerd' : 'kid');
    this.hud?.update(this.resources, this.textMode);
    this.refreshOverlay();
    this.globalPanels?.update();
    this.redrawWorld();
  }

  private clearQuizRetryTimeout(): void {
    if (this.quizRetryTimeout !== undefined) {
      window.clearTimeout(this.quizRetryTimeout);
      this.quizRetryTimeout = undefined;
    }
  }

  private cleanup(): void {
    if (this.keyboardHandler) {
      this.input.keyboard?.off('keydown', this.keyboardHandler);
      this.keyboardHandler = undefined;
    }
    this.clearQuizRetryTimeout();
    this.gridZones.splice(0).forEach((zone) => zone.destroy());
    this.dialogue?.cleanup();
    this.factCard?.cleanup();
    this.eventCard?.cleanup();
    this.quiz?.cleanup();
    this.completion?.cleanup();
    for (const callback of this.cleanupCallbacks.splice(0)) {
      callback();
    }
    this.globalPanels = undefined;
  }

  private dismissIntroDialogue(): void {
    if (!this.dialogue) {
      return;
    }

    this.dialogue.cleanup();
    this.dialogue = undefined;
    this.pausedForOverlay = false;
    this.introInterruptible = false;
    if (this.chapter.quizCorrect === true || this.chapter.servedContracts.includes('hospitalNova')) {
      this.showCompletion();
      return;
    }
    this.showNextPendingFact();
  }
}

function createChapterSixState(): DatacenterChapterState {
  const state = gameStore.getState();
  const saved = state.chapters.ch6;
  const hasSavedProgress = saved.buildings.length > 0
    || saved.servedContracts.length > 0
    || saved.installedChipIds.length > 0
    || saved.availableChipIds.length > 0
    || saved.completed;
  const base = hasSavedProgress
    ? chapterFromProgress(saved, state.chapters.ch5.perfect7nmDies)
    : createInitialDatacenterChapter(state.chapters.ch5, BALANCE.ch6);

  return tickDatacenter(withChapterSixLoaners(base), 0, BALANCE.ch6);
}

function chapterFromProgress(progress: ChapterSixProgress, perfect7nmDies: number): DatacenterChapterState {
  return {
    ...progress,
    elapsedSeconds: progress.completedAtSeconds ?? 0,
    perfect7nmDies,
    effectiveCompute: 0,
    selectedBuildingId: progress.buildings[0]?.id ?? null,
    selectedContractId: progress.servedContracts[progress.servedContracts.length - 1] ?? null
  };
}

function withChapterSixLoaners(chapter: DatacenterChapterState): DatacenterChapterState {
  const missingSupport = SUPPORT_CHIPS.filter((chipId) => !chapter.availableChipIds.includes(chipId) && !chapter.installedChipIds.includes(chipId));
  // Loaner perfect die: a player who mis-sorted every perfect 7nm die in
  // Chapter 5 must still be able to clear the Nova challenge and finish the
  // game, so guarantee the minimum die cost while Nova is unbuilt.
  const perfect7nmDies = chapter.novaBuilt
    ? chapter.perfect7nmDies
    : Math.max(chapter.perfect7nmDies, BALANCE.ch6.novaChallenge.perfectDieCost);
  if (missingSupport.length === 0 && perfect7nmDies === chapter.perfect7nmDies) {
    return chapter;
  }

  return {
    ...chapter,
    perfect7nmDies,
    availableChipIds: [...chapter.availableChipIds, ...missingSupport]
  };
}

function chapterProgressFrom(chapter: DatacenterChapterState): ChapterSixProgress {
  return {
    completed: chapter.completed,
    completedAtSeconds: chapter.completedAtSeconds,
    quizCorrect: chapter.quizCorrect,
    stage: chapter.stage,
    buildings: chapter.buildings,
    servedContracts: chapter.servedContracts,
    availableChipIds: chapter.availableChipIds,
    installedChipIds: chapter.installedChipIds,
    novaBuilt: chapter.novaBuilt,
    heat: chapter.heat,
    powerCapacity: chapter.powerCapacity,
    powerLoad: chapter.powerLoad,
    cooling: chapter.cooling,
    networkLinks: chapter.networkLinks,
    batteryCharge: chapter.batteryCharge,
    cityLights: chapter.cityLights,
    eventDeltas: chapter.eventDeltas,
    triggeredEvents: chapter.triggeredEvents,
    firstFacts: chapter.firstFacts
  };
}

function selectedContract(contractId: DatacenterContractId | null): DatacenterContractDefinition | undefined {
  return CONTRACTS.find((contract) => contract.id === contractId);
}

function canAffordBuilding(resources: ResourceState, type: DatacenterBuildingType): boolean {
  const cost = BALANCE.ch6.buildingCosts[type];
  if ((cost.credits ?? 0) > resources.credits || (cost.energy ?? 0) > resources.energy || (cost.water ?? 0) > resources.water) {
    return false;
  }

  for (const [mineral, amount] of Object.entries(cost.minerals ?? {})) {
    if ((resources.minerals[mineral as keyof ResourceState['minerals']] ?? 0) < amount) {
      return false;
    }
  }

  return true;
}

function gridToScreen(column: number, row: number): { x: number; y: number } {
  const offset = row % 2 === 0 ? 26 : 0;
  return {
    x: GRID.x + (column - 1) * GRID.cellWidth + offset,
    y: GRID.y + (row - 1) * GRID.cellHeight
  };
}

function parseColor(color: string): number {
  return Number.parseInt(color.replace('#', ''), 16);
}

function documentRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>('#ui-root');
  if (!root) {
    throw new Error('Missing #ui-root');
  }
  return root;
}
