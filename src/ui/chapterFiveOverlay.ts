import type { ChipDefinition, PackageBalance, PackageChapterState, PackageStage, TestDie } from '../sim/package';
import type { DieBinId, ChipTypeId, TextMode } from '../state/types';
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

export interface ChapterFiveLabels {
  stage: TextModeText;
  sorted: TextModeText;
  activeDie: TextModeText;
  perfect: TextModeText;
  good: TextModeText;
  salvage: TextModeText;
  score: TextModeText;
  node: TextModeText;
  cutWafer: TextModeText;
  startSort: TextModeText;
  sortPerfect: TextModeText;
  sortGood: TextModeText;
  sortSalvage: TextModeText;
  buildChip: TextModeText;
  nextChapter: TextModeText;
  quizTitle: TextModeText;
  stats: TextModeText;
  menu: TextModeText;
  toggleMode: TextModeText;
}

export interface ChapterFiveOverlayOptions {
  chapter: PackageChapterState;
  balance: PackageBalance;
  chips: ChipDefinition[];
  labels: ChapterFiveLabels;
  stageNames: Record<PackageStage, TextModeText>;
  textMode: TextMode;
  message: TextModeText | null;
  activeDie: TestDie | null;
  selectedChip: ChipDefinition | null;
  canCutWafer: boolean;
  canStartSort: boolean;
  canSortPerfect: boolean;
  canSortGood: boolean;
  canSortSalvage: boolean;
  canBuildSelected: boolean;
  canAdvanceToQuiz: boolean;
  onCutWafer: () => void;
  onStartSort: () => void;
  onSortDie: (bin: DieBinId) => void;
  onSelectChip: (chipId: ChipTypeId) => void;
  onBuildSelectedChip: () => void;
  onAdvanceToQuiz: () => void;
  onToggleMode: () => void;
  onMenu: () => void;
}

export interface MountedChapterFiveOverlay {
  update: (options: ChapterFiveOverlayOptions) => void;
  cleanup: () => void;
}

export function mountChapterFiveOverlay(root: HTMLElement, options: ChapterFiveOverlayOptions): MountedChapterFiveOverlay {
  const shell = document.createElement('section');
  shell.className = 'ch5-overlay';
  root.append(shell);

  const render = (nextOptions: ChapterFiveOverlayOptions): void => {
    const children = [
      statusPanel(nextOptions),
      stagePanel(nextOptions),
      actionPanel(nextOptions)
    ];
    if (nextOptions.chapter.stage === 'roster' || nextOptions.chapter.stage === 'complete') {
      children.splice(2, 0, rosterPanel(nextOptions));
    }
    shell.replaceChildren(...children);
  };

  render(options);

  return {
    update: render,
    cleanup: () => shell.remove()
  };
}

export function mountChapterFiveQuiz(root: HTMLElement, options: {
  quiz: QuizDefinition;
  labels: ChapterFiveLabels;
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

export function mountChapterFiveComplete(root: HTMLElement, options: {
  title: TextModeText;
  body: TextModeText;
  labels: ChapterFiveLabels;
  chipsLabel: TextModeText;
  textMode: TextMode;
  elapsedSeconds: number;
  sortedCount: number;
  builtCount: number;
  perfect7nmDies: number;
  selectedChips: ChipDefinition[];
  onNext: () => void;
}): MountedModal {
  let textMode = options.textMode;

  const backdrop = document.createElement('section');
  backdrop.className = 'ch1-modal-backdrop';
  root.append(backdrop);

  const render = (): void => {
    const card = document.createElement('article');
    card.className = 'ch1-complete-card ch5-complete-card';

    const title = document.createElement('h2');
    title.textContent = textForMode(options.title, textMode);

    const body = document.createElement('p');
    body.textContent = textForMode(options.body, textMode);

    const stats = document.createElement('div');
    stats.className = 'ch5-complete-stats';
    stats.append(
      statChip(textForMode(options.labels.stats, textMode), `${Math.round(options.elapsedSeconds)}s`),
      statChip(textForMode(options.labels.sorted, textMode), String(options.sortedCount)),
      statChip(textForMode(options.chipsLabel, textMode), String(options.builtCount)),
      statChip(textForMode(options.labels.perfect, textMode), String(options.perfect7nmDies))
    );

    const lineup = document.createElement('div');
    lineup.className = 'ch5-lineup-list';
    for (const chip of options.selectedChips) {
      const item = document.createElement('span');
      item.className = 'ch5-lineup-chip';
      item.style.setProperty('--chip-color', chip.cardColor);

      const name = document.createElement('strong');
      name.textContent = textForMode(chip.name, textMode);

      const nickname = document.createElement('small');
      nickname.textContent = textForMode(chip.nickname, textMode);

      item.append(name, nickname);
      lineup.append(item);
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

    card.append(title, body, stats, lineup);
    appendJourneyBlock(card, 5, textMode);
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

function statusPanel(options: ChapterFiveOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch5-status-panel';

  panel.append(
    statBlock(textForMode(options.labels.stage, options.textMode), textForMode(options.stageNames[options.chapter.stage], options.textMode)),
    statBlock(textForMode(options.labels.sorted, options.textMode), `${options.chapter.sortedCount}/${options.chapter.testDies.length}`),
    statBlock(textForMode(options.labels.perfect, options.textMode), String(options.chapter.bins.perfect)),
    statBlock(textForMode(options.labels.good, options.textMode), String(options.chapter.bins.good)),
    statBlock(textForMode(options.labels.salvage, options.textMode), String(options.chapter.bins.salvage))
  );

  return panel;
}

function stagePanel(options: ChapterFiveOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch5-stage-panel';

  const heading = document.createElement('h2');
  heading.textContent = textForMode(options.stageNames[options.chapter.stage], options.textMode);

  const message = document.createElement('p');
  message.textContent = options.message ? textForMode(options.message, options.textMode) : '';

  panel.append(heading, message, detailBlock(options));
  return panel;
}

function detailBlock(options: ChapterFiveOverlayOptions): HTMLElement {
  const block = document.createElement('div');
  block.className = 'ch5-detail-block';

  if (options.chapter.stage === 'dice') {
    block.append(
      statChip(textForMode(options.labels.activeDie, options.textMode), `${options.chapter.testDies.length}`),
      statChip(textForMode(options.labels.score, options.textMode), `${options.chapter.sortedCount}`)
    );
    return block;
  }

  if (options.chapter.stage === 'sort' && options.activeDie) {
    block.append(
      statChip(textForMode(options.labels.activeDie, options.textMode), options.activeDie.node),
      statChip(textForMode(options.labels.score, options.textMode), `${Math.round(options.activeDie.testScore)}`),
      statChip(textForMode(options.labels.node, options.textMode), `${Math.round(options.activeDie.sourceYieldPercent)}%`)
    );
    return block;
  }

  if (options.chapter.stage === 'roster' && options.selectedChip) {
    const chipName = document.createElement('strong');
    chipName.className = 'ch5-chip-name';
    chipName.style.setProperty('--chip-color', options.selectedChip.cardColor);
    chipName.textContent = textForMode(options.selectedChip.name, options.textMode);

    const nickname = document.createElement('p');
    nickname.className = 'ch5-chip-nickname';
    nickname.textContent = textForMode(options.selectedChip.nickname, options.textMode);

    const hint = document.createElement('p');
    hint.className = 'ch5-chip-hint';
    hint.textContent = textForMode(options.selectedChip.ch6Hint, options.textMode);

    const costs = document.createElement('div');
    costs.className = 'ch5-cost-grid';
    costs.append(
      statChip(textForMode(options.labels.perfect, options.textMode), String(options.selectedChip.cost.perfect)),
      statChip(textForMode(options.labels.good, options.textMode), String(options.selectedChip.cost.good)),
      statChip(textForMode(options.labels.salvage, options.textMode), String(options.selectedChip.cost.salvage))
    );

    block.append(chipName, nickname, hint, costs);
    return block;
  }

  const summary = document.createElement('p');
  summary.className = 'ch5-stage-summary';
  summary.textContent = options.chapter.stage === 'complete'
    ? textForMode(options.labels.nextChapter, options.textMode)
    : textForMode(options.labels.buildChip, options.textMode);
  block.append(summary);
  return block;
}

function actionPanel(options: ChapterFiveOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch5-action-panel';

  if (options.chapter.stage === 'dice') {
    panel.append(
      button(textForMode(options.labels.cutWafer, options.textMode), 'primary-action', options.onCutWafer, !options.canCutWafer),
      button(textForMode(options.labels.startSort, options.textMode), 'secondary-action', options.onStartSort, !options.canStartSort),
      button(textForMode(options.labels.toggleMode, options.textMode), 'toggle-action', options.onToggleMode, false),
      button(textForMode(options.labels.menu, options.textMode), 'secondary-action', options.onMenu, false)
    );
    return panel;
  }

  if (options.chapter.stage === 'sort') {
    panel.append(
      button(textForMode(options.labels.sortPerfect, options.textMode), 'secondary-action', () => options.onSortDie('perfect'), !options.canSortPerfect),
      button(textForMode(options.labels.sortGood, options.textMode), 'secondary-action', () => options.onSortDie('good'), !options.canSortGood),
      button(textForMode(options.labels.sortSalvage, options.textMode), 'secondary-action', () => options.onSortDie('salvage'), !options.canSortSalvage),
      button(textForMode(options.labels.toggleMode, options.textMode), 'toggle-action', options.onToggleMode, false),
      button(textForMode(options.labels.menu, options.textMode), 'secondary-action', options.onMenu, false)
    );
    return panel;
  }

  if (options.chapter.stage === 'roster') {
    panel.append(
      button(textForMode(options.labels.buildChip, options.textMode), 'primary-action', options.onBuildSelectedChip, !options.canBuildSelected),
      button(textForMode(options.labels.nextChapter, options.textMode), 'secondary-action', options.onAdvanceToQuiz, !options.canAdvanceToQuiz),
      button(textForMode(options.labels.toggleMode, options.textMode), 'toggle-action', options.onToggleMode, false),
      button(textForMode(options.labels.menu, options.textMode), 'secondary-action', options.onMenu, false)
    );
    return panel;
  }

  panel.append(
    button(textForMode(options.labels.toggleMode, options.textMode), 'toggle-action', options.onToggleMode, false),
    button(textForMode(options.labels.menu, options.textMode), 'secondary-action', options.onMenu, false)
  );
  return panel;
}

function rosterPanel(options: ChapterFiveOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch5-roster-panel';

  const heading = document.createElement('h2');
  heading.textContent = textForMode(options.stageNames.roster, options.textMode);

  const bins = document.createElement('div');
  bins.className = 'ch5-bin-row';
  bins.append(
    statChip(textForMode(options.labels.perfect, options.textMode), String(options.chapter.bins.perfect)),
    statChip(textForMode(options.labels.good, options.textMode), String(options.chapter.bins.good)),
    statChip(textForMode(options.labels.salvage, options.textMode), String(options.chapter.bins.salvage))
  );

  const meter = document.createElement('span');
  meter.className = 'ch5-meter';
  const meterFill = document.createElement('span');
  const maxChoices = Math.max(1, options.balance.maxBuildChoices);
  meterFill.style.width = `${Math.round((options.chapter.selectedChipIds.length / maxChoices) * 100)}%`;
  meter.append(meterFill);

  const cards = document.createElement('div');
  cards.className = 'ch5-chip-card-grid';
  for (const chip of options.chips) {
    cards.append(chipCard(options, chip));
  }

  panel.append(heading, bins, meter, cards);
  return panel;
}

function chipCard(options: ChapterFiveOverlayOptions, chip: ChipDefinition): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'ch5-chip-card';
  card.style.setProperty('--chip-color', chip.cardColor);
  card.disabled = options.chapter.stage !== 'roster';
  card.addEventListener('click', () => options.onSelectChip(chip.id));

  const built = options.chapter.selectedChipIds.includes(chip.id);
  const affordable = canAffordChip(options.chapter, chip, options.balance.maxBuildChoices);
  const selected = options.selectedChip?.id === chip.id;
  if (built) {
    card.classList.add('is-built');
  }
  if (chip.locked) {
    card.classList.add('is-locked');
  }
  if (affordable) {
    card.classList.add('is-affordable');
  }
  if (selected) {
    card.classList.add('is-selected');
  }

  const face = document.createElement('span');
  face.className = 'ch5-chip-face';
  face.textContent = chip.locked ? '?' : textForMode(chip.name, options.textMode).slice(0, 3).toUpperCase();

  const text = document.createElement('span');
  text.className = 'ch5-chip-card-text';

  const name = document.createElement('strong');
  name.textContent = textForMode(chip.name, options.textMode);

  const nickname = document.createElement('small');
  nickname.textContent = textForMode(chip.nickname, options.textMode);

  const cost = document.createElement('span');
  cost.className = 'ch5-chip-card-cost';
  cost.textContent = `${chip.cost.perfect}/${chip.cost.good}/${chip.cost.salvage}`;

  text.append(name, nickname, cost);
  card.append(face, text);
  return card;
}

function statBlock(labelText: string, valueText: string): HTMLElement {
  const block = document.createElement('span');
  block.className = 'ch5-stat-block';

  const label = document.createElement('small');
  label.textContent = labelText;

  const value = document.createElement('strong');
  value.textContent = valueText;

  block.append(label, value);
  return block;
}

function statChip(labelText: string, valueText: string): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'ch5-stat-chip';

  const label = document.createElement('small');
  label.textContent = labelText;

  const value = document.createElement('strong');
  value.textContent = valueText;

  chip.append(label, value);
  return chip;
}

function button(label: string, className: string, onClick: () => void, disabled: boolean): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.disabled = disabled;
  element.addEventListener('click', onClick);
  return element;
}

function canAffordChip(chapter: PackageChapterState, chip: ChipDefinition, maxBuildChoices: number): boolean {
  if (chapter.stage !== 'roster'
    || chip.locked
    || chapter.selectedChipIds.includes(chip.id)
    || chapter.selectedChipIds.length >= maxBuildChoices) {
    return false;
  }

  if (chip.requiresPerfect7nm && chapter.perfect7nmDies < 1) {
    return false;
  }

  return chapter.bins.perfect >= chip.cost.perfect
    && chapter.bins.good >= chip.cost.good
    && chapter.bins.salvage >= chip.cost.salvage;
}

function chapterOneLabelBridge(labels: ChapterFiveLabels): ChapterOneLabels {
  return {
    targetBasket: labels.stage,
    minerSlots: labels.sorted,
    selectedDeposit: labels.activeDie,
    noDeposit: labels.stats,
    placeMiner: labels.cutWafer,
    removeMiner: labels.startSort,
    depleted: labels.perfect,
    producing: labels.good,
    depth: labels.node,
    remaining: labels.score,
    cost: labels.buildChip,
    quizTitle: labels.quizTitle,
    correct: labels.sortPerfect,
    tryAgain: labels.sortGood,
    chapterComplete: labels.nextChapter,
    nextChapter: labels.nextChapter,
    stats: labels.stats,
    menu: labels.menu,
    toggleMode: labels.toggleMode
  };
}
