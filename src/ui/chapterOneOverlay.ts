import type { MineralType, ResourceState, TextMode } from '../state/types';
import type { MineDeposit, MiningBalance, MiningChapterState } from '../sim/mining';
import { appendJourneyBlock, type JourneyChapter } from './chapterJourney';
import type { TextModeText } from './text';
import { textForMode } from './text';

export interface ChapterOneLabels {
  targetBasket: TextModeText;
  minerSlots: TextModeText;
  selectedDeposit: TextModeText;
  noDeposit: TextModeText;
  placeMiner: TextModeText;
  removeMiner: TextModeText;
  depleted: TextModeText;
  producing: TextModeText;
  depth: TextModeText;
  remaining: TextModeText;
  cost: TextModeText;
  quizTitle: TextModeText;
  correct: TextModeText;
  tryAgain: TextModeText;
  chapterComplete: TextModeText;
  nextChapter: TextModeText;
  stats: TextModeText;
  menu: TextModeText;
  toggleMode: TextModeText;
}

export type ChapterOneMessages = Record<
  'insufficientResources' | 'slotLimit' | 'alreadyMined' | 'depositDepleted' | 'depositNotFound',
  TextModeText
>;

export interface ChapterOneOverlayOptions {
  resources: ResourceState;
  chapter: MiningChapterState;
  balance: MiningBalance;
  labels: ChapterOneLabels;
  depositNames: Record<MineralType, TextModeText>;
  selectedDeposit: MineDeposit | null;
  message: TextModeText | null;
  textMode: TextMode;
  onPlaceMiner: () => void;
  onRemoveMiner: () => void;
  onToggleMode: () => void;
  onMenu: () => void;
}

export interface MountedChapterOneOverlay {
  update: (options: ChapterOneOverlayOptions) => void;
  cleanup: () => void;
}

export interface QuizAnswerDefinition {
  id: string;
  label: TextModeText;
  correct: boolean;
  explanation: TextModeText;
}

export interface QuizDefinition {
  id: string;
  question: TextModeText;
  answers: QuizAnswerDefinition[];
}

export interface MountedModal {
  updateMode: (textMode: TextMode) => void;
  cleanup: () => void;
}

const MINERALS: MineralType[] = ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'];

export function mountChapterOneOverlay(root: HTMLElement, options: ChapterOneOverlayOptions): MountedChapterOneOverlay {
  const shell = document.createElement('section');
  shell.className = 'ch1-overlay';
  root.append(shell);

  const render = (nextOptions: ChapterOneOverlayOptions): void => {
    shell.replaceChildren(
      goalPanel(nextOptions),
      depositPanel(nextOptions),
      actionPanel(nextOptions)
    );
  };

  render(options);

  return {
    update: render,
    cleanup: () => {
      shell.remove();
    }
  };
}

export function mountQuizOverlay(root: HTMLElement, options: {
  quiz: QuizDefinition;
  labels: ChapterOneLabels;
  textMode: TextMode;
  onAnswer: (answer: QuizAnswerDefinition) => void;
}): MountedModal {
  let textMode = options.textMode;

  const backdrop = document.createElement('section');
  backdrop.className = 'ch1-modal-backdrop';
  root.append(backdrop);

  const render = (): void => {
    const card = document.createElement('article');
    card.className = 'ch1-quiz-card';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'event-card-eyebrow';
    eyebrow.textContent = textForMode(options.labels.quizTitle, textMode);

    const question = document.createElement('h2');
    question.textContent = textForMode(options.quiz.question, textMode);

    const answers = document.createElement('div');
    answers.className = 'ch1-quiz-answers';

    let answered = false;
    const chooseAnswer = (answer: QuizAnswerDefinition): void => {
      if (answered) {
        return;
      }

      answered = true;
      options.onAnswer(answer);
    };

    for (const answer of options.quiz.answers) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'event-choice';
      button.textContent = textForMode(answer.label, textMode);
      button.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        chooseAnswer(answer);
      });
      button.addEventListener('click', () => chooseAnswer(answer));
      answers.append(button);
    }

    card.append(eyebrow, question, answers);
    backdrop.replaceChildren(card);
  };

  render();

  return {
    updateMode: (nextTextMode) => {
      textMode = nextTextMode;
      render();
    },
    cleanup: () => {
      backdrop.remove();
    }
  };
}

export function mountChapterCompleteOverlay(root: HTMLElement, options: {
  title: TextModeText;
  body: TextModeText;
  labels: ChapterOneLabels;
  textMode: TextMode;
  elapsedSeconds: number;
  minedCount: number;
  journeyChapter?: JourneyChapter;
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
    stats.textContent = `${textForMode(options.labels.stats, textMode)}: ${Math.round(options.elapsedSeconds)}s, ${options.minedCount} minerals`;

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
    appendJourneyBlock(card, options.journeyChapter ?? 1, textMode);
    card.append(next);
    backdrop.replaceChildren(card);
  };

  render();

  return {
    updateMode: (nextTextMode) => {
      textMode = nextTextMode;
      render();
    },
    cleanup: () => {
      backdrop.remove();
    }
  };
}

function goalPanel(options: ChapterOneOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch1-goal-panel';

  const targetEntries = MINERALS
    .map((mineral) => ({
      mineral,
      target: options.balance.targetBasket[mineral] ?? 0,
      current: Math.floor(options.resources.minerals[mineral])
    }))
    .filter((entry) => entry.target > 0);
  const completeCount = targetEntries.filter((entry) => entry.current >= entry.target).length;

  const header = document.createElement('div');
  header.className = 'ch1-goal-header';

  const heading = document.createElement('h2');
  heading.textContent = textForMode(options.labels.targetBasket, options.textMode);

  const count = document.createElement('span');
  count.className = completeCount >= targetEntries.length ? 'ch1-goal-count is-complete' : 'ch1-goal-count';
  count.textContent = `${completeCount}/${targetEntries.length}`;

  header.append(heading, count);

  const list = document.createElement('ul');
  list.className = 'ch1-goal-list';

  for (const { mineral, target, current } of targetEntries) {
    const complete = current >= target;
    const progress = Math.min(100, Math.round((current / target) * 100));
    const item = document.createElement('li');
    item.className = complete ? 'ch1-goal-item complete' : 'ch1-goal-item';

    const label = document.createElement('span');
    label.className = 'ch1-goal-label';
    label.textContent = textForMode(options.depositNames[mineral], options.textMode);

    const value = document.createElement('span');
    value.className = 'ch1-goal-value';
    value.textContent = `${Math.min(current, target)}/${target}`;

    const bar = document.createElement('span');
    bar.className = 'ch1-goal-bar';

    const fill = document.createElement('span');
    fill.className = 'ch1-goal-fill';
    fill.style.width = `${progress}%`;
    bar.append(fill);

    item.append(label, value, bar);
    list.append(item);
  }

  panel.append(header, list);
  return panel;
}

function depositPanel(options: ChapterOneOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = options.selectedDeposit ? 'ch1-deposit-panel is-selected' : 'ch1-deposit-panel is-empty';

  if (!options.selectedDeposit) {
    const empty = document.createElement('p');
    empty.textContent = textForMode(options.labels.noDeposit, options.textMode);
    panel.append(empty);
    return panel;
  }

  const deposit = options.selectedDeposit;
  const eyebrow = document.createElement('span');
  eyebrow.className = 'ch1-card-eyebrow';
  eyebrow.textContent = textForMode(options.labels.selectedDeposit, options.textMode);

  const name = document.createElement('strong');
  name.textContent = textForMode(options.depositNames[deposit.mineral], options.textMode);

  const facts = document.createElement('div');
  facts.className = 'ch1-deposit-facts';
  facts.append(
    statChip(textForMode(options.labels.depth, options.textMode), String(deposit.depth)),
    statChip(textForMode(options.labels.remaining, options.textMode), String(Math.ceil(deposit.remaining))),
    statChip(textForMode(options.labels.cost, options.textMode), `${options.balance.minerCost.credits ?? 0}`)
  );

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary-action';
  const hasMiner = options.chapter.miners.some((miner) => miner.depositId === deposit.id);
  button.textContent = deposit.remaining <= 0
    ? textForMode(options.labels.depleted, options.textMode)
    : hasMiner
      ? textForMode(options.labels.removeMiner, options.textMode)
      : textForMode(options.labels.placeMiner, options.textMode);
  button.disabled = deposit.remaining <= 0 && !hasMiner;
  button.addEventListener('click', hasMiner ? options.onRemoveMiner : options.onPlaceMiner);

  if (options.message) {
    const message = document.createElement('p');
    message.className = 'ch1-message';
    message.textContent = textForMode(options.message, options.textMode);
    panel.append(eyebrow, name, facts, button, message);
  } else {
    panel.append(eyebrow, name, facts, button);
  }

  return panel;
}

function actionPanel(options: ChapterOneOverlayOptions): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'ch1-action-panel';

  const slots = document.createElement('div');
  slots.className = 'ch1-slot-meter';

  const slotLabel = document.createElement('span');
  slotLabel.textContent = `${textForMode(options.labels.minerSlots, options.textMode)} ${options.chapter.miners.length}/${options.balance.minerSlots}`;

  const pips = document.createElement('span');
  pips.className = 'ch1-slot-pips';
  for (let index = 0; index < options.balance.minerSlots; index += 1) {
    const pip = document.createElement('span');
    pip.className = index < options.chapter.miners.length ? 'ch1-slot-pip active' : 'ch1-slot-pip';
    pips.append(pip);
  }
  slots.append(slotLabel, pips);

  const buttons = document.createElement('div');
  buttons.className = 'ch1-action-buttons';

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

  buttons.append(toggle, menu);
  panel.append(slots, buttons);
  return panel;
}

function statChip(label: string, value: string): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'ch1-stat-chip';

  const chipLabel = document.createElement('span');
  chipLabel.textContent = label;

  const chipValue = document.createElement('strong');
  chipValue.textContent = value;

  chip.append(chipLabel, chipValue);
  return chip;
}
