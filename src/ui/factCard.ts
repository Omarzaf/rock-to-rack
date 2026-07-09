import { playUiCue } from '../audio/soundDesign';
import type { TextMode } from '../state/types';
import type { TextModeText } from './text';
import { textForMode } from './text';
import { activateModalFocus, type ModalFocusController } from './modalFocus';

export interface FactCardDefinition {
  id: string;
  title: TextModeText;
  imageGlyph: string;
  imageAlt: TextModeText;
  summary: TextModeText;
  deeper: TextModeText;
}

export interface FactCardLabels {
  goDeeper: TextModeText;
  dismiss: TextModeText;
}

export interface FactCardOptions {
  card: FactCardDefinition;
  textMode: TextMode;
  labels: FactCardLabels;
  onDismiss: () => void;
  onOpen: (cardId: string) => void;
}

export interface MountedFactCard {
  updateMode: (textMode: TextMode) => void;
  cleanup: () => void;
}

let factCardId = 0;

export function mountFactCard(root: HTMLElement, options: FactCardOptions): MountedFactCard {
  let textMode = options.textMode;
  let opened = false;
  let closed = false;
  let focusController: ModalFocusController | undefined;
  const titleId = `fact-card-title-${++factCardId}`;
  const summaryId = `fact-card-summary-${factCardId}`;

  const shell = document.createElement('aside');
  shell.className = 'fact-card';
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-modal', 'true');
  shell.setAttribute('aria-labelledby', titleId);
  shell.setAttribute('aria-describedby', summaryId);
  root.append(shell);

  const render = (): void => {
    if (closed) {
      return;
    }

    shell.replaceChildren();

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'fact-card-close';
    close.textContent = textForMode(options.labels.dismiss, textMode);
    close.addEventListener('click', dismiss);

    const image = document.createElement('div');
    image.className = 'fact-card-image';
    image.setAttribute('role', 'img');
    image.setAttribute('aria-label', textForMode(options.card.imageAlt, textMode));
    image.textContent = options.card.imageGlyph;

    const title = document.createElement('h2');
    title.id = titleId;
    title.textContent = textForMode(options.card.title, textMode);

    const summary = document.createElement('p');
    summary.id = summaryId;
    summary.textContent = textForMode(options.card.summary, textMode);

    const deeper = document.createElement('details');
    deeper.className = 'fact-card-deeper';

    const deeperLabel = document.createElement('summary');
    deeperLabel.textContent = textForMode(options.labels.goDeeper, textMode);

    const deeperText = document.createElement('p');
    deeperText.textContent = textForMode(options.card.deeper, textMode);

    deeper.append(deeperLabel, deeperText);
    shell.append(close, image, title, summary, deeper);

    if (!opened) {
      opened = true;
      playUiCue('fact');
      options.onOpen(options.card.id);
    }

    focusController?.focusInitial();
  };

  const dismiss = (): void => {
    if (closed) {
      return;
    }

    closed = true;
    focusController?.deactivate();
    options.onDismiss();
    shell.remove();
  };

  render();
  focusController = activateModalFocus(shell, dismiss);

  return {
    updateMode: (nextTextMode) => {
      textMode = nextTextMode;
      render();
    },
    cleanup: () => {
      if (closed) {
        return;
      }

      closed = true;
      focusController?.deactivate();
      shell.remove();
    }
  };
}
