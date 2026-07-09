import type { CodexEntryViewModel, CodexViewModel } from '../sim/codex';
import { activateModalFocus, type ModalFocusController } from './modalFocus';

export interface MountedCodexOverlay {
  update: (viewModel: CodexViewModel) => void;
  cleanup: () => void;
}

export function mountCodexOverlay(root: HTMLElement, viewModel: CodexViewModel, onClose: () => void): MountedCodexOverlay {
  const backdrop = document.createElement('section');
  backdrop.className = 'codex-backdrop';
  root.append(backdrop);
  let focusController: ModalFocusController | undefined;

  const render = (nextViewModel: CodexViewModel): void => {
    const panel = document.createElement('article');
    panel.className = 'codex-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'codex-title');

    const header = document.createElement('header');
    header.className = 'codex-header';

    const title = document.createElement('h2');
    title.id = 'codex-title';
    title.textContent = `Codex ${nextViewModel.unlockedCount}/${nextViewModel.totalCount}`;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'codex-close';
    close.textContent = 'Close';
    close.addEventListener('click', onClose);

    header.append(title, close);

    const list = document.createElement('div');
    list.className = 'codex-grid';

    for (const entry of nextViewModel.entries) {
      list.append(codexEntry(entry));
    }

    panel.append(header);
    if (nextViewModel.unlockedCount === 0) {
      panel.append(codexPrimer());
    }
    panel.append(list);
    focusController?.deactivate({ restoreFocus: false });
    backdrop.replaceChildren(panel);
    focusController = activateModalFocus(panel, onClose);
  };

  render(viewModel);

  return {
    update: render,
    cleanup: () => {
      focusController?.deactivate();
      backdrop.remove();
    }
  };
}

function codexPrimer(): HTMLElement {
  const primer = document.createElement('section');
  primer.className = 'codex-primer';

  const title = document.createElement('h3');
  title.textContent = 'Start building your chip library';

  const body = document.createElement('p');
  body.textContent = 'Mine your first minerals or play Learn the chain to unlock real supply-chain cards. Each card turns a game action into the concept behind it.';

  primer.append(title, body);
  return primer;
}

function codexEntry(entry: CodexEntryViewModel): HTMLElement {
  const card = document.createElement('section');
  card.className = entry.unlocked ? 'codex-entry' : 'codex-entry is-locked';

  const topLine = document.createElement('div');
  topLine.className = 'codex-entry-topline';
  topLine.append(codexIcon(entry.icon, entry.unlocked), codexTitle(entry.title));
  card.append(topLine);

  if (!entry.unlocked) {
    const hint = document.createElement('p');
    hint.className = 'codex-locked-hint';
    hint.textContent = entry.lockedHint;
    card.append(hint);
    return card;
  }

  const body = document.createElement('ul');
  body.className = 'codex-body';
  for (const line of entry.body) {
    const item = document.createElement('li');
    item.textContent = line;
    body.append(item);
  }

  const nerdText = document.createElement('p');
  nerdText.className = 'codex-nerd';
  nerdText.textContent = entry.nerdText;

  const stat = document.createElement('p');
  stat.className = 'codex-stat';
  stat.textContent = entry.realStat;

  card.append(body, nerdText, stat);
  return card;
}

function codexIcon(iconText: string, unlocked: boolean): HTMLElement {
  const icon = document.createElement('span');
  icon.className = 'codex-icon';
  icon.textContent = unlocked ? iconText : '?';
  return icon;
}

function codexTitle(titleText: string): HTMLElement {
  const title = document.createElement('h3');
  title.textContent = titleText;
  return title;
}
