import type {
  ChipTypeId,
  DatacenterBuildingType,
  DatacenterContractId,
  DatacenterStage,
  ResourceState,
  TextMode
} from '../state/types';
import type {
  DatacenterBalance,
  DatacenterChapterState,
  DatacenterContractDefinition
} from '../sim/datacenter';
import type { ChipDefinition } from '../sim/package';
import {
  mountQuizOverlay,
  type ChapterOneLabels,
  type MountedModal,
  type QuizAnswerDefinition,
  type QuizDefinition
} from './chapterOneOverlay';
import type { TextModeText } from './text';
import { appendJourneyBlock } from './chapterJourney';
import { textForMode } from './text';

export interface ChapterSixLabels {
  stage: TextModeText;
  credits: TextModeText;
  heat: TextModeText;
  power: TextModeText;
  cooling: TextModeText;
  network: TextModeText;
  battery: TextModeText;
  compute: TextModeText;
  contracts: TextModeText;
  cityLights: TextModeText;
  buildRack: TextModeText;
  buildPower: TextModeText;
  buildCooling: TextModeText;
  buildNetwork: TextModeText;
  buildBattery: TextModeText;
  installChip: TextModeText;
  serveContract: TextModeText;
  novaChallenge: TextModeText;
  nextChapter: TextModeText;
  quizTitle: TextModeText;
  stats: TextModeText;
  menu: TextModeText;
  toggleMode: TextModeText;
}

export interface ChapterSixOverlayOptions {
  chapter: DatacenterChapterState;
  balance: DatacenterBalance;
  contracts: DatacenterContractDefinition[];
  chips: ChipDefinition[];
  resources: ResourceState;
  labels: ChapterSixLabels;
  stageNames: Record<DatacenterStage, TextModeText>;
  textMode: TextMode;
  message: TextModeText | null;
  selectedBuildType: DatacenterBuildingType;
  selectedBuildingId: string | null;
  selectedChipId: ChipTypeId | null;
  selectedContractId: DatacenterContractId | null;
  canBuildType: Record<DatacenterBuildingType, boolean>;
  canInstallSelectedChip: boolean;
  canServeSelectedContract: boolean;
  canRunNovaChallenge: boolean;
  onSelectBuildType(type: DatacenterBuildingType): void;
  onSelectChip(chipId: ChipTypeId): void;
  onInstallSelectedChip(): void;
  onSelectContract(contractId: DatacenterContractId): void;
  onServeSelectedContract(): void;
  onRunNovaChallenge(): void;
  onToggleMode(): void;
  onMenu(): void;
}

export interface MountedChapterSixOverlay {
  update: (options: ChapterSixOverlayOptions) => void;
  cleanup: () => void;
}

const BUILD_TYPES: Array<{
  type: DatacenterBuildingType;
  labelKey: keyof Pick<ChapterSixLabels, 'buildRack' | 'buildPower' | 'buildCooling' | 'buildNetwork' | 'buildBattery'>;
}> = [
  { type: 'rack', labelKey: 'buildRack' },
  { type: 'power', labelKey: 'buildPower' },
  { type: 'cooling', labelKey: 'buildCooling' },
  { type: 'network', labelKey: 'buildNetwork' },
  { type: 'battery', labelKey: 'buildBattery' }
];

export function mountChapterSixOverlay(root: HTMLElement, options: ChapterSixOverlayOptions): MountedChapterSixOverlay {
  const shell = document.createElement('section');
  shell.className = 'ch6-overlay';
  root.append(shell);

  const render = (nextOptions: ChapterSixOverlayOptions): void => {
    shell.replaceChildren(
      statusPanel(nextOptions),
      buildPanel(nextOptions),
      chipPanel(nextOptions),
      contractPanel(nextOptions),
      actionPanel(nextOptions)
    );
  };

  render(options);

  return {
    update: render,
    cleanup: () => shell.remove()
  };
}

export function mountChapterSixQuiz(root: HTMLElement, options: {
  quiz: QuizDefinition;
  labels: ChapterSixLabels;
  textMode: TextMode;
  onAnswer: (answer: QuizAnswerDefinition) => void;
}): MountedModal {
  return mountQuizOverlay(root, {
    quiz: options.quiz,
    labels: chapterOneLabelBridge(options.labels),
    textMode: options.textMode,
    onAnswer: options.onAnswer
  });
}

export function mountChapterSixComplete(root: HTMLElement, options: {
  title: TextModeText;
  body: TextModeText;
  tablet: TextModeText;
  labels: ChapterSixLabels;
  textMode: TextMode;
  elapsedSeconds: number;
  servedContracts: number;
  cityLights: number;
  installedChipIds: ChipTypeId[];
  epilogue: Array<{ title: TextModeText; caption: TextModeText }>;
  onNext: () => void;
}): MountedModal {
  let textMode = options.textMode;

  const backdrop = document.createElement('section');
  backdrop.className = 'ch1-modal-backdrop';
  root.append(backdrop);

  const render = (): void => {
    const card = document.createElement('article');
    card.className = 'ch1-complete-card ch6-complete-card';

    const title = document.createElement('h2');
    title.textContent = textForMode(options.title, textMode);

    const body = document.createElement('p');
    body.textContent = textForMode(options.body, textMode);

    const tablet = document.createElement('div');
    tablet.className = 'ch6-tablet';
    tablet.append(
      elementWithText('span', 'ch6-tablet-light', ''),
      elementWithText('strong', '', textForMode(options.tablet, textMode))
    );

    const stats = document.createElement('div');
    stats.className = 'ch6-complete-stats';
    stats.append(
      statChip(textForMode(options.labels.stats, textMode), `${Math.round(options.elapsedSeconds)}s`),
      statChip(textForMode(options.labels.contracts, textMode), String(options.servedContracts)),
      statChip(textForMode(options.labels.cityLights, textMode), `${Math.round(options.cityLights)}%`),
      statChip(textForMode(options.labels.compute, textMode), String(options.installedChipIds.length))
    );

    const epilogue = document.createElement('div');
    epilogue.className = 'ch6-epilogue-grid';
    for (const entry of options.epilogue) {
      const item = document.createElement('section');
      item.className = 'ch6-epilogue-card';
      item.append(
        elementWithText('strong', '', textForMode(entry.title, textMode)),
        elementWithText('p', '', textForMode(entry.caption, textMode))
      );
      epilogue.append(item);
    }

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'primary-action';
    next.textContent = textForMode(options.labels.nextChapter, textMode);
    let nextClicked = false;
    const goNext = (): void => {
      if (nextClicked) {
        return;
      }

      nextClicked = true;
      options.onNext();
    };
    next.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      goNext();
    });
    next.addEventListener('click', goNext);

    card.append(title, body, tablet, stats, epilogue);
    appendJourneyBlock(card, 6, textMode);
    card.append(next);
    backdrop.replaceChildren(card);
  };

  render();

  return {
    updateMode: (nextTextMode) => {
      textMode = nextTextMode;
      render();
    },
    cleanup: () => backdrop.remove()
  };
}

function statusPanel(options: ChapterSixOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch6-status-panel';

  panel.append(
    statBlock(textForMode(options.labels.stage, options.textMode), textForMode(options.stageNames[options.chapter.stage], options.textMode)),
    statBlock(textForMode(options.labels.heat, options.textMode), `${Math.round(options.chapter.heat)}%`),
    statBlock(textForMode(options.labels.power, options.textMode), `${Math.round(options.chapter.powerLoad)}/${Math.round(options.chapter.powerCapacity)}`),
    statBlock(textForMode(options.labels.cooling, options.textMode), String(Math.round(options.chapter.cooling))),
    statBlock(textForMode(options.labels.network, options.textMode), String(Math.round(options.chapter.networkLinks))),
    statBlock(textForMode(options.labels.battery, options.textMode), String(Math.round(options.chapter.batteryCharge))),
    statBlock(textForMode(options.labels.compute, options.textMode), String(Math.round(options.chapter.effectiveCompute))),
    statBlock(textForMode(options.labels.cityLights, options.textMode), `${Math.round(options.chapter.cityLights)}%`)
  );

  return panel;
}

function buildPanel(options: ChapterSixOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch6-build-panel';

  for (const entry of BUILD_TYPES) {
    const button = panelButton(
      textForMode(options.labels[entry.labelKey], options.textMode),
      () => options.onSelectBuildType(entry.type),
      !options.canBuildType[entry.type]
    );
    button.classList.add(`ch6-build-${entry.type}`);
    if (options.selectedBuildType === entry.type) {
      button.classList.add('is-selected');
    }
    panel.append(button);
  }

  return panel;
}

function chipPanel(options: ChapterSixOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch6-chip-panel';

  const heading = document.createElement('h2');
  heading.textContent = textForMode(options.labels.installChip, options.textMode);

  const selectedRack = options.chapter.buildings.find((building) => building.id === options.selectedBuildingId && building.type === 'rack');
  const slotLine = document.createElement('p');
  slotLine.className = 'ch6-panel-note';
  slotLine.textContent = selectedRack
    ? `${selectedRack.id}: ${selectedRack.installedChipIds.length}/${options.balance.rackChipSlots}`
    : textForMode(options.message ?? options.labels.installChip, options.textMode);

  const cards = document.createElement('div');
  cards.className = 'ch6-chip-list';
  for (const chip of options.chips) {
    const available = options.chapter.availableChipIds.includes(chip.id);
    const installed = options.chapter.installedChipIds.includes(chip.id);
    if (chip.id === 'nova' && !available && !installed && !options.chapter.novaBuilt) {
      continue;
    }
    cards.append(chipCard(options, chip, available, installed));
  }

  const install = panelButton(textForMode(options.labels.installChip, options.textMode), options.onInstallSelectedChip, !options.canInstallSelectedChip);
  install.classList.add('ch6-install-action');

  panel.append(heading, slotLine, cards, install);
  return panel;
}

function chipCard(options: ChapterSixOverlayOptions, chip: ChipDefinition, available: boolean, installed: boolean): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'ch6-chip-card';
  card.style.setProperty('--chip-color', chip.cardColor);
  card.disabled = !available || installed;
  card.addEventListener('click', () => options.onSelectChip(chip.id));

  if (options.selectedChipId === chip.id) {
    card.classList.add('is-selected');
  }
  if (installed) {
    card.classList.add('is-installed');
  }
  if (!available && !installed) {
    card.classList.add('is-locked');
  }

  const face = elementWithText('span', 'ch6-chip-face', textForMode(chip.name, options.textMode).slice(0, 4).toUpperCase());
  const text = document.createElement('span');
  text.className = 'ch6-chip-text';
  text.append(
    elementWithText('strong', '', textForMode(chip.name, options.textMode)),
    elementWithText('small', '', installed ? 'Installed' : available ? textForMode(chip.nickname, options.textMode) : 'Locked')
  );
  card.append(face, text);
  return card;
}

function contractPanel(options: ChapterSixOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch6-contract-panel';

  const heading = document.createElement('h2');
  heading.textContent = textForMode(options.labels.contracts, options.textMode);

  const ticker = document.createElement('p');
  ticker.className = 'ch6-contract-ticker';
  ticker.textContent = options.message ? textForMode(options.message, options.textMode) : `${textForMode(options.labels.credits, options.textMode)} ${Math.floor(options.resources.credits)}`;

  const list = document.createElement('div');
  list.className = 'ch6-contract-list';
  for (const contract of options.contracts) {
    list.append(contractCard(options, contract));
  }

  panel.append(heading, ticker, list);
  return panel;
}

function contractCard(options: ChapterSixOverlayOptions, contract: DatacenterContractDefinition): HTMLElement {
  const served = options.chapter.servedContracts.includes(contract.id);
  const selected = options.selectedContractId === contract.id;
  const missing = contract.requiredChipIds.filter((chipId) => !options.chapter.installedChipIds.includes(chipId));
  const blocked = served
    || missing.length > 0
    || options.chapter.effectiveCompute < contract.requiredCompute
    || options.chapter.networkLinks < contract.requiredNetworkLinks
    || options.chapter.powerLoad > options.chapter.powerCapacity
    || options.chapter.heat >= options.balance.heatThrottle
    || (contract.id === 'hospitalNova' && (options.chapter.stage !== 'nova' || !options.chapter.novaBuilt));

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'ch6-contract-card';
  card.addEventListener('click', () => options.onSelectContract(contract.id));
  if (selected) {
    card.classList.add('is-selected');
  }
  if (served) {
    card.classList.add('is-served');
  }
  if (blocked) {
    card.classList.add('is-blocked');
  } else {
    card.classList.add('is-ready');
  }

  const status = served ? 'Served' : blocked ? 'Blocked' : 'Ready';
  card.append(
    elementWithText('strong', '', textForMode(contract.title, options.textMode)),
    elementWithText('small', '', status),
    elementWithText('span', 'ch6-contract-requirements', `Chips: ${contract.requiredChipIds.join(', ')} | Compute ${contract.requiredCompute} | Net ${contract.requiredNetworkLinks}`),
    elementWithText('span', 'ch6-contract-reward', `+${contract.rewardCredits} / +${contract.cityLights}%`)
  );
  return card;
}

function actionPanel(options: ChapterSixOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch6-action-panel';
  panel.append(
    panelButton(textForMode(options.labels.serveContract, options.textMode), options.onServeSelectedContract, !options.canServeSelectedContract, 'primary-action'),
    panelButton(textForMode(options.labels.novaChallenge, options.textMode), options.onRunNovaChallenge, !options.canRunNovaChallenge, 'secondary-action'),
    panelButton(textForMode(options.labels.toggleMode, options.textMode), options.onToggleMode, false, 'toggle-action'),
    panelButton(textForMode(options.labels.menu, options.textMode), options.onMenu, false, 'secondary-action')
  );
  return panel;
}

function statBlock(labelText: string, valueText: string): HTMLElement {
  const block = document.createElement('span');
  block.className = 'ch6-stat-block';
  block.append(
    elementWithText('small', '', labelText),
    elementWithText('strong', '', valueText)
  );
  return block;
}

function statChip(labelText: string, valueText: string): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'ch6-stat-chip';
  chip.append(
    elementWithText('small', '', labelText),
    elementWithText('strong', '', valueText)
  );
  return chip;
}

function panelButton(label: string, onClick: () => void, disabled: boolean, className = 'ch6-panel-button'): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.disabled = disabled;
  element.addEventListener('click', onClick);
  return element;
}

function elementWithText<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function chapterOneLabelBridge(labels: ChapterSixLabels): ChapterOneLabels {
  return {
    targetBasket: labels.stage,
    minerSlots: labels.compute,
    selectedDeposit: labels.contracts,
    noDeposit: labels.stats,
    placeMiner: labels.buildRack,
    removeMiner: labels.buildCooling,
    depleted: labels.heat,
    producing: labels.power,
    depth: labels.network,
    remaining: labels.cityLights,
    cost: labels.credits,
    quizTitle: labels.quizTitle,
    correct: labels.serveContract,
    tryAgain: labels.novaChallenge,
    chapterComplete: labels.nextChapter,
    nextChapter: labels.nextChapter,
    stats: labels.stats,
    menu: labels.menu,
    toggleMode: labels.toggleMode
  };
}
