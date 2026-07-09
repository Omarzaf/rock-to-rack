import { describe, expect, it } from 'vitest';
import type { ResourceState } from '../state/types';
import type { ResourceCaps } from './economy';
import { applyEventChoice, type EventCardDefinition } from './events';

const caps: ResourceCaps = {
  minerals: {
    quartz: 10,
    copper: 10,
    lithium: 10,
    cobalt: 10,
    rareEarths: 10
  },
  wafers: 10,
  chips: 10,
  energy: 100,
  water: 100,
  credits: 200
};

const resources: ResourceState = {
  minerals: {
    quartz: 3,
    copper: 2,
    lithium: 0,
    cobalt: 0,
    rareEarths: 0
  },
  wafers: 0,
  chips: 0,
  energy: 80,
  water: 70,
  credits: 100
};

const event: EventCardDefinition = {
  id: 'sandbox-power-surge',
  title: {
    kid: 'Power Surge',
    nerd: 'Grid Instability'
  },
  scenario: {
    kid: 'The lights flicker in the sandbox lab.',
    nerd: 'A short grid instability event interrupts the lab schedule.'
  },
  choices: [
    {
      id: 'buy-backup',
      label: {
        kid: 'Buy backup batteries',
        nerd: 'Procure temporary backup power'
      },
      effects: {
        credits: -25,
        energy: 15
      }
    },
    {
      id: 'wait-it-out',
      label: {
        kid: 'Wait it out',
        nerd: 'Delay operations until the grid stabilizes'
      },
      effects: {
        water: -20
      }
    }
  ]
};

describe('event cards', () => {
  it('applies the selected choice effects without mutating the input resources', () => {
    const result = applyEventChoice(resources, event, 'buy-backup', caps);

    expect(result.choice.id).toBe('buy-backup');
    expect(result.resources.credits).toBe(75);
    expect(result.resources.energy).toBe(95);
    expect(resources.credits).toBe(100);
  });

  it('floors negative event effects at zero and caps positive effects', () => {
    const result = applyEventChoice(resources, {
      ...event,
      choices: [
        {
          ...event.choices[0],
          effects: {
            credits: -250,
            energy: 50
          }
        },
        event.choices[1]
      ]
    }, 'buy-backup', caps);

    expect(result.resources.credits).toBe(0);
    expect(result.resources.energy).toBe(100);
  });

  it('throws a clear error when the choice id is not part of the event', () => {
    expect(() => applyEventChoice(resources, event, 'missing-choice', caps)).toThrow(
      'Event choice "missing-choice" was not found for event "sandbox-power-surge".'
    );
  });
});
