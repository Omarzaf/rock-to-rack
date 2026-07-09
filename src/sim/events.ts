import type { TextModeText } from '../ui/text';
import { addResources, type ResourceCaps, type ResourceDelta } from './economy';
import type { ResourceState } from '../state/types';

export interface EventChoiceDefinition {
  id: string;
  label: TextModeText;
  effects: ResourceDelta;
  timePenaltySeconds?: number;
}

export interface EventCardDefinition {
  id: string;
  title: TextModeText;
  scenario: TextModeText;
  choices: [EventChoiceDefinition, EventChoiceDefinition];
}

export interface EventChoiceResult {
  event: EventCardDefinition;
  choice: EventChoiceDefinition;
  resources: ResourceState;
}

export function applyEventChoice(
  resources: ResourceState,
  event: EventCardDefinition,
  choiceId: string,
  caps: ResourceCaps
): EventChoiceResult {
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) {
    throw new Error(`Event choice "${choiceId}" was not found for event "${event.id}".`);
  }

  return {
    event,
    choice,
    resources: addResources(resources, choice.effects, caps)
  };
}
