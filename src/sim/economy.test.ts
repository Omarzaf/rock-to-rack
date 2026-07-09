import { describe, expect, it } from 'vitest';
import type { ResourceState } from '../state/types';
import { addResources, convertResources, spendResources, type ResourceCaps } from './economy';

const caps: ResourceCaps = {
  minerals: {
    quartz: 10,
    copper: 8,
    lithium: 6,
    cobalt: 4,
    rareEarths: 2
  },
  wafers: 5,
  chips: 12,
  energy: 100,
  water: 90,
  credits: 500
};

const baseResources: ResourceState = {
  minerals: {
    quartz: 4,
    copper: 2,
    lithium: 1,
    cobalt: 0,
    rareEarths: 0
  },
  wafers: 1,
  chips: 0,
  energy: 70,
  water: 50,
  credits: 120
};

describe('economy resources', () => {
  it('adds resources without mutating input and clamps to balance caps', () => {
    const result = addResources(baseResources, {
      minerals: {
        quartz: 9,
        rareEarths: 5
      },
      energy: 50,
      credits: 30
    }, caps);

    expect(result).not.toBe(baseResources);
    expect(result.minerals.quartz).toBe(10);
    expect(result.minerals.rareEarths).toBe(2);
    expect(result.energy).toBe(100);
    expect(result.credits).toBe(150);
    expect(baseResources.minerals.quartz).toBe(4);
  });

  it('does not clamp unrelated over-cap resources when applying a partial delta', () => {
    const overCapResources: ResourceState = {
      ...baseResources,
      credits: 650
    };

    const result = addResources(overCapResources, {
      chips: 2
    }, caps);

    expect(result.chips).toBe(2);
    expect(result.credits).toBe(650);
  });

  it('spends resources atomically when the player can afford the cost', () => {
    const result = spendResources(baseResources, {
      minerals: {
        quartz: 3
      },
      energy: 20,
      credits: 75
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resources.minerals.quartz).toBe(1);
      expect(result.resources.energy).toBe(50);
      expect(result.resources.credits).toBe(45);
    }
    expect(baseResources.credits).toBe(120);
  });

  it('does not change resources when a spend cannot be afforded', () => {
    const result = spendResources(baseResources, {
      minerals: {
        cobalt: 1
      },
      water: 80
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.resources).toBe(baseResources);
      expect(result.missing.minerals?.cobalt).toBe(1);
      expect(result.missing.water).toBe(30);
    }
  });

  it('converts inputs to outputs through the same atomic spend and capped add rules', () => {
    const result = convertResources(baseResources, {
      inputs: {
        minerals: {
          quartz: 2,
          copper: 1
        },
        energy: 10
      },
      outputs: {
        wafers: 10,
        chips: 2
      }
    }, caps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resources.minerals.quartz).toBe(2);
      expect(result.resources.minerals.copper).toBe(1);
      expect(result.resources.energy).toBe(60);
      expect(result.resources.wafers).toBe(5);
      expect(result.resources.chips).toBe(2);
    }
  });
});
