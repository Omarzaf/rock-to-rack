import { playUiCue } from '../audio/soundDesign';
import type { TextMode } from '../state/types';
import type { TextModeText } from './text';
import { textForMode } from './text';

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

export function mountFactCard(root: HTMLElement, options: FactCardOptions): MountedFactCard {
  let textMode = options.textMode;
  let opened = false;

  const shell = document.createElement('aside');
  shell.className = 'fact-card';
  root.append(shell);

  const render = (): void => {
    shell.replaceChildren();

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'fact-card-close';
    close.textContent = textForMode(options.labels.dismiss, textMode);
    close.addEventListener('click', () => {
      options.onDismiss();
      shell.remove();
    });

    const image = document.createElement('div');
    image.className = 'fact-card-image';
    image.setAttribute('role', 'img');
    image.setAttribute('aria-label', textForMode(options.card.imageAlt, textMode));
    image.textContent = options.card.imageGlyph;

    const title = document.createElement('h2');
    title.textContent = textForMode(options.card.title, textMode);

    const summary = document.createElement('p');
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
  };

  render();

  return {
    updateMode: (nextTextMode) => {
      textMode = nextTextMode;
      render();
    },
    cleanup: () => {
      shell.remove();
    }
  };
}
