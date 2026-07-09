import type { TextMode } from '../state/types';
import type { EventCardDefinition } from '../sim/events';
import type { TextModeText } from './text';
import { textForMode } from './text';

export interface EventCardLabels {
  paused: TextModeText;
}

export interface EventCardOptions {
  event: EventCardDefinition;
  textMode: TextMode;
  labels: EventCardLabels;
  onChoice: (choiceId: string) => void;
}

export interface MountedEventCard {
  updateMode: (textMode: TextMode) => void;
  cleanup: () => void;
}

export function mountEventCard(root: HTMLElement, options: EventCardOptions): MountedEventCard {
  let textMode = options.textMode;

  const backdrop = document.createElement('section');
  backdrop.className = 'event-card-backdrop';
  root.append(backdrop);

  const render = (): void => {
    backdrop.replaceChildren();

    const card = document.createElement('article');
    card.className = 'event-card';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'event-card-eyebrow';
    eyebrow.textContent = textForMode(options.labels.paused, textMode);

    const title = document.createElement('h2');
    title.textContent = textForMode(options.event.title, textMode);

    const scenario = document.createElement('p');
    scenario.textContent = textForMode(options.event.scenario, textMode);

    const choices = document.createElement('div');
    choices.className = 'event-card-choices';

    for (const choice of options.event.choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'event-choice';
      button.textContent = textForMode(choice.label, textMode);
      button.addEventListener('click', () => options.onChoice(choice.id));
      choices.append(button);
    }

    card.append(eyebrow, title, scenario, choices);
    backdrop.append(card);
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
