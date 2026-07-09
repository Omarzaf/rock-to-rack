import stringsJson from '../content/strings.json';
import type { GameState } from '../state/types';
import type { TextModeText } from './text';
import { textForMode } from './text';

interface MenuStrings {
  eyebrow: TextModeText;
  subtitle: TextModeText;
  steps: TextModeText[];
}

const MENU_STRINGS = (stringsJson as unknown as { menu: MenuStrings }).menu;

interface MenuOverlayOptions {
  state: GameState;
  onPlayCampaign: () => void;
  onPlayCrisis: () => void;
  onTextModeToggle: () => void;
  onMuteToggle: () => void;
  onOpenCodex: () => void;
  onOpenSettings: () => void;
  onOpenFeedback?: () => void;
}

export function mountMenuOverlay(root: HTMLElement, options: MenuOverlayOptions): () => void {
  root.replaceChildren();
  const textMode = options.state.preferences.textMode;

  const shell = document.createElement('section');
  shell.className = 'menu-shell';

  const titleStack = document.createElement('div');
  titleStack.className = 'title-stack';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'menu-eyebrow';
  eyebrow.textContent = textForMode(MENU_STRINGS.eyebrow, textMode);

  const title = document.createElement('h1');
  title.textContent = 'Rock to Rack';

  const subtitle = document.createElement('p');
  subtitle.textContent = textForMode(MENU_STRINGS.subtitle, textMode);

  titleStack.append(eyebrow, title, subtitle);

  const pipeline = document.createElement('ol');
  pipeline.className = 'menu-pipeline';
  for (const step of MENU_STRINGS.steps) {
    const item = document.createElement('li');
    item.className = 'menu-pipeline-step';
    const label = document.createElement('span');
    label.textContent = textForMode(step, textMode);
    item.append(label);
    pipeline.append(item);
  }

  const actions = document.createElement('div');
  actions.className = 'menu-actions';
  actions.append(
    actionButton({
      title: 'Crisis Run',
      description: 'Fast 5 minute challenge',
      className: 'primary-action menu-play',
      onClick: options.onPlayCrisis
    }),
    actionButton({
      title: 'Learn Mode',
      description: 'Full guided supply chain',
      className: 'secondary-action menu-learn',
      onClick: options.onPlayCampaign
    })
  );
  if (options.state.meta.bestCrisisRun) {
    const best = document.createElement('p');
    best.className = 'menu-best-run';
    best.textContent = `Best Crisis Run: ${options.state.meta.bestCrisisRun.score} points, grade ${options.state.meta.bestCrisisRun.grade}`;
    actions.append(best);
  }

  const utility = document.createElement('div');
  utility.className = 'menu-utility';

  const mode = button(`Mode: ${textMode === 'kid' ? 'Kid' : 'Nerd'}`, 'toggle-action', options.onTextModeToggle);
  mode.setAttribute('aria-pressed', String(textMode === 'nerd'));

  const mute = button(options.state.preferences.muted ? 'Muted' : 'Sound On', 'toggle-action', options.onMuteToggle);
  mute.setAttribute('aria-pressed', String(!options.state.preferences.muted));

  utility.append(
    mode,
    mute,
    button('Codex', 'secondary-action', options.onOpenCodex),
    button('Settings', 'secondary-action', options.onOpenSettings)
  );
  if (options.onOpenFeedback) {
    utility.append(button('Feedback', 'secondary-action', options.onOpenFeedback));
  }

  shell.append(titleStack, pipeline, actions, utility);
  root.append(shell);

  return () => {
    shell.remove();
  };
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

function actionButton(options: {
  title: string;
  description: string;
  className: string;
  onClick: () => void;
}): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `${options.className} menu-action-card`;
  element.addEventListener('click', options.onClick);

  const title = document.createElement('strong');
  title.textContent = options.title;

  const description = document.createElement('small');
  description.textContent = options.description;

  element.append(title, description);
  return element;
}
