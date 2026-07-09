import type { TextMode } from '../state/types';
import type { FabBalance, FabChapterState, FabStage } from '../sim/fab';
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

export interface ChapterFourLabels {
  stage: TextModeText;
  wafer: TextModeText;
  node: TextModeText;
  yield: TextModeText;
  chips: TextModeText;
  coat: TextModeText;
  expose: TextModeText;
  etch: TextModeText;
  dope: TextModeText;
  flash: TextModeText;
  nextStation: TextModeText;
  nextWafer: TextModeText;
  quizTitle: TextModeText;
  nextChapter: TextModeText;
  stats: TextModeText;
  menu: TextModeText;
  toggleMode: TextModeText;
}

export interface ChapterFourOverlayOptions {
  chapter: FabChapterState;
  balance: FabBalance;
  labels: ChapterFourLabels;
  stageNames: Record<FabStage, TextModeText>;
  textMode: TextMode;
  message: TextModeText | null;
  currentYield: number;
  activeScore: number;
  canFlash: boolean;
  canAdvanceStation: boolean;
  canNextWafer: boolean;
  onFlash: () => void;
  onAdvanceStation: () => void;
  onNextWafer: () => void;
  onToggleMode: () => void;
  onMenu: () => void;
}

export interface MountedChapterFourOverlay {
  update: (options: ChapterFourOverlayOptions) => void;
  cleanup: () => void;
}

export function mountChapterFourOverlay(root: HTMLElement, options: ChapterFourOverlayOptions): MountedChapterFourOverlay {
  const shell = document.createElement('section');
  shell.className = 'ch4-overlay';
  root.append(shell);

  const render = (nextOptions: ChapterFourOverlayOptions): void => {
    shell.replaceChildren(
      statusPanel(nextOptions),
      stationPanel(nextOptions),
      actionPanel(nextOptions)
    );
  };

  render(options);

  return {
    update: render,
    cleanup: () => shell.remove()
  };
}

export function mountChapterFourQuiz(root: HTMLElement, options: {
  quiz: QuizDefinition;
  labels: ChapterFourLabels;
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

export function mountChapterFourComplete(root: HTMLElement, options: {
  title: TextModeText;
  body: TextModeText;
  labels: ChapterFourLabels;
  textMode: TextMode;
  elapsedSeconds: number;
  chipsProduced: number;
  averageYield: number;
  bestYield: number;
  onNext: () => void;
}): MountedModal {
  let textMode = options.textMode;

  const backdrop = document.createElement('section');
  backdrop.className = 'ch1-modal-backdrop';
  root.append(backdrop);

  const render = (): void => {
    const card = document.createElement('article');
    card.className = 'ch1-complete-card';

    const title = document.createElement('h2');
    title.textContent = textForMode(options.title, textMode);

    const body = document.createElement('p');
    body.textContent = textForMode(options.body, textMode);

    const stats = document.createElement('p');
    stats.className = 'ch1-complete-stats';
    stats.textContent = `${textForMode(options.labels.stats, textMode)}: ${Math.round(options.elapsedSeconds)}s, ${options.chipsProduced} chips, ${options.averageYield}% avg, ${options.bestYield}% best`;

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

    card.append(title, body, stats);
    appendJourneyBlock(card, 4, textMode);
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

function statusPanel(options: ChapterFourOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch4-status-panel';

  const displayIndex = options.chapter.stage === 'review'
    ? Math.max(0, options.chapter.currentWaferIndex - 1)
    : Math.min(options.chapter.currentWaferIndex, options.balance.wafersRequired - 1);
  const node = options.balance.nodes[Math.min(displayIndex, options.balance.nodes.length - 1)];
  const waferNumber = options.chapter.stage === 'complete'
    ? options.balance.wafersRequired
    : displayIndex + 1;
  const waferText = `${waferNumber}/${options.balance.wafersRequired}`;
  const chipsText = `${options.chapter.chipsProduced}`;

  panel.append(
    statBlock(textForMode(options.labels.stage, options.textMode), textForMode(options.stageNames[options.chapter.stage], options.textMode)),
    statBlock(textForMode(options.labels.wafer, options.textMode), waferText),
    statBlock(textForMode(options.labels.node, options.textMode), node.label),
    statBlock(textForMode(options.labels.yield, options.textMode), `${options.currentYield}%`),
    statBlock(textForMode(options.labels.chips, options.textMode), chipsText),
    scoreBar(options.currentYield)
  );
  return panel;
}

function stationPanel(options: ChapterFourOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch4-station-panel';

  const heading = document.createElement('h2');
  heading.textContent = textForMode(options.stageNames[options.chapter.stage], options.textMode);

  const score = document.createElement('strong');
  score.textContent = `${Math.round(options.activeScore)}`;

  const message = document.createElement('p');
  message.textContent = options.message ? textForMode(options.message, options.textMode) : '';

  const key = document.createElement('div');
  key.className = 'ch4-die-map-key';
  key.innerHTML = '<span class="good"></span> good <span class="bad"></span> defect';

  panel.append(heading, score, message);
  if (options.chapter.stage === 'review' || options.chapter.stage === 'complete') {
    panel.append(key);
  }
  return panel;
}

function actionPanel(options: ChapterFourOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch4-action-panel';

  const flash = button(textForMode(options.labels.flash, options.textMode), 'primary-action', options.onFlash);
  flash.disabled = !options.canFlash;

  const nextStation = button(textForMode(options.labels.nextStation, options.textMode), 'secondary-action', options.onAdvanceStation);
  nextStation.disabled = !options.canAdvanceStation;

  const nextWafer = button(textForMode(options.labels.nextWafer, options.textMode), 'secondary-action', options.onNextWafer);
  nextWafer.disabled = !options.canNextWafer;

  const toggle = button(textForMode(options.labels.toggleMode, options.textMode), 'toggle-action', options.onToggleMode);
  const menu = button(textForMode(options.labels.menu, options.textMode), 'secondary-action', options.onMenu);

  panel.append(flash, nextStation, nextWafer, toggle, menu);
  return panel;
}

function statBlock(labelText: string, valueText: string): HTMLElement {
  const block = document.createElement('span');
  block.className = 'ch4-stat-block';

  const label = document.createElement('small');
  label.textContent = labelText;

  const value = document.createElement('strong');
  value.textContent = valueText;

  block.append(label, value);
  return block;
}

function scoreBar(score: number): HTMLElement {
  const bar = document.createElement('span');
  bar.className = 'ch4-score-bar';

  const fill = document.createElement('span');
  fill.style.width = `${Math.round(Math.max(0, Math.min(100, score)))}%`;
  bar.append(fill);
  return bar;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

function chapterOneLabelBridge(labels: ChapterFourLabels): ChapterOneLabels {
  return {
    targetBasket: labels.chips,
    minerSlots: labels.stage,
    selectedDeposit: labels.yield,
    noDeposit: labels.yield,
    placeMiner: labels.nextStation,
    removeMiner: labels.nextWafer,
    depleted: labels.chips,
    producing: labels.node,
    depth: labels.wafer,
    remaining: labels.chips,
    cost: labels.yield,
    quizTitle: labels.quizTitle,
    correct: labels.quizTitle,
    tryAgain: labels.quizTitle,
    chapterComplete: labels.yield,
    nextChapter: labels.nextChapter,
    stats: labels.stats,
    menu: labels.menu,
    toggleMode: labels.toggleMode
  };
}
