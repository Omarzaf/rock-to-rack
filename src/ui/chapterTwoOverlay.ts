import type { ResourceState, TextMode } from '../state/types';
import type {
  RefineryBalance,
  RefineryChapterState,
  RefineryLaneId,
  RefineryModuleType
} from '../sim/refinery';
import {
  mountChapterCompleteOverlay,
  mountQuizOverlay,
  type ChapterOneLabels,
  type MountedModal,
  type QuizAnswerDefinition,
  type QuizDefinition
} from './chapterOneOverlay';
import type { TextModeText } from './text';
import { textForMode } from './text';

export interface ChapterTwoLabels {
  purity: TextModeText;
  nines: TextModeText;
  modulePalette: TextModeText;
  rawSilos: TextModeText;
  targets: TextModeText;
  slag: TextModeText;
  recycleSlag: TextModeText;
  storeSlag: TextModeText;
  selectedModule: TextModeText;
  buildModule: TextModeText;
  menu: TextModeText;
  toggleMode: TextModeText;
  quizTitle: TextModeText;
  nextChapter: TextModeText;
  stats: TextModeText;
}

export interface ChapterTwoOverlayOptions {
  resources: ResourceState;
  chapter: RefineryChapterState;
  balance: RefineryBalance;
  labels: ChapterTwoLabels;
  moduleNames: Record<RefineryModuleType, TextModeText>;
  laneNames: Record<RefineryLaneId, TextModeText>;
  selectedModule: RefineryModuleType;
  textMode: TextMode;
  message: TextModeText | null;
  onSelectModule: (moduleType: RefineryModuleType) => void;
  onRecycleSlag: () => void;
  onStoreSlag: () => void;
  onToggleMode: () => void;
  onMenu: () => void;
}

export interface MountedChapterTwoOverlay {
  update: (options: ChapterTwoOverlayOptions) => void;
  cleanup: () => void;
}

const MODULES: RefineryModuleType[] = ['crusher', 'furnace', 'chemicalBath', 'zoneRefiner'];
const LANES: RefineryLaneId[] = ['silicon', 'copper', 'lithium', 'cobalt'];

export function mountChapterTwoOverlay(root: HTMLElement, options: ChapterTwoOverlayOptions): MountedChapterTwoOverlay {
  const shell = document.createElement('section');
  shell.className = 'ch2-overlay';
  root.append(shell);

  const render = (nextOptions: ChapterTwoOverlayOptions): void => {
    shell.replaceChildren(
      purityPanel(nextOptions),
      palettePanel(nextOptions),
      slagPanel(nextOptions),
      actionPanel(nextOptions)
    );
  };

  render(options);

  return {
    update: render,
    cleanup: () => shell.remove()
  };
}

export function mountChapterTwoQuiz(root: HTMLElement, options: {
  quiz: QuizDefinition;
  labels: ChapterTwoLabels;
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

export function mountChapterTwoComplete(root: HTMLElement, options: {
  title: TextModeText;
  body: TextModeText;
  labels: ChapterTwoLabels;
  textMode: TextMode;
  elapsedSeconds: number;
  refinedCount: number;
  onNext: () => void;
}): MountedModal {
  return mountChapterCompleteOverlay(root, {
    title: options.title,
    body: options.body,
    labels: chapterOneLabelBridge(options.labels),
    textMode: options.textMode,
    elapsedSeconds: options.elapsedSeconds,
    minedCount: options.refinedCount,
    journeyChapter: 2,
    onNext: options.onNext
  });
}

function purityPanel(options: ChapterTwoOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch2-purity-panel';

  const header = document.createElement('div');
  header.className = 'ch2-panel-header';

  const title = document.createElement('h2');
  title.textContent = textForMode(options.labels.purity, options.textMode);

  const value = document.createElement('strong');
  value.textContent = `${options.chapter.siliconPurityNines}N`;
  header.append(title, value);

  const rail = document.createElement('div');
  rail.className = 'ch2-purity-rail';
  for (let nine = 2; nine <= 9; nine += 1) {
    const dot = document.createElement('span');
    dot.className = nine <= options.chapter.siliconPurityNines ? 'ch2-purity-dot active' : 'ch2-purity-dot';
    dot.textContent = `${nine}N`;
    rail.append(dot);
  }

  const targets = document.createElement('ul');
  targets.className = 'ch2-target-list';
  for (const lane of LANES.filter((laneId) => laneId !== 'silicon')) {
    const target = options.balance.parallelTargets[lane as Exclude<RefineryLaneId, 'silicon'>] ?? 0;
    if (target <= 0) continue;
    const current = Math.floor(options.chapter.refinedOutputs[lane as Exclude<RefineryLaneId, 'silicon'>] ?? 0);
    const item = document.createElement('li');
    item.textContent = `${textForMode(options.laneNames[lane], options.textMode)} ${Math.min(current, target)}/${target}`;
    if (current >= target) {
      item.className = 'complete';
    }
    targets.append(item);
  }

  panel.append(header, rail, targets);
  return panel;
}

function palettePanel(options: ChapterTwoOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch2-palette-panel';

  const title = document.createElement('h2');
  title.textContent = textForMode(options.labels.modulePalette, options.textMode);

  const buttons = document.createElement('div');
  buttons.className = 'ch2-module-buttons';
  for (const moduleType of MODULES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = moduleType === options.selectedModule ? 'ch2-module-button active' : 'ch2-module-button';
    button.textContent = textForMode(options.moduleNames[moduleType], options.textMode);
    button.addEventListener('click', () => options.onSelectModule(moduleType));
    buttons.append(button);
  }

  if (options.message) {
    const message = document.createElement('p');
    message.className = 'ch2-message';
    message.textContent = textForMode(options.message, options.textMode);
    panel.append(title, buttons, message);
  } else {
    panel.append(title, buttons);
  }

  return panel;
}

function slagPanel(options: ChapterTwoOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch2-slag-panel';

  const label = document.createElement('span');
  label.textContent = textForMode(options.labels.slag, options.textMode);

  const value = document.createElement('strong');
  value.textContent = `${Math.floor(options.chapter.slag)}/${options.balance.slagCap}`;

  const buttons = document.createElement('div');
  buttons.className = 'ch2-slag-actions';

  const recycle = document.createElement('button');
  recycle.type = 'button';
  recycle.className = 'secondary-action';
  recycle.textContent = textForMode(options.labels.recycleSlag, options.textMode);
  recycle.disabled = options.chapter.slag <= 0;
  recycle.addEventListener('click', options.onRecycleSlag);

  const store = document.createElement('button');
  store.type = 'button';
  store.className = 'secondary-action';
  store.textContent = textForMode(options.labels.storeSlag, options.textMode);
  store.disabled = options.chapter.slag <= 0;
  store.addEventListener('click', options.onStoreSlag);

  buttons.append(recycle, store);
  panel.append(label, value, buttons);
  return panel;
}

function actionPanel(options: ChapterTwoOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch2-action-panel';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'toggle-action';
  toggle.textContent = textForMode(options.labels.toggleMode, options.textMode);
  toggle.addEventListener('click', options.onToggleMode);

  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'secondary-action';
  menu.textContent = textForMode(options.labels.menu, options.textMode);
  menu.addEventListener('click', options.onMenu);

  panel.append(toggle, menu);
  return panel;
}

function chapterOneLabelBridge(labels: ChapterTwoLabels): ChapterOneLabels {
  return {
    targetBasket: labels.targets,
    minerSlots: labels.modulePalette,
    selectedDeposit: labels.selectedModule,
    noDeposit: labels.selectedModule,
    placeMiner: labels.buildModule,
    removeMiner: labels.buildModule,
    depleted: labels.slag,
    producing: labels.purity,
    depth: labels.purity,
    remaining: labels.targets,
    cost: labels.slag,
    quizTitle: labels.quizTitle,
    correct: labels.quizTitle,
    tryAgain: labels.quizTitle,
    chapterComplete: labels.purity,
    nextChapter: labels.nextChapter,
    stats: labels.stats,
    menu: labels.menu,
    toggleMode: labels.toggleMode
  };
}
