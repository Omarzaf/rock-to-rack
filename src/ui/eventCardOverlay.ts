import type { TextMode } from '../state/types';
import type { EventCardDefinition } from '../sim/events';
import type { TextModeText } from './text';
import { textForMode } from './text';
import { activateModalFocus, type ModalFocusController } from './modalFocus';

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

let eventCardId = 0;

export function mountEventCard(root: HTMLElement, options: EventCardOptions): MountedEventCard {
  let textMode = options.textMode;
  let focusController: ModalFocusController | undefined;
  const titleId = `event-card-title-${++eventCardId}`;
  const scenarioId = `event-card-scenario-${eventCardId}`;

  const backdrop = document.createElement('section');
  backdrop.className = 'event-card-backdrop';
  root.append(backdrop);

  const render = (): void => {
    backdrop.replaceChildren();

    const card = document.createElement('article');
    card.className = 'event-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', titleId);
    card.setAttribute('aria-describedby', scenarioId);

    const eyebrow = document.createElement('span');
    eyebrow.className = 'event-card-eyebrow';
    eyebrow.textContent = textForMode(options.labels.paused, textMode);

    const title = document.createElement('h2');
    title.id = titleId;
    title.textContent = textForMode(options.event.title, textMode);

    const scenario = document.createElement('p');
    scenario.id = scenarioId;
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
    focusController?.focusInitial();
  };

  render();
  focusController = activateModalFocus(backdrop.querySelector('.event-card') as HTMLElement);

  return {
    updateMode: (nextTextMode) => {
      textMode = nextTextMode;
      render();
    },
    cleanup: () => {
      focusController?.deactivate();
      backdrop.remove();
    }
  };
}
