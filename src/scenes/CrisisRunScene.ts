import Phaser from 'phaser';
import balanceJson from '../content/balance.json';
import {
  createInitialDatacenterChapter,
  placeDatacenterBuilding,
  tickDatacenter,
  type DatacenterBalance,
  type DatacenterChapterState
} from '../sim/datacenter';
import { compareCrisisRunToBest, createCrisisRunResult, elapsedWallClockSeconds } from '../sim/crisisRun';
import { gameStore } from '../state/gameStore';
import type { DatacenterBuildingType, ResourceState } from '../state/types';
import {
  mountCrisisRunOverlay,
  mountCrisisRunResult,
  type MountedCrisisRunOverlay
} from '../ui/crisisRunOverlay';
import { SceneKey } from './sceneKeys';

interface BalanceContent {
  resources: {
    caps: import('../sim/economy').ResourceCaps;
  };
  ch6: DatacenterBalance;
}

interface GridLayout {
  x: number;
  y: number;
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
  labelFontSize: string;
}

const BALANCE = balanceJson as unknown as BalanceContent;
const DESKTOP_GRID: GridLayout = { x: 380, y: 220, cellWidth: 104, cellHeight: 82, columns: 5, rows: 3, labelFontSize: '16px' };
const COMPACT_GRID: GridLayout = { x: 260, y: 250, cellWidth: 152, cellHeight: 112, columns: 5, rows: 3, labelFontSize: '18px' };
const BUILD_TYPES: DatacenterBuildingType[] = ['rack', 'power', 'cooling', 'network', 'battery'];

export class CrisisRunScene extends Phaser.Scene {
  private chapter = createCrisisChapter();
  private resources = createCrisisResources();
  private runStartedAtMs = 0;
  private selectedBuildType: DatacenterBuildingType = 'rack';
  private overlay: MountedCrisisRunOverlay | undefined;
  private resultModal: { cleanup: () => void } | undefined;
  private worldLayer: Phaser.GameObjects.Container | undefined;
  private zones: Phaser.GameObjects.Zone[] = [];
  private heatPeak = 0;
  private mistakes = 0;
  private completed = false;
  private runTimer: Phaser.Time.TimerEvent | undefined;
  private keyboardHandler: ((event: KeyboardEvent) => void) | undefined;
  private readonly resizeHandler = (): void => this.redrawWorld();

  constructor() {
    super(SceneKey.CrisisRun);
  }

  create(): void {
    gameStore.enterScene(SceneKey.CrisisRun);
    this.chapter = createCrisisChapter();
    this.resources = createCrisisResources();
    this.runStartedAtMs = performance.now();
    this.selectedBuildType = 'rack';
    this.heatPeak = 0;
    this.mistakes = 0;
    this.completed = false;
    documentRoot().replaceChildren();
    this.drawBackdrop();
    this.worldLayer = this.add.container(0, 0);
    this.mountOverlay();
    this.bindKeyboard();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.redrawWorld();
    this.runTimer = this.time.addEvent({
      delay: BALANCE.ch6.tickSeconds * 1000,
      loop: true,
      callback: () => this.tickRun(BALANCE.ch6.tickSeconds)
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private mountOverlay(): void {
    this.overlay = mountCrisisRunOverlay(documentRoot(), this.overlayOptions());
  }

  private bindKeyboard(): void {
    this.keyboardHandler = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < BUILD_TYPES.length) {
        this.selectedBuildType = BUILD_TYPES[index];
        this.refreshOverlay();
      }
      if (event.code === 'Space') {
        this.completeIfReady();
      }
    };
    this.input.keyboard?.on('keydown', this.keyboardHandler);
  }

  private tickRun(seconds: number): void {
    if (this.completed) {
      return;
    }

    this.chapter = tickDatacenter(this.chapter, seconds, BALANCE.ch6);
    this.heatPeak = Math.max(this.heatPeak, this.chapter.heat);
    this.refreshOverlay();
    this.redrawWorld();
  }

  private placeBuilding(column: number, row: number): void {
    if (this.completed) {
      return;
    }

    const result = placeDatacenterBuilding(this.chapter, this.resources, this.selectedBuildType, { column, row }, BALANCE.ch6);
    if (!result.ok) {
      this.mistakes += 1;
      this.refreshOverlay(buildFailureMessage(result.reason, this.selectedBuildType));
      return;
    }

    this.chapter = tickDatacenter(result.chapter, 0, BALANCE.ch6);
    this.resources = result.resources;
    this.refreshOverlay();
    this.redrawWorld();
  }

  private completeIfReady(): void {
    if (this.completed) {
      return;
    }

    if (!this.canComplete()) {
      this.mistakes += 1;
      this.refreshOverlay('Nova needs one rack, power, cooling, and network before the city lights can return.');
      return;
    }

    this.completed = true;
    const elapsedSeconds = elapsedWallClockSeconds(this.runStartedAtMs, performance.now());
    this.chapter = {
      ...this.chapter,
      cityLights: 100,
      servedContracts: ['cartoonStream', 'weatherAi', 'cityBackup', 'hospitalNova'],
      completed: true,
      completedAtSeconds: elapsedSeconds,
      stage: 'victory'
    };
    const result = createCrisisRunResult({
      runId: `crisis-${Date.now()}`,
      completedAt: new Date().toISOString(),
      elapsedSeconds,
      cityLights: this.chapter.cityLights,
      servedContracts: this.chapter.servedContracts.length,
      powerEfficiency: this.powerEfficiency(),
      heatPeak: this.heatPeak,
      mistakes: this.mistakes
    });
    const metaBeforeRun = gameStore.getState().meta;
    const previousBest = metaBeforeRun.bestCrisisRun;
    const runNumber = metaBeforeRun.totalCrisisRuns + 1;
    const comparison = compareCrisisRunToBest(previousBest, result);
    gameStore.recordCrisisRunResult(result);
    this.resultModal = mountCrisisRunResult(documentRoot(), {
      result,
      runNumber,
      comparison,
      onCopyResult: (shareLine) => copyResultToClipboard(shareLine),
      onReplay: () => {
        this.resultModal?.cleanup();
        this.resultModal = undefined;
        window.location.hash = 'crisis';
        this.scene.restart();
      },
      onMenu: () => {
        this.resultModal?.cleanup();
        this.resultModal = undefined;
        window.location.hash = 'menu';
        this.scene.start(SceneKey.Menu);
      }
    });
  }

  private canComplete(): boolean {
    return ['rack', 'power', 'cooling', 'network'].every((type) => this.chapter.buildings.some((building) => building.type === type));
  }

  private powerEfficiency(): number {
    if (this.chapter.powerCapacity <= 0) {
      return 0;
    }

    return Math.min(this.chapter.powerLoad / this.chapter.powerCapacity, 1);
  }

  private overlayOptions(message = 'Place one rack, power, cooling, and network. Then serve Nova.'): Parameters<typeof mountCrisisRunOverlay>[1] {
    return {
      elapsedSeconds: this.chapter.elapsedSeconds,
      cityLights: this.chapter.cityLights,
      heat: this.chapter.heat,
      powerLoad: this.chapter.powerLoad,
      powerCapacity: this.chapter.powerCapacity,
      selectedBuildType: this.selectedBuildType,
      canComplete: this.canComplete(),
      message,
      onSelectBuildType: (type) => {
        this.selectedBuildType = type;
        this.refreshOverlay();
      },
      onComplete: () => this.completeIfReady(),
      onMenu: () => {
        window.location.hash = 'menu';
        this.scene.start(SceneKey.Menu);
      }
    };
  }

  private refreshOverlay(message?: string): void {
    this.overlay?.update(this.overlayOptions(message));
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x06111d);
    this.add.rectangle(640, 560, 1280, 220, 0x0d1b2a);
    const skyline = this.add.graphics();
    for (let index = 0; index < 18; index += 1) {
      const x = 58 + index * 68;
      const height = 34 + (index % 5) * 18;
      skyline.fillStyle(0x13293f, 0.96);
      skyline.fillRoundedRect(x, 566 - height, 42, height, 3);
      skyline.fillStyle(index % 2 === 0 ? 0xf8d45c : 0x60d394, 0.28);
      for (let y = 566 - height + 10; y < 552; y += 15) {
        skyline.fillRoundedRect(x + 9, y, 6, 6, 2);
        skyline.fillRoundedRect(x + 25, y, 6, 6, 2);
      }
    }
  }

  private redrawWorld(): void {
    if (!this.worldLayer) {
      return;
    }

    this.worldLayer.removeAll(true);
    this.zones.splice(0).forEach((zone) => zone.destroy());
    const graphics = this.add.graphics();
    this.worldLayer.add(graphics);
    const grid = this.gridLayout();
    graphics.fillStyle(0x071c2a, 0.92);
    graphics.fillRoundedRect(grid.x - 24, grid.y - 24, grid.columns * grid.cellWidth + 48, grid.rows * grid.cellHeight + 48, 10);
    graphics.lineStyle(2, 0x9bf6ff, 0.16);
    graphics.strokeRoundedRect(grid.x - 24, grid.y - 24, grid.columns * grid.cellWidth + 48, grid.rows * grid.cellHeight + 48, 10);

    for (let row = 1; row <= grid.rows; row += 1) {
      for (let column = 1; column <= grid.columns; column += 1) {
        this.drawCell(graphics, grid, column, row);
      }
    }
  }

  private drawCell(graphics: Phaser.GameObjects.Graphics, grid: GridLayout, column: number, row: number): void {
    const x = grid.x + (column - 1) * grid.cellWidth;
    const y = grid.y + (row - 1) * grid.cellHeight;
    const building = this.chapter.buildings.find((candidate) => candidate.column === column && candidate.row === row);
    graphics.fillStyle(building ? colorForBuild(building.type) : 0x0b2536, building ? 0.85 : 0.55);
    graphics.fillRoundedRect(x, y, grid.cellWidth - 10, grid.cellHeight - 10, 8);
    graphics.lineStyle(2, building ? 0xfff7d6 : 0x60a5fa, building ? 0.72 : 0.18);
    graphics.strokeRoundedRect(x, y, grid.cellWidth - 10, grid.cellHeight - 10, 8);
    if (building) {
      const label = this.add.text(x + 16, y + 20, labelForBuild(building.type), {
        color: '#06111d',
        fontFamily: 'Nunito, system-ui',
        fontSize: grid.labelFontSize,
        fontStyle: '900'
      });
      this.worldLayer?.add(label);
    }
    const zone = this.add.zone(x + (grid.cellWidth - 10) / 2, y + (grid.cellHeight - 10) / 2, grid.cellWidth - 10, grid.cellHeight - 10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.placeBuilding(column, row));
    this.zones.push(zone);
  }

  private gridLayout(): GridLayout {
    const parentWidth = this.scale.parentSize.width || viewportWidth();
    const parentHeight = this.scale.parentSize.height || viewportHeight();
    return parentWidth <= 760 && parentHeight > parentWidth ? COMPACT_GRID : DESKTOP_GRID;
  }

  private cleanup(): void {
    this.overlay?.cleanup();
    this.overlay = undefined;
    this.resultModal?.cleanup();
    this.resultModal = undefined;
    this.runTimer?.remove(false);
    this.runTimer = undefined;
    if (this.keyboardHandler) {
      this.input.keyboard?.off('keydown', this.keyboardHandler);
      this.keyboardHandler = undefined;
    }
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.zones.splice(0).forEach((zone) => zone.destroy());
  }
}

function createCrisisChapter(): DatacenterChapterState {
  return createInitialDatacenterChapter({
    completed: true,
    completedAtSeconds: 0,
    quizCorrect: true,
    sortedDies: 24,
    bins: { perfect: 8, good: 10, salvage: 6 },
    selectedChipIds: ['cpu', 'gpu', 'dram', 'nand', 'nic', 'pmic', 'nova'],
    builtChips: [],
    perfect7nmDies: 2,
    triggeredEvents: [],
    firstFacts: []
  }, BALANCE.ch6);
}

function createCrisisResources(): ResourceState {
  return {
    minerals: { quartz: 0, copper: 0, lithium: 6, cobalt: 4, rareEarths: 0 },
    wafers: 0,
    chips: 0,
    energy: 100,
    water: 100,
    credits: 700
  };
}

function documentRoot(): HTMLElement {
  const root = document.getElementById('ui-root');
  if (!root) {
    throw new Error('Missing #ui-root element');
  }
  return root;
}

function viewportWidth(): number {
  return typeof window === 'undefined' ? 1280 : window.innerWidth;
}

function viewportHeight(): number {
  return typeof window === 'undefined' ? 720 : window.innerHeight;
}

async function copyResultToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard?.writeText(text);
    if (navigator.clipboard) {
      return true;
    }
  } catch {
    // Fall back below for browsers that hide navigator.clipboard.
  }

  const fallback = document.createElement('textarea');
  fallback.value = text;
  fallback.setAttribute('readonly', 'true');
  fallback.style.position = 'fixed';
  fallback.style.left = '-9999px';
  document.body.append(fallback);
  fallback.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    fallback.remove();
  }
}

function colorForBuild(type: DatacenterBuildingType): number {
  return {
    rack: 0x60a5fa,
    power: 0xf8d45c,
    cooling: 0x22d3ee,
    network: 0x60d394,
    battery: 0xa78bfa
  }[type];
}

function labelForBuild(type: DatacenterBuildingType): string {
  return {
    rack: 'RACK',
    power: 'POWER',
    cooling: 'COOL',
    network: 'NET',
    battery: 'BATT'
  }[type];
}

function buildFailureMessage(
  reason: 'out of bounds' | 'occupied' | 'insufficient resources' | undefined,
  type: DatacenterBuildingType
): string {
  if (reason === 'occupied') {
    return 'That cell already has a system. Pick an empty grid cell.';
  }

  if (reason === 'insufficient resources') {
    return `Not enough resources for ${labelForBuild(type)}. Try a cheaper system or replay for a stronger setup.`;
  }

  return 'That spot is outside the rack floor. Tap inside the highlighted grid.';
}
