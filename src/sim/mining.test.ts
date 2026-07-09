import { describe, expect, it } from 'vitest';
import type { MineralType, ResourceState } from '../state/types';
import type { ResourceCaps } from './economy';
import {
  estimateCompletionSeconds,
  getGoalProgress,
  isGoalComplete,
  placeMiner,
  removeMiner,
  removeMinerWithRefund,
  tickMining,
  type MineDeposit,
  type MiningBalance,
  type MiningChapterState
} from './mining';

const caps: ResourceCaps = {
  minerals: {
    quartz: 100,
    copper: 100,
    lithium: 100,
    cobalt: 100,
    rareEarths: 100
  },
  wafers: 20,
  chips: 20,
  energy: 100,
  water: 100,
  credits: 1000
};

const balance: MiningBalance = {
  minerSlots: 4,
  minerCost: {
    credits: 50
  },
  extractionPerSecond: {
    quartz: 0.4,
    copper: 0.3,
    lithium: 0.25,
    cobalt: 0.2,
    rareEarths: 0.16
  },
  energyUpkeepPerDepthSecond: 0.08,
  targetBasket: {
    quartz: 20,
    copper: 15,
    lithium: 12,
    cobalt: 8,
    rareEarths: 6
  },
  pacingTargetSeconds: {
    min: 600,
    max: 720
  }
};

const resources: ResourceState = {
  minerals: {
    quartz: 0,
    copper: 0,
    lithium: 0,
    cobalt: 0,
    rareEarths: 0
  },
  wafers: 0,
  chips: 0,
  energy: 100,
  water: 100,
  credits: 250
};

describe('mining chapter simulation', () => {
  it('places a miner by spending credits and occupying a miner slot', () => {
    const result = placeMiner(createChapter(), resources, 'quartz-surface', balance);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resources.credits).toBe(200);
      expect(result.chapter.miners).toHaveLength(1);
      expect(result.chapter.miners[0]).toMatchObject({
        depositId: 'quartz-surface',
        mineral: 'quartz',
        depth: 1
      });
    }
  });

  it('does not place a miner when credits are insufficient', () => {
    const chapter = createChapter();
    const poorResources = {
      ...resources,
      credits: 10
    };

    const result = placeMiner(chapter, poorResources, 'quartz-surface', balance);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('insufficient-resources');
      expect(result.resources.credits).toBe(10);
      expect(result.chapter.miners).toHaveLength(0);
    }
    expect(chapter.miners).toHaveLength(0);
    expect(poorResources.credits).toBe(10);
  });

  it('does not place more miners than the slot limit', () => {
    const chapter = createChapter({
      miners: [
        miner('quartz-surface', 'quartz', 1),
        miner('copper-mid', 'copper', 2),
        miner('lithium-mid', 'lithium', 2),
        miner('cobalt-deep', 'cobalt', 3)
      ]
    });

    const result = placeMiner(chapter, resources, 'rare-earths-deep', balance);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('slot-limit');
      expect(result.chapter.miners).toHaveLength(4);
      expect(result.resources).toBe(resources);
    }
  });

  it('removes a miner from a deposit so the slot can be reused', () => {
    const chapter = createChapter({
      miners: [
        miner('quartz-surface', 'quartz', 1)
      ]
    });

    const result = removeMiner(chapter, 'quartz-surface');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.miner.depositId).toBe('quartz-surface');
      expect(result.chapter.miners).toEqual([]);
    }
    expect(chapter.miners).toHaveLength(1);
  });

  it('refunds the placement cost when removing a miner with refund', () => {
    const chapter = createChapter({
      miners: [
        miner('quartz-surface', 'quartz', 1)
      ]
    });
    const refundBalance = { ...balance, minerRefund: { credits: 50 } };

    const result = removeMinerWithRefund(chapter, resources, 'quartz-surface', refundBalance, caps);

    expect(result.ok).toBe(true);
    expect(result.resources.credits).toBe(300);
    expect(result.chapter.miners).toEqual([]);

    const missing = removeMinerWithRefund(chapter, resources, 'no-such-deposit', refundBalance, caps);
    expect(missing.ok).toBe(false);
    expect(missing.resources.credits).toBe(250);
  });

  it('ticks extraction, applies deeper energy upkeep, and records first mined minerals', () => {
    const chapter = createChapter({
      miners: [
        miner('quartz-surface', 'quartz', 1),
        miner('cobalt-deep', 'cobalt', 3)
      ]
    });

    const result = tickMining(chapter, resources, 10, balance, caps);

    expect(result.resources.minerals.quartz).toBe(4);
    expect(result.resources.minerals.cobalt).toBe(2);
    expect(result.resources.energy).toBeCloseTo(98.4);
    expect(result.chapter.firstMined).toEqual(['quartz', 'cobalt']);
    expect(result.extracted.minerals?.quartz).toBe(4);
    expect(result.extracted.minerals?.cobalt).toBe(2);
  });

  it('treats non-positive tick durations as a no-op', () => {
    const chapter = createChapter({
      miners: [
        miner('quartz-surface', 'quartz', 1)
      ]
    });

    const result = tickMining(chapter, resources, -5, balance, caps);

    expect(result.chapter).toEqual(chapter);
    expect(result.resources).toEqual(resources);
    expect(result.extracted.minerals).toEqual({});
    expect(result.energySpent).toBe(0);
  });

  it('depletes deposits and stops producing after remaining material reaches zero', () => {
    const chapter = createChapter({
      deposits: [
        {
          id: 'quartz-surface',
          mineral: 'quartz',
          x: 120,
          y: 360,
          depth: 1,
          richness: 1,
          remaining: 3
        }
      ],
      miners: [
        miner('quartz-surface', 'quartz', 1)
      ]
    });

    const firstTick = tickMining(chapter, resources, 10, balance, caps);
    const secondTick = tickMining(firstTick.chapter, firstTick.resources, 10, balance, caps);

    expect(firstTick.resources.minerals.quartz).toBe(3);
    expect(firstTick.chapter.deposits[0].remaining).toBe(0);
    expect(secondTick.resources.minerals.quartz).toBe(3);
    expect(secondTick.extracted.minerals?.quartz ?? 0).toBe(0);
  });

  it('reports goal progress and completion from the resource basket', () => {
    const target = balance.targetBasket;
    const partial = {
      ...resources,
      minerals: {
        quartz: 20,
        copper: 15,
        lithium: 12,
        cobalt: 5,
        rareEarths: 6
      }
    };
    const complete = {
      ...partial,
      minerals: {
        ...partial.minerals,
        cobalt: 8
      }
    };

    expect(isGoalComplete(partial, target)).toBe(false);
    expect(getGoalProgress(partial, target).items.cobalt).toEqual({
      current: 5,
      target: 8,
      complete: false
    });
    expect(isGoalComplete(complete, target)).toBe(true);
  });

  it('estimates the planned pacing inside the 10-12 minute target window', () => {
    const estimatedSeconds = estimateCompletionSeconds(balance, balance.targetBasket);

    expect(estimatedSeconds).toBeGreaterThanOrEqual(600);
    expect(estimatedSeconds).toBeLessThanOrEqual(720);
  });

  it('estimates zero seconds for an empty target basket', () => {
    expect(estimateCompletionSeconds(balance, {})).toBe(0);
  });
});

function createChapter(overrides: Partial<MiningChapterState> = {}): MiningChapterState {
  return {
    deposits: overrides.deposits ?? [
      deposit('quartz-surface', 'quartz', 1, 40),
      deposit('copper-mid', 'copper', 2, 30),
      deposit('lithium-mid', 'lithium', 2, 24),
      deposit('cobalt-deep', 'cobalt', 3, 16),
      deposit('rare-earths-deep', 'rareEarths', 3, 12)
    ],
    miners: overrides.miners ?? [],
    firstMined: overrides.firstMined ?? [],
    elapsedSeconds: overrides.elapsedSeconds ?? 0,
    triggeredEvents: overrides.triggeredEvents ?? []
  };
}

function deposit(id: string, mineral: MineralType, depth: number, remaining: number): MineDeposit {
  return {
    id,
    mineral,
    x: 100 * depth,
    y: 280 + depth * 80,
    depth,
    richness: 1,
    remaining
  };
}

function miner(depositId: string, mineral: MineralType, depth: number) {
  return {
    id: `miner-${depositId}`,
    depositId,
    mineral,
    depth
  };
}
