export type FabStage = 'coat' | 'expose' | 'etch' | 'dope' | 'review' | 'complete';
export type FabNodeId = '90nm' | '28nm' | '7nm';
export type FabEventPenaltyType = 'dust' | 'calibration';

export interface FabNodeBalance {
  id: FabNodeId;
  label: string;
  toleranceMultiplier: number;
  chipValue: number;
}

export interface FabBalance {
  tickSeconds: number;
  wafersRequired: number;
  dieGrid: {
    columns: number;
    rows: number;
  };
  chipsPerGoodDie: number;
  baseWaferQuality: number;
  stations: {
    coat: {
      targetCoverage: number;
      evennessWeight: number;
    };
    expose: {
      perfectDistance: number;
      maxDistance: number;
    };
    etch: {
      targetSeconds: number;
      toleranceSeconds: number;
      maxPenaltySeconds: number;
    };
    dope: {
      zonesRequired: number;
    };
  };
  nodes: FabNodeBalance[];
  eventPenalties: {
    dustYieldPenalty: number;
    calibrationScorePenalty: number;
  };
  pacingTargetSeconds: {
    min: number;
    max: number;
  };
  eventTriggers?: {
    dustAtWaferIndex: number;
    calibrationAtWaferIndex: number;
  };
}

export interface FabStationScores {
  coat: number;
  expose: number;
  etch: number;
  dope: number;
}

export interface FabDie {
  id: string;
  x: number;
  y: number;
  good: boolean;
}

export interface FabNodeYield {
  node: FabNodeId;
  yieldPercent: number;
  goodDies: number;
  defectiveDies: number;
}

export interface FabChapterState {
  stage: FabStage;
  currentWaferIndex: number;
  waferQuality: number;
  stationScores: FabStationScores;
  nodeYields: FabNodeYield[];
  chipsProduced: number;
  elapsedSeconds: number;
  eventYieldPenalty: number;
  scorePenalty: number;
  triggeredEvents: string[];
  firstFacts: string[];
}

export function createInitialFabChapter(balance: FabBalance, waferQuality: number): FabChapterState {
  return {
    stage: 'coat',
    currentWaferIndex: 0,
    waferQuality: waferQuality > 0 ? waferQuality : balance.baseWaferQuality,
    stationScores: {
      coat: 0,
      expose: 0,
      etch: 0,
      dope: 0
    },
    nodeYields: [],
    chipsProduced: 0,
    elapsedSeconds: 0,
    eventYieldPenalty: 0,
    scorePenalty: 0,
    triggeredEvents: [],
    firstFacts: []
  };
}

export function scoreCoatStation(input: { coverage: number; evenness: number }, balance: FabBalance): number {
  const coverageScore = 100 - Math.abs(input.coverage - balance.stations.coat.targetCoverage) * 120;
  const evennessScore = clamp(input.evenness * 100, 0, 100);
  return Math.round(clamp(
    coverageScore * (1 - balance.stations.coat.evennessWeight) + evennessScore * balance.stations.coat.evennessWeight,
    0,
    100
  ));
}

export function scoreExposeStation(
  input: { distance: number },
  balance: FabBalance,
  node: FabNodeBalance
): number {
  const maxDistance = Math.max(1, balance.stations.expose.maxDistance * node.toleranceMultiplier);
  return Math.round(clamp(
    100 - (Math.abs(input.distance - balance.stations.expose.perfectDistance) / maxDistance) * 100,
    0,
    100
  ));
}

export function scoreEtchStation(input: { heldSeconds: number }, balance: FabBalance): number {
  const error = Math.abs(input.heldSeconds - balance.stations.etch.targetSeconds);
  if (error <= balance.stations.etch.toleranceSeconds) {
    return 100;
  }

  return Math.round(clamp(
    100 - ((error - balance.stations.etch.toleranceSeconds) / balance.stations.etch.maxPenaltySeconds) * 100,
    0,
    100
  ));
}

export function scoreDopeStation(input: { matches: number; misses: number }, balance: FabBalance): number {
  const matchScore = (input.matches / Math.max(1, balance.stations.dope.zonesRequired)) * 100;
  return Math.round(clamp(matchScore - input.misses * 18, 0, 100));
}

export function calculateWaferYield(
  waferQuality: number,
  scores: FabStationScores,
  _balance: FabBalance,
  node: FabNodeBalance,
  extraPenalty = 0
): number {
  const stationAverage = (scores.coat + scores.expose + scores.etch + scores.dope) / 4;
  const nodeDifficultyPenalty = (1 - node.toleranceMultiplier) * 18;
  return Math.round(clamp(
    (waferQuality * 0.42) + (stationAverage * 0.58) - nodeDifficultyPenalty - extraPenalty,
    0,
    100
  ));
}

export function generateDieMap(yieldPercent: number, balance: FabBalance, node: FabNodeId): FabDie[] {
  const total = balance.dieGrid.columns * balance.dieGrid.rows;
  const goodCount = Math.round(total * clamp(yieldPercent, 0, 100) / 100);

  return Array.from({ length: total }, (_, index) => ({
    id: `${node}-die-${index}`,
    x: index % balance.dieGrid.columns,
    y: Math.floor(index / balance.dieGrid.columns),
    good: index < goodCount
  }));
}

export function applyFabEventPenalty(
  chapter: FabChapterState,
  penaltyType: FabEventPenaltyType,
  balance: FabBalance
): FabChapterState {
  if (chapter.triggeredEvents.includes(penaltyType)) {
    return chapter;
  }

  if (penaltyType === 'dust') {
    return {
      ...chapter,
      eventYieldPenalty: clamp(chapter.eventYieldPenalty + balance.eventPenalties.dustYieldPenalty, 0, 100),
      triggeredEvents: [...chapter.triggeredEvents, penaltyType]
    };
  }

  return {
    ...chapter,
    scorePenalty: clamp(chapter.scorePenalty + balance.eventPenalties.calibrationScorePenalty, 0, 100),
    triggeredEvents: [...chapter.triggeredEvents, penaltyType]
  };
}

export function completeFabWafer(
  chapter: FabChapterState,
  stationScores: FabStationScores,
  balance: FabBalance,
  node: FabNodeBalance
): { chapter: FabChapterState; nodeYield: FabNodeYield; chipsProduced: number; dieMap: FabDie[] } {
  const adjustedScores = {
    coat: clamp(stationScores.coat - chapter.scorePenalty, 0, 100),
    expose: clamp(stationScores.expose - chapter.scorePenalty, 0, 100),
    etch: clamp(stationScores.etch - chapter.scorePenalty, 0, 100),
    dope: clamp(stationScores.dope - chapter.scorePenalty, 0, 100)
  };
  const yieldPercent = calculateWaferYield(
    chapter.waferQuality,
    adjustedScores,
    balance,
    node,
    chapter.eventYieldPenalty
  );
  const dieMap = generateDieMap(yieldPercent, balance, node.id);
  const goodDies = dieMap.filter((die) => die.good).length;
  const nodeYield: FabNodeYield = {
    node: node.id,
    yieldPercent,
    goodDies,
    defectiveDies: dieMap.length - goodDies
  };
  const nextIndex = chapter.currentWaferIndex + 1;
  const chipsProduced = goodDies * balance.chipsPerGoodDie;

  return {
    chapter: {
      ...chapter,
      stage: nextIndex >= balance.wafersRequired ? 'complete' : 'coat',
      currentWaferIndex: nextIndex,
      stationScores: {
        coat: 0,
        expose: 0,
        etch: 0,
        dope: 0
      },
      nodeYields: [...chapter.nodeYields, nodeYield],
      chipsProduced: chapter.chipsProduced + chipsProduced,
      eventYieldPenalty: 0,
      scorePenalty: 0
    },
    nodeYield,
    chipsProduced,
    dieMap
  };
}

export function getFabGoalProgress(
  chapter: FabChapterState,
  balance: FabBalance
): { complete: boolean; wafersProcessed: number; chipsProduced: number } {
  return {
    complete: chapter.stage === 'complete' && chapter.nodeYields.length >= balance.wafersRequired,
    wafersProcessed: chapter.nodeYields.length,
    chipsProduced: chapter.chipsProduced
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
