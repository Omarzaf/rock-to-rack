import type { TextMode } from '../state/types';
import type { CrystalBalance, CrystalChapterState, CrystalStage } from '../sim/crystal';
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

export interface ChapterThreeLabels {
  stage: TextModeText;
  quality: TextModeText;
  temperature: TextModeText;
  pullProgress: TextModeText;
  wafers: TextModeText;
  retryPull: TextModeText;
  holdToPull: TextModeText;
  releaseToCool: TextModeText;
  sliceNow: TextModeText;
  quizTitle: TextModeText;
  nextChapter: TextModeText;
  stats: TextModeText;
  menu: TextModeText;
  toggleMode: TextModeText;
}

export interface ChapterThreeOverlayOptions {
  chapter: CrystalChapterState;
  balance: CrystalBalance;
  labels: ChapterThreeLabels;
  stageNames: Record<CrystalStage, TextModeText>;
  textMode: TextMode;
  message: TextModeText | null;
  pulling: boolean;
  onRetryPull: () => void;
  onToggleMode: () => void;
  onMenu: () => void;
}

export interface MountedChapterThreeOverlay {
  update: (options: ChapterThreeOverlayOptions) => void;
  cleanup: () => void;
}

export function mountChapterThreeOverlay(root: HTMLElement, options: ChapterThreeOverlayOptions): MountedChapterThreeOverlay {
  const shell = document.createElement('section');
  shell.className = 'ch3-overlay';
  root.append(shell);

  const render = (nextOptions: ChapterThreeOverlayOptions): void => {
    shell.replaceChildren(
      statusPanel(nextOptions),
      temperaturePanel(nextOptions),
      actionPanel(nextOptions)
    );
  };

  render(options);

  return {
    update: render,
    cleanup: () => shell.remove()
  };
}

export function mountChapterThreeQuiz(root: HTMLElement, options: {
  quiz: QuizDefinition;
  labels: ChapterThreeLabels;
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

export function mountChapterThreeComplete(root: HTMLElement, options: {
  title: TextModeText;
  body: TextModeText;
  labels: ChapterThreeLabels;
  textMode: TextMode;
  elapsedSeconds: number;
  wafersProduced: number;
  waferQuality: number;
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
    stats.textContent = `${textForMode(options.labels.stats, textMode)}: ${Math.round(options.elapsedSeconds)}s, ${options.wafersProduced} wafers, Q${options.waferQuality}`;

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
    appendJourneyBlock(card, 3, textMode);
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

function statusPanel(options: ChapterThreeOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch3-status-panel';

  const stage = statBlock(
    textForMode(options.labels.stage, options.textMode),
    textForMode(options.stageNames[options.chapter.stage], options.textMode)
  );
  const quality = statBlock(
    textForMode(options.labels.quality, options.textMode),
    `${Math.round(options.chapter.quality * 100)}`
  );
  const pull = statBlock(
    textForMode(options.labels.pullProgress, options.textMode),
    `${Math.round(options.chapter.ingotHeight)}%`
  );
  const waferTarget = options.chapter.ingotProfile.length > 0
    ? options.chapter.ingotProfile.filter((segment) => !segment.flawed).length
    : options.balance.slicing.guideCount;
  const wafers = statBlock(
    textForMode(options.labels.wafers, options.textMode),
    `${options.chapter.wafersProduced}/${waferTarget}`
  );

  const qualityBar = document.createElement('span');
  qualityBar.className = 'ch3-quality-bar';
  const qualityFill = document.createElement('span');
  qualityFill.style.width = `${Math.round(options.chapter.quality * 100)}%`;
  qualityBar.append(qualityFill);

  panel.append(stage, quality, pull, wafers, qualityBar);
  return panel;
}

function temperaturePanel(options: ChapterThreeOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch3-temperature-panel';

  const header = document.createElement('div');
  header.className = 'ch3-panel-header';
  const title = document.createElement('h2');
  title.textContent = textForMode(options.labels.temperature, options.textMode);
  const value = document.createElement('strong');
  value.textContent = `${Math.round(options.chapter.temperature)}`;
  header.append(title, value);

  const track = document.createElement('div');
  track.className = 'ch3-temperature-track';

  const green = document.createElement('span');
  green.className = 'ch3-temperature-green';
  green.style.left = `${options.balance.greenZone.min}%`;
  green.style.width = `${options.balance.greenZone.max - options.balance.greenZone.min}%`;

  const needle = document.createElement('span');
  needle.className = 'ch3-temperature-needle';
  needle.style.left = `${Math.round(options.chapter.temperature)}%`;

  track.append(green, needle);

  const message = document.createElement('p');
  message.className = 'ch3-message';
  message.textContent = options.message
    ? textForMode(options.message, options.textMode)
    : options.chapter.stage === 'slice'
      ? textForMode(options.labels.sliceNow, options.textMode)
      : textForMode(options.pulling ? options.labels.releaseToCool : options.labels.holdToPull, options.textMode);

  panel.append(header, track, message);
  return panel;
}

function actionPanel(options: ChapterThreeOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch3-action-panel';

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'secondary-action';
  retry.textContent = textForMode(options.labels.retryPull, options.textMode);
  retry.disabled = options.chapter.stage !== 'pull' || options.chapter.retryCount >= options.balance.retryLimit;
  retry.addEventListener('click', options.onRetryPull);

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

  panel.append(retry, toggle, menu);
  return panel;
}

function statBlock(labelText: string, valueText: string): HTMLElement {
  const block = document.createElement('span');
  block.className = 'ch3-stat-block';

  const label = document.createElement('small');
  label.textContent = labelText;

  const value = document.createElement('strong');
  value.textContent = valueText;

  block.append(label, value);
  return block;
}

function chapterOneLabelBridge(labels: ChapterThreeLabels): ChapterOneLabels {
  return {
    targetBasket: labels.wafers,
    minerSlots: labels.stage,
    selectedDeposit: labels.quality,
    noDeposit: labels.quality,
    placeMiner: labels.holdToPull,
    removeMiner: labels.releaseToCool,
    depleted: labels.wafers,
    producing: labels.temperature,
    depth: labels.pullProgress,
    remaining: labels.wafers,
    cost: labels.quality,
    quizTitle: labels.quizTitle,
    correct: labels.quizTitle,
    tryAgain: labels.quizTitle,
    chapterComplete: labels.quality,
    nextChapter: labels.nextChapter,
    stats: labels.stats,
    menu: labels.menu,
    toggleMode: labels.toggleMode
  };
}
