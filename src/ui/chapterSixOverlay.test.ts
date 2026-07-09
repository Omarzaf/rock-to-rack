import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import chipsJson from '../content/chips.json';
import stringsJson from '../content/strings.json';
import { createInitialDatacenterChapter, type DatacenterBalance, type DatacenterContractDefinition } from '../sim/datacenter';
import type { ChipDefinition } from '../sim/package';
import type { ChapterFiveProgress } from '../state/types';
import { mountChapterSixOverlay } from './chapterSixOverlay';
import { textForMode } from './text';

const balance: DatacenterBalance = {
  tickSeconds: 1,
  grid: { columns: 3, rows: 3 },
  rackChipSlots: 3,
  contractsToUnlockNova: 3,
  heatWarning: 70,
  heatThrottle: 85,
  maxHeat: 100,
  startingPowerCapacity: 10,
  startingCooling: 2,
  startingNetworkLinks: 0,
  startingBatteryCharge: 5,
  buildingCosts: {
    rack: { credits: 50, chips: 1 },
    power: { credits: 40, minerals: { copper: 2 } },
    cooling: { credits: 30, water: 5 },
    network: { credits: 25, minerals: { rareEarths: 1 } },
    battery: { credits: 20, minerals: { lithium: 2 } }
  },
  buildingStats: {
    rack: { powerLoad: 8, heatRate: 10, compute: 20 },
    power: { powerCapacity: 35 },
    cooling: { cooling: 10, waterLoad: 1 },
    network: { networkLinks: 1 },
    battery: { batteryCharge: 25 }
  },
  chipEffects: {
    cpu: { computeBonus: 10, powerLoad: 4, heatRate: 3 },
    gpu: { computeMultiplier: 1.5, powerLoad: 8, heatRate: 8 },
    dram: { computeBonus: 5, rewardMultiplier: 1.25, powerLoad: 2, heatRate: 1 },
    nand: { computeBonus: 2, powerLoad: 1 },
    nic: { networkMultiplier: 1.2, powerLoad: 2, heatRate: 1 },
    pmic: { powerMultiplier: 0.8, heatRate: -1 },
    nova: { computeMultiplier: 2, aiEnabled: true, powerLoad: 12, heatRate: 6, blackoutProtection: 20 }
  },
  novaChallenge: { requiredAverageScore: 80, perfectDieCost: 1 },
  pacingTargetSeconds: { min: 360, max: 720 }
};

const ch5: ChapterFiveProgress = {
  completed: true,
  completedAtSeconds: 1020,
  quizCorrect: true,
  sortedDies: 18,
  bins: { perfect: 2, good: 4, salvage: 2 },
  selectedChipIds: ['cpu', 'gpu', 'dram', 'pmic', 'nic'],
  builtChips: [],
  perfect7nmDies: 2,
  triggeredEvents: [],
  firstFacts: []
};

const cartoonStream: DatacenterContractDefinition = {
  id: 'cartoonStream',
  title: { kid: 'Cartoons', nerd: 'Cartoon Stream' },
  description: { kid: 'Serve shows.', nerd: 'Serve video workloads.' },
  requiredChipIds: ['cpu'],
  requiredCompute: 20,
  requiredNetworkLinks: 1,
  rewardCredits: 100,
  cityLights: 20
};

const hospitalNova: DatacenterContractDefinition = {
  ...cartoonStream,
  id: 'hospitalNova',
  requiredChipIds: ['nova'],
  requiredCompute: 80,
  rewardCredits: 200,
  cityLights: 50
};

const chips = chipsJson as unknown as ChipDefinition[];
const cpuChip = chips.find((chip) => chip.id === 'cpu');
const novaChip = chips.find((chip) => chip.id === 'nova');

beforeEach(() => {
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chapter six overlay', () => {
  it('opens on a single mission-focused view with secondary panels hidden behind switchers', () => {
    const root = document.createElement('div');
    const chapter = createInitialDatacenterChapter(ch5, balance);

    mountChapterSixOverlay(root, {
      chapter,
      balance,
      contracts: [cartoonStream, hospitalNova],
      chips: [cpuChip!, novaChip!],
      resources: {
        minerals: { quartz: 0, copper: 0, lithium: 0, cobalt: 0, rareEarths: 0 },
        wafers: 0,
        chips: 0,
        energy: 0,
        water: 0,
        credits: 0
      },
      labels: stringsJson.ch6.labels,
      stageNames: stringsJson.ch6.stageNames,
      textMode: 'nerd',
      message: null,
      selectedBuildType: 'rack',
      selectedBuildingId: null,
      selectedChipId: null,
      selectedContractId: 'cartoonStream',
      canBuildType: { rack: true, power: true, cooling: true, network: true, battery: true },
      canInstallSelectedChip: false,
      canServeSelectedContract: false,
      canRunNovaChallenge: false,
      onSelectBuildType: () => undefined,
      onSelectChip: () => undefined,
      onInstallSelectedChip: () => undefined,
      onSelectContract: () => undefined,
      onServeSelectedContract: () => undefined,
      onRunNovaChallenge: () => undefined,
      onToggleMode: () => undefined,
      onMenu: () => undefined
    });

    expect(root.textContent).toContain(textForMode(stringsJson.ch6.labels.novaChallenge, 'nerd'));
    expect(root.textContent).toContain('contracts are feeding the city lights');
    expect(root.textContent).toContain(textForMode(stringsJson.ch6.labels.buildRack, 'nerd'));
    expect(root.textContent).not.toContain('Cartoon Stream');
    expect(root.textContent).not.toContain(textForMode(cpuChip!.name, 'nerd'));

    const shell = firstChild(root);
    expect(findButton(shell, textForMode(stringsJson.ch6.labels.buildRack, 'nerd')).getAttribute('aria-pressed')).toBe('true');
    const switcher = findButton(shell, textForMode(stringsJson.ch6.labels.installChip, 'nerd'));
    switcher.click();

    expect(root.textContent).toContain(textForMode(stringsJson.ch6.labels.installChip, 'nerd'));
    expect(root.textContent).toContain(textForMode(cpuChip!.name, 'nerd'));
    expect(root.textContent).not.toContain('Cartoon Stream');

    findButton(shell, textForMode(stringsJson.ch6.labels.contracts, 'nerd')).click();
    expect(root.textContent).toContain('Cartoon Stream');
    findButton(firstChild(root), textForMode(stringsJson.ch6.labels.contracts, 'nerd')).click();

    expect(root.textContent).toContain('Blocked: missing chip: cpu');
  });

  it('shows exact blocked reasons for contract requirements', () => {
    const root = document.createElement('div');
    const chapter = createInitialDatacenterChapter(ch5, balance);

    mountChapterSixOverlay(root, {
      chapter,
      balance,
      contracts: [cartoonStream],
      chips: [cpuChip!],
      resources: {
        minerals: { quartz: 0, copper: 0, lithium: 0, cobalt: 0, rareEarths: 0 },
        wafers: 0,
        chips: 0,
        energy: 0,
        water: 0,
        credits: 0
      },
      labels: stringsJson.ch6.labels,
      stageNames: stringsJson.ch6.stageNames,
      textMode: 'nerd',
      message: null,
      selectedBuildType: 'rack',
      selectedBuildingId: null,
      selectedChipId: null,
      selectedContractId: 'cartoonStream',
      canBuildType: { rack: true, power: true, cooling: true, network: true, battery: true },
      canInstallSelectedChip: false,
      canServeSelectedContract: false,
      canRunNovaChallenge: false,
      onSelectBuildType: () => undefined,
      onSelectChip: () => undefined,
      onInstallSelectedChip: () => undefined,
      onSelectContract: () => undefined,
      onServeSelectedContract: () => undefined,
      onRunNovaChallenge: () => undefined,
      onToggleMode: () => undefined,
      onMenu: () => undefined
    });

    findButton(firstChild(root), textForMode(stringsJson.ch6.labels.contracts, 'nerd')).click();

    expect(root.textContent).toContain('Blocked: missing chip: cpu');
    expect(root.textContent).toContain('insufficient network');
  });

  it('shows nova lock as an exact blocked reason when the finale is unavailable', () => {
    const root = document.createElement('div');
    const chapter = {
      ...createInitialDatacenterChapter(ch5, balance),
      stage: 'build' as const,
      effectiveCompute: 80,
      networkLinks: 1,
      powerLoad: 10,
      powerCapacity: 20,
      heat: 0,
      installedChipIds: ['nova' as const]
    };

    mountChapterSixOverlay(root, {
      chapter,
      balance,
      contracts: [hospitalNova],
      chips: [novaChip!],
      resources: {
        minerals: { quartz: 0, copper: 0, lithium: 0, cobalt: 0, rareEarths: 0 },
        wafers: 0,
        chips: 0,
        energy: 0,
        water: 0,
        credits: 0
      },
      labels: stringsJson.ch6.labels,
      stageNames: stringsJson.ch6.stageNames,
      textMode: 'nerd',
      message: null,
      selectedBuildType: 'rack',
      selectedBuildingId: null,
      selectedChipId: null,
      selectedContractId: 'hospitalNova',
      canBuildType: { rack: true, power: true, cooling: true, network: true, battery: true },
      canInstallSelectedChip: false,
      canServeSelectedContract: false,
      canRunNovaChallenge: false,
      onSelectBuildType: () => undefined,
      onSelectChip: () => undefined,
      onInstallSelectedChip: () => undefined,
      onSelectContract: () => undefined,
      onServeSelectedContract: () => undefined,
      onRunNovaChallenge: () => undefined,
      onToggleMode: () => undefined,
      onMenu: () => undefined
    });

    findButton(firstChild(root), textForMode(stringsJson.ch6.labels.contracts, 'nerd')).click();

    expect(root.textContent).toContain('nova locked');
  });

  it('does not show blocked reason text for already served contracts', () => {
    const root = document.createElement('div');
    const chapter = {
      ...createInitialDatacenterChapter(ch5, balance),
      servedContracts: ['cartoonStream' as const]
    };

    mountChapterSixOverlay(root, {
      chapter,
      balance,
      contracts: [cartoonStream],
      chips: [cpuChip!],
      resources: {
        minerals: { quartz: 0, copper: 0, lithium: 0, cobalt: 0, rareEarths: 0 },
        wafers: 0,
        chips: 0,
        energy: 0,
        water: 0,
        credits: 0
      },
      labels: stringsJson.ch6.labels,
      stageNames: stringsJson.ch6.stageNames,
      textMode: 'nerd',
      message: null,
      selectedBuildType: 'rack',
      selectedBuildingId: null,
      selectedChipId: null,
      selectedContractId: 'cartoonStream',
      canBuildType: { rack: true, power: true, cooling: true, network: true, battery: true },
      canInstallSelectedChip: false,
      canServeSelectedContract: false,
      canRunNovaChallenge: false,
      onSelectBuildType: () => undefined,
      onSelectChip: () => undefined,
      onInstallSelectedChip: () => undefined,
      onSelectContract: () => undefined,
      onServeSelectedContract: () => undefined,
      onRunNovaChallenge: () => undefined,
      onToggleMode: () => undefined,
      onMenu: () => undefined
    });

    findButton(firstChild(root), textForMode(stringsJson.ch6.labels.contracts, 'nerd')).click();

    expect(root.textContent).toContain('Served');
    expect(root.textContent).not.toContain('Blocked:');
  });
});

class FakeDocument {
  createElement(tagName: string): HTMLElement {
    return new FakeElement(tagName) as unknown as HTMLElement;
  }
}

class FakeElement {
  className = '';
  disabled = false;
  type = '';
  readonly children: FakeElement[] = [];
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Array<() => void>>();
  classList = {
    add: (...classes: string[]) => {
      this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...classes])].join(' ');
    }
  };
  style = {
    setProperty: () => undefined
  };
  private ownText = '';
  private parent: FakeElement | undefined;

  constructor(_tagName: string) {}

  get textContent(): string {
    return `${this.ownText}${this.children.map((child) => child.textContent).join('')}`;
  }

  set textContent(value: string | null) {
    this.ownText = value ?? '';
    this.children.length = 0;
  }

  append(...nodes: Array<FakeElement | HTMLElement>): void {
    for (const node of nodes) {
      const child = node as unknown as FakeElement;
      child.parent = this;
      this.children.push(child);
    }
  }

  replaceChildren(...nodes: Array<FakeElement | HTMLElement>): void {
    this.children.length = 0;
    this.ownText = '';
    this.append(...nodes);
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  addEventListener(type: string, handler: () => void): void {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  click(): void {
    if (this.disabled) {
      return;
    }

    for (const handler of this.listeners.get('click') ?? []) {
      handler();
    }
  }

  private removeChild(child: FakeElement): void {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
    child.parent = undefined;
  }
}

function firstChild(root: FakeElement | HTMLElement): FakeElement {
  return (root as unknown as FakeElement).children[0];
}

function findButton(root: FakeElement, label: string): FakeElement {
  const stack = [...root.children];
  while (stack.length > 0) {
    const node = stack.shift()!;
    if (node.type === 'button' && node.textContent === label) {
      return node;
    }
    stack.unshift(...node.children);
  }

  throw new Error(`Missing button: ${label}`);
}
