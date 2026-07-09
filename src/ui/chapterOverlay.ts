import type { TextMode } from '../state/types';

interface ChapterOverlayOptions {
  chapter: number;
  title: string;
  textMode: TextMode;
  hasNext: boolean;
  onMenu: () => void;
  onNext: () => void;
}

export function mountChapterOverlay(root: HTMLElement, options: ChapterOverlayOptions): () => void {
  root.replaceChildren();

  const shell = document.createElement('section');
  shell.className = 'chapter-shell';

  const panel = document.createElement('div');
  panel.className = 'chapter-panel';

  const heading = document.createElement('h1');
  heading.textContent = `Chapter ${options.chapter}: ${options.title}`;

  const body = document.createElement('p');
  body.textContent = options.textMode === 'kid'
    ? 'This chapter is connected to the game map, save state, and chapter flow.'
    : 'This fallback chapter screen keeps navigation and persistent game state available while the playable scene loads.';

  const actions = document.createElement('div');
  actions.className = 'chapter-actions';

  const menu = button('Menu', 'secondary-action', options.onMenu);
  actions.append(menu);

  if (options.hasNext) {
    actions.append(button('Next Chapter', 'primary-action', options.onNext));
  }

  panel.append(heading, body, actions);
  shell.append(panel);
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
