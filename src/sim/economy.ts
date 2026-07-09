import type { MineralType, ResourceState } from '../state/types';

export type NumericResourceKey = 'wafers' | 'chips' | 'energy' | 'water' | 'credits';

export type ResourceDelta = Partial<Record<NumericResourceKey, number>> & {
  minerals?: Partial<Record<MineralType, number>>;
};

export interface ResourceCaps {
  minerals: Record<MineralType, number>;
  wafers: number;
  chips: number;
  energy: number;
  water: number;
  credits: number;
}

export interface ConversionRecipe {
  inputs: ResourceDelta;
  outputs: ResourceDelta;
}

export type SpendResult =
  | {
    ok: true;
    resources: ResourceState;
  }
  | {
    ok: false;
    resources: ResourceState;
    missing: ResourceDelta;
  };

export type ConversionResult = SpendResult;

const MINERALS: MineralType[] = ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'];
const NUMERIC_KEYS: NumericResourceKey[] = ['wafers', 'chips', 'energy', 'water', 'credits'];

export function addResources(resources: ResourceState, delta: ResourceDelta, caps: ResourceCaps): ResourceState {
  const next = cloneResources(resources);

  for (const mineral of MINERALS) {
    const amount = delta.minerals?.[mineral] ?? 0;
    if (amount === 0) {
      continue;
    }
    next.minerals[mineral] = clamp(next.minerals[mineral] + amount, 0, caps.minerals[mineral]);
  }

  for (const key of NUMERIC_KEYS) {
    const amount = delta[key] ?? 0;
    if (amount === 0) {
      continue;
    }
    next[key] = clamp(next[key] + amount, 0, caps[key]);
  }

  return next;
}

export function spendResources(resources: ResourceState, cost: ResourceDelta): SpendResult {
  const missing = missingResources(resources, cost);
  if (hasAnyDelta(missing)) {
    return {
      ok: false,
      resources,
      missing
    };
  }

  const next = cloneResources(resources);

  for (const mineral of MINERALS) {
    next.minerals[mineral] -= positiveAmount(cost.minerals?.[mineral]);
  }

  for (const key of NUMERIC_KEYS) {
    next[key] -= positiveAmount(cost[key]);
  }

  return {
    ok: true,
    resources: next
  };
}

export function convertResources(
  resources: ResourceState,
  recipe: ConversionRecipe,
  caps: ResourceCaps
): ConversionResult {
  const spent = spendResources(resources, recipe.inputs);
  if (!spent.ok) {
    return spent;
  }

  return {
    ok: true,
    resources: addResources(spent.resources, recipe.outputs, caps)
  };
}

function missingResources(resources: ResourceState, cost: ResourceDelta): ResourceDelta {
  const missing: ResourceDelta = {};

  for (const mineral of MINERALS) {
    const needed = positiveAmount(cost.minerals?.[mineral]);
    const shortage = needed - resources.minerals[mineral];
    if (shortage > 0) {
      missing.minerals = {
        ...missing.minerals,
        [mineral]: shortage
      };
    }
  }

  for (const key of NUMERIC_KEYS) {
    const needed = positiveAmount(cost[key]);
    const shortage = needed - resources[key];
    if (shortage > 0) {
      missing[key] = shortage;
    }
  }

  return missing;
}

function hasAnyDelta(delta: ResourceDelta): boolean {
  return NUMERIC_KEYS.some((key) => (delta[key] ?? 0) > 0)
    || MINERALS.some((mineral) => (delta.minerals?.[mineral] ?? 0) > 0);
}

function cloneResources(resources: ResourceState): ResourceState {
  return {
    ...resources,
    minerals: {
      ...resources.minerals
    }
  };
}

function positiveAmount(value: number | undefined): number {
  return value && value > 0 ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
