import { describe, expect, it } from 'vitest';
import type { ChapterFiveProgress, ResourceState } from '../state/types';
import {
  applyDatacenterEvent,
  canServeContract,
  completeNovaChallenge,
  createInitialDatacenterChapter,
  getDatacenterGoalProgress,
  installChip,
  placeDatacenterBuilding,
  serveContract,
  tickDatacenter,
  type DatacenterBalance,
  type DatacenterContractDefinition
} from './datacenter';

const balance: DatacenterBalance = {
  tickSeconds: 1,
  grid: { columns: 3, rows: 3 },
  rackChipSlots: 3,
  contractsToUnlockNova: 3,
  heatWarning: 70,
  heatThrottle: 85,
  maxHeat: 100,
  startingPowerCapacity: 10,
  startingCooling: 2,
  startingNetworkLinks: 0,
  startingBatteryCharge: 5,
  buildingCosts: {
    rack: { credits: 50, chips: 1 },
    power: { credits: 40, minerals: { copper: 2 } },
    cooling: { credits: 30, water: 5 },
    network: { credits: 25, minerals: { rareEarths: 1 } },
    battery: { credits: 20, minerals: { lithium: 2 } }
  },
  buildingStats: {
    rack: { powerLoad: 8, heatRate: 10, compute: 20 },
    power: { powerCapacity: 35 },
    cooling: { cooling: 10, waterLoad: 1 },
    network: { networkLinks: 1 },
    battery: { batteryCharge: 25 }
  },
  chipEffects: {
    cpu: { computeBonus: 10, powerLoad: 4, heatRate: 3 },
    gpu: { computeMultiplier: 1.5, powerLoad: 8, heatRate: 8 },
    dram: { computeBonus: 5, rewardMultiplier: 1.25, powerLoad: 2, heatRate: 1 },
    nand: { computeBonus: 2, powerLoad: 1 },
    nic: { networkMultiplier: 1.2, powerLoad: 2, heatRate: 1 },
    pmic: { powerMultiplier: 0.8, heatRate: -1 },
    nova: { computeMultiplier: 2, aiEnabled: true, powerLoad: 12, heatRate: 6, blackoutProtection: 20 }
  },
  novaChallenge: { requiredAverageScore: 80, perfectDieCost: 1 },
  pacingTargetSeconds: { min: 360, max: 720 }
};

const ch5: ChapterFiveProgress = {
  completed: true,
  completedAtSeconds: 1020,
  quizCorrect: true,
  sortedDies: 18,
  bins: { perfect: 2, good: 4, salvage: 2 },
  selectedChipIds: ['cpu', 'gpu', 'dram', 'pmic', 'nic'],
  builtChips: [],
  perfect7nmDies: 2,
  triggeredEvents: [],
  firstFacts: []
};

const ch5WithNova: ChapterFiveProgress = {
  ...ch5,
  selectedChipIds: ['cpu', 'gpu', 'dram', 'pmic', 'nic', 'nova']
};

const resources: ResourceState = {
  minerals: { quartz: 100, copper: 100, lithium: 100, cobalt: 100, rareEarths: 100 },
  wafers: 8,
  chips: 20,
  energy: 100,
  water: 100,
  credits: 500
};

const cartoonStream: DatacenterContractDefinition = {
  id: 'cartoonStream',
  title: { kid: 'Cartoons', nerd: 'Cartoon Stream' },
  description: { kid: 'Serve shows.', nerd: 'Serve video workloads.' },
  requiredChipIds: ['cpu'],
  requiredCompute: 20,
  requiredNetworkLinks: 1,
  rewardCredits: 100,
  cityLights: 20
};

const weatherAi: DatacenterContractDefinition = {
  ...cartoonStream,
  id: 'weatherAi',
  requiredChipIds: ['gpu'],
  rewardCredits: 120,
  cityLights: 30
};

const cityBackup: DatacenterContractDefinition = {
  ...cartoonStream,
  id: 'cityBackup',
  requiredChipIds: ['dram'],
  rewardCredits: 80,
  cityLights: 40
};

const hospitalNova: DatacenterContractDefinition = {
  ...cartoonStream,
  id: 'hospitalNova',
  requiredChipIds: ['nova'],
  requiredCompute: 80,
  rewardCredits: 200,
  cityLights: 50
};

function chapterWithRack() {
  const initial = createInitialDatacenterChapter(ch5, balance);
  const rack = placeDatacenterBuilding(initial, resources, 'rack', { column: 1, row: 1 }, balance);
  const power = placeDatacenterBuilding(rack.chapter, rack.resources, 'power', { column: 2, row: 1 }, balance);
  const cooling = placeDatacenterBuilding(power.chapter, power.resources, 'cooling', { column: 3, row: 1 }, balance);
  return placeDatacenterBuilding(cooling.chapter, cooling.resources, 'network', { column: 1, row: 2 }, balance);
}

function chapterWithTwoRacks() {
  const oneRack = chapterWithRack();
  return placeDatacenterBuilding(oneRack.chapter, oneRack.resources, 'rack', { column: 2, row: 2 }, balance);
}

describe('datacenter simulation', () => {
  it('initial chapter uses Ch5 selected chips', () => {
    const chapter = createInitialDatacenterChapter(ch5, balance);

    expect(chapter.stage).toBe('build');
    expect(chapter.availableChipIds).toEqual(ch5.selectedChipIds);
    expect(chapter.perfect7nmDies).toBe(2);
    expect(chapter.powerCapacity).toBe(balance.startingPowerCapacity);
  });

  it('placing building spends resources and blocks occupied cells', () => {
    const chapter = createInitialDatacenterChapter(ch5, balance);
    const placed = placeDatacenterBuilding(chapter, resources, 'rack', { column: 1, row: 1 }, balance);
    const occupied = placeDatacenterBuilding(placed.chapter, placed.resources, 'power', { column: 1, row: 1 }, balance);

    expect(placed.ok).toBe(true);
    expect(placed.chapter.buildings[0]).toMatchObject({ id: 'rack-1', type: 'rack', column: 1, row: 1 });
    expect(placed.resources.credits).toBe(450);
    expect(placed.resources.chips).toBe(19);
    expect(occupied.ok).toBe(false);
    expect(occupied.reason).toBe('occupied');
  });

  it('rejects out-of-bounds building placement without spending resources', () => {
    const chapter = createInitialDatacenterChapter(ch5, balance);
    const result = placeDatacenterBuilding(chapter, resources, 'rack', { column: 4, row: 1 }, balance);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('out of bounds');
    expect(result.chapter).toBe(chapter);
    expect(result.resources).toBe(resources);
  });

  it('rejects building placement when resources are insufficient', () => {
    const chapter = createInitialDatacenterChapter(ch5, balance);
    const lowResources = { ...resources, credits: 0 };
    const result = placeDatacenterBuilding(chapter, lowResources, 'rack', { column: 1, row: 1 }, balance);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient resources');
    expect(result.chapter.buildings).toEqual([]);
    expect(result.resources).toBe(lowResources);
  });

  it('installing chip into rack slots only once', () => {
    const placed = chapterWithRack();
    const cpu = installChip(placed.chapter, 'rack-1', 'cpu', balance);
    const duplicate = installChip(cpu.chapter, 'rack-1', 'cpu', balance);
    const nonRack = installChip(cpu.chapter, 'power-1', 'gpu', balance);

    expect(cpu.ok).toBe(true);
    expect(cpu.chapter.buildings[0].installedChipIds).toEqual(['cpu']);
    expect(cpu.chapter.availableChipIds).not.toContain('cpu');
    expect(duplicate.reason).toBe('already installed');
    expect(nonRack.reason).toBe('not a rack');
  });

  it('rejects chip install for a missing building', () => {
    const placed = chapterWithRack();
    const result = installChip(placed.chapter, 'rack-404', 'cpu', balance);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('building not found');
    expect(result.chapter).toBe(placed.chapter);
  });

  it('rejects unavailable chip install', () => {
    const placed = chapterWithRack();
    const result = installChip(placed.chapter, 'rack-1', 'nand', balance);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('chip unavailable');
  });

  it('rejects chip install when rack is full', () => {
    const placed = chapterWithRack();
    const withCpu = installChip(placed.chapter, 'rack-1', 'cpu', balance).chapter;
    const withGpu = installChip(withCpu, 'rack-1', 'gpu', balance).chapter;
    const withDram = installChip(withGpu, 'rack-1', 'dram', balance).chapter;
    const result = installChip(withDram, 'rack-1', 'pmic', balance);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('rack full');
  });

  it('prevents installing the same chip across different racks', () => {
    const placed = chapterWithTwoRacks();
    const withCpu = installChip(placed.chapter, 'rack-1', 'cpu', balance).chapter;
    const result = installChip(withCpu, 'rack-2', 'cpu', balance);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('already installed');
  });

  it('tick computes power/cooling/network/heat/effective compute, with PMIC and NIC effects', () => {
    const placed = chapterWithRack();
    const withCpu = installChip(placed.chapter, 'rack-1', 'cpu', balance).chapter;
    const withGpu = installChip(withCpu, 'rack-1', 'gpu', balance).chapter;
    const withPmic = installChip(withGpu, 'rack-1', 'pmic', balance).chapter;
    const withNic = {
      ...withPmic,
      buildings: withPmic.buildings.map((building) => building.id === 'rack-1'
        ? { ...building, installedChipIds: [...building.installedChipIds, 'nic' as const] }
        : building),
      installedChipIds: [...withPmic.installedChipIds, 'nic' as const],
      availableChipIds: withPmic.availableChipIds.filter((chipId) => chipId !== 'nic')
    };

    const ticked = tickDatacenter(withNic, 10, balance);

    expect(ticked.powerCapacity).toBe(45);
    expect(ticked.powerLoad).toBeCloseTo(17.6);
    expect(ticked.cooling).toBe(12);
    expect(ticked.networkLinks).toBe(1);
    expect(ticked.effectiveCompute).toBeCloseTo(54);
    expect(ticked.heat).toBeCloseTo(18);
  });

  it('throttles effective compute when power is overloaded', () => {
    const chapter = createInitialDatacenterChapter(ch5, {
      ...balance,
      startingPowerCapacity: 5
    });
    const rack = placeDatacenterBuilding(chapter, resources, 'rack', { column: 1, row: 1 }, balance).chapter;
    const withCpu = installChip(rack, 'rack-1', 'cpu', balance).chapter;
    const ticked = tickDatacenter(withCpu, 1, { ...balance, startingPowerCapacity: 5 });

    expect(ticked.powerLoad).toBeGreaterThan(ticked.powerCapacity);
    expect(ticked.effectiveCompute).toBeCloseTo(19.5);
  });

  it('throttles effective compute when heat reaches the throttle threshold', () => {
    const placed = chapterWithRack();
    const withCpu = installChip(placed.chapter, 'rack-1', 'cpu', balance).chapter;
    const ticked = tickDatacenter({ ...withCpu, heat: balance.heatThrottle }, 1, balance);

    expect(ticked.effectiveCompute).toBeCloseTo(19.5);
  });

  it('canServeContract checks required chips and infrastructure', () => {
    const placed = chapterWithRack();
    const noChip = tickDatacenter(placed.chapter, 1, balance);
    const withCpu = tickDatacenter(installChip(noChip, 'rack-1', 'cpu', balance).chapter, 1, balance);

    expect(canServeContract(noChip, cartoonStream, balance)).toEqual({
      ok: false,
      reasons: ['missing chip: cpu']
    });
    expect(canServeContract(withCpu, cartoonStream, balance).ok).toBe(true);
  });

  it('serveContract rewards, city lights, and nova stage after three contracts', () => {
    const placed = chapterWithRack();
    const withCpu = installChip(placed.chapter, 'rack-1', 'cpu', balance).chapter;
    const withGpu = installChip(withCpu, 'rack-1', 'gpu', balance).chapter;
    const withDram = installChip(withGpu, 'rack-1', 'dram', balance).chapter;
    const ready = tickDatacenter(withDram, 1, balance);
    const one = serveContract(ready, placed.resources, cartoonStream, balance);
    const two = serveContract(one.chapter, one.resources, weatherAi, balance);
    const three = serveContract(two.chapter, two.resources, cityBackup, balance);

    expect(one.resources.credits).toBe(480);
    expect(three.chapter.servedContracts).toEqual(['cartoonStream', 'weatherAi', 'cityBackup']);
    expect(three.chapter.cityLights).toBe(90);
    expect(three.chapter.stage).toBe('nova');
  });

  it('can boost contract rewards without changing contract state rules', () => {
    const placed = chapterWithRack();
    const ready = tickDatacenter(installChip(placed.chapter, 'rack-1', 'cpu', balance).chapter, 1, balance);

    const normal = serveContract(ready, placed.resources, cartoonStream, balance);
    const boosted = serveContract(ready, placed.resources, cartoonStream, balance, { rewardMultiplier: 1.5 });

    expect(boosted.resources.credits - placed.resources.credits).toBe((normal.resources.credits - placed.resources.credits) * 1.5);
    expect(boosted.chapter.servedContracts).toEqual(normal.chapter.servedContracts);
  });

  it('clamps contract rewards to the credit cap when caps are provided', () => {
    const placed = chapterWithRack();
    const ready = tickDatacenter(installChip(placed.chapter, 'rack-1', 'cpu', balance).chapter, 1, balance);
    const richResources = { ...placed.resources, credits: 995 };
    const caps = {
      minerals: { quartz: 80, copper: 60, lithium: 45, cobalt: 36, rareEarths: 30 },
      wafers: 24,
      chips: 160,
      energy: 100,
      water: 100,
      credits: 1000
    };

    const served = serveContract(ready, richResources, cartoonStream, balance, { caps });

    expect(served.ok).toBe(true);
    expect(served.resources.credits).toBe(1000);
  });

  it('rejects duplicate contract service', () => {
    const placed = chapterWithRack();
    const ready = tickDatacenter(installChip(placed.chapter, 'rack-1', 'cpu', balance).chapter, 1, balance);
    const served = serveContract(ready, placed.resources, cartoonStream, balance);
    const duplicate = serveContract(served.chapter, served.resources, cartoonStream, balance);

    expect(duplicate.ok).toBe(false);
    expect(duplicate.reason).toBe('already served');
    expect(duplicate.chapter).toBe(served.chapter);
    expect(duplicate.resources).toBe(served.resources);
  });

  it('rejects hospitalNova before nova stage', () => {
    const initial = createInitialDatacenterChapter(ch5WithNova, balance);
    const rack = placeDatacenterBuilding(initial, resources, 'rack', { column: 1, row: 1 }, balance);
    const power = placeDatacenterBuilding(rack.chapter, rack.resources, 'power', { column: 2, row: 1 }, balance);
    const network = placeDatacenterBuilding(power.chapter, power.resources, 'network', { column: 3, row: 1 }, balance);
    const withCpu = installChip(network.chapter, 'rack-1', 'cpu', balance).chapter;
    const withGpu = installChip(withCpu, 'rack-1', 'gpu', balance).chapter;
    const withNova = installChip(withGpu, 'rack-1', 'nova', balance).chapter;
    const ready = tickDatacenter(withNova, 1, balance);
    const result = serveContract(ready, network.resources, hospitalNova, balance);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('nova locked');
    expect(result.chapter).toBe(ready);
  });

  it('rejects hospitalNova before Nova is built and installed', () => {
    const initial = { ...createInitialDatacenterChapter(ch5WithNova, balance), stage: 'nova' as const };
    const rack = placeDatacenterBuilding(initial, resources, 'rack', { column: 1, row: 1 }, balance);
    const power = placeDatacenterBuilding(rack.chapter, rack.resources, 'power', { column: 2, row: 1 }, balance);
    const network = placeDatacenterBuilding(power.chapter, power.resources, 'network', { column: 3, row: 1 }, balance);
    const withCpu = installChip(network.chapter, 'rack-1', 'cpu', balance).chapter;
    const withGpu = installChip(withCpu, 'rack-1', 'gpu', balance).chapter;
    const withNova = installChip(withGpu, 'rack-1', 'nova', balance).chapter;
    const ready = tickDatacenter(withNova, 1, balance);
    const result = serveContract(ready, network.resources, hospitalNova, balance);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('nova locked');
  });

  it('rejects hospitalNova when Nova is built but not installed', () => {
    const initial = { ...createInitialDatacenterChapter(ch5WithNova, balance), stage: 'nova' as const, novaBuilt: true };
    const rack = placeDatacenterBuilding(initial, resources, 'rack', { column: 1, row: 1 }, balance);
    const power = placeDatacenterBuilding(rack.chapter, rack.resources, 'power', { column: 2, row: 1 }, balance);
    const network = placeDatacenterBuilding(power.chapter, power.resources, 'network', { column: 3, row: 1 }, balance);
    const withCpu = installChip(network.chapter, 'rack-1', 'cpu', balance).chapter;
    const withGpu = installChip(withCpu, 'rack-1', 'gpu', balance).chapter;
    const ready = tickDatacenter(withGpu, 1, balance);
    const result = serveContract(ready, network.resources, hospitalNova, balance);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('requirements unmet');
  });

  it('serves hospitalNova and moves to victory', () => {
    const initial = { ...createInitialDatacenterChapter(ch5WithNova, balance), stage: 'nova' as const, novaBuilt: true };
    const rack = placeDatacenterBuilding(initial, resources, 'rack', { column: 1, row: 1 }, balance);
    const power = placeDatacenterBuilding(rack.chapter, rack.resources, 'power', { column: 2, row: 1 }, balance);
    const network = placeDatacenterBuilding(power.chapter, power.resources, 'network', { column: 3, row: 1 }, balance);
    const withCpu = installChip(network.chapter, 'rack-1', 'cpu', balance).chapter;
    const withGpu = installChip(withCpu, 'rack-1', 'gpu', balance).chapter;
    const withNova = installChip(withGpu, 'rack-1', 'nova', balance).chapter;
    const ready = tickDatacenter(withNova, 1, balance);
    const result = serveContract(ready, network.resources, hospitalNova, balance);

    expect(result.ok).toBe(true);
    expect(result.chapter.stage).toBe('victory');
    expect(result.chapter.completed).toBe(true);
    expect(result.chapter.servedContracts).toEqual(['hospitalNova']);
    expect(getDatacenterGoalProgress(result.chapter, [hospitalNova]).complete).toBe(true);
  });

  it('crisis events apply once and return same reference on duplicate', () => {
    const chapter = createInitialDatacenterChapter(ch5, balance);
    const heatwave = applyDatacenterEvent({ ...chapter, heat: 50 }, 'heatwave', 'throttle-racks', balance);
    const duplicate = applyDatacenterEvent(heatwave, 'heatwave', 'add-cooling', balance);

    expect(heatwave.heat).toBe(35);
    expect(heatwave.triggeredEvents).toEqual(['heatwave']);
    expect(duplicate).toBe(heatwave);
  });

  it('persists heatwave add-cooling bonus after tick', () => {
    const chapter = createInitialDatacenterChapter(ch5, balance);
    const cooled = applyDatacenterEvent(chapter, 'heatwave', 'add-cooling', balance);
    const ticked = tickDatacenter(cooled, 1, balance);

    expect(cooled.cooling).toBe(balance.startingCooling + balance.buildingStats.cooling.cooling);
    expect(ticked.cooling).toBe(balance.startingCooling + balance.buildingStats.cooling.cooling);
    expect(ticked.eventDeltas.cooling).toBe(balance.buildingStats.cooling.cooling);
  });

  it('persists brownout emergency power after tick', () => {
    const chapter = createInitialDatacenterChapter(ch5, balance);
    const powered = applyDatacenterEvent(chapter, 'brownout', 'buy-emergency-power', balance);
    const ticked = tickDatacenter(powered, 1, balance);

    expect(powered.powerCapacity).toBe(balance.startingPowerCapacity + 20);
    expect(ticked.powerCapacity).toBe(balance.startingPowerCapacity + 20);
    expect(ticked.eventDeltas.powerCapacity).toBe(20);
  });

  it('persists brownout battery drain after tick', () => {
    const chapter = { ...createInitialDatacenterChapter(ch5, balance), batteryCharge: 25 };
    const drained = applyDatacenterEvent(chapter, 'brownout', 'use-battery', balance);
    const ticked = tickDatacenter(drained, 1, balance);

    expect(drained.batteryCharge).toBe(5);
    expect(ticked.batteryCharge).toBe(0);
    expect(ticked.eventDeltas.batteryCharge).toBe(-20);
  });

  it('Nova challenge consumes one perfect die and adds nova', () => {
    const chapter = { ...createInitialDatacenterChapter(ch5, balance), stage: 'nova' as const };
    const result = completeNovaChallenge(chapter, { mask: 90, etch: 80, cooling: 85 }, balance);

    expect(result.ok).toBe(true);
    expect(result.chapter.novaBuilt).toBe(true);
    expect(result.chapter.perfect7nmDies).toBe(1);
    expect(result.chapter.availableChipIds).toContain('nova');
  });

  it('rejects Nova challenge before nova stage', () => {
    const chapter = createInitialDatacenterChapter(ch5, balance);
    const result = completeNovaChallenge(chapter, { mask: 90, etch: 80, cooling: 85 }, balance);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('nova locked');
    expect(result.chapter).toBe(chapter);
  });

  it('rejects Nova challenge without enough perfect dies', () => {
    const chapter = { ...createInitialDatacenterChapter(ch5, balance), stage: 'nova' as const, perfect7nmDies: 0 };
    const result = completeNovaChallenge(chapter, { mask: 90, etch: 80, cooling: 85 }, balance);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('needs perfect die');
    expect(result.chapter).toBe(chapter);
  });

  it('rejects Nova challenge when average score is too low', () => {
    const chapter = { ...createInitialDatacenterChapter(ch5, balance), stage: 'nova' as const };
    const result = completeNovaChallenge(chapter, { mask: 70, etch: 80, cooling: 80 }, balance);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('score too low');
    expect(result.chapter).toBe(chapter);
  });

  it('rejects Nova challenge when Nova is already built', () => {
    const built = completeNovaChallenge(
      { ...createInitialDatacenterChapter(ch5, balance), stage: 'nova' as const },
      { mask: 90, etch: 80, cooling: 85 },
      balance
    );
    const duplicate = completeNovaChallenge(built.chapter, { mask: 90, etch: 80, cooling: 85 }, balance);

    expect(duplicate.ok).toBe(false);
    expect(duplicate.reason).toBe('already built');
    expect(duplicate.chapter).toBe(built.chapter);
  });

  it('goal complete only after hospitalNova served', () => {
    const before = createInitialDatacenterChapter(ch5, balance);
    const victory = {
      ...before,
      stage: 'victory' as const,
      servedContracts: ['hospitalNova' as const]
    };

    expect(getDatacenterGoalProgress(before, [hospitalNova]).complete).toBe(false);
    expect(getDatacenterGoalProgress(victory, [hospitalNova])).toEqual({
      complete: true,
      servedContracts: 1,
      cityLights: 0
    });
  });
});
