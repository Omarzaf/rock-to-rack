import type { ResourceState } from '../state/types';
import { addResources, spendResources, type ResourceCaps } from './economy';

export type CrystalStage = 'pull' | 'slice' | 'complete';

export interface CrystalBalance {
  tickSeconds: number;
  targetPullSeconds: number;
  targetIngotHeight: number;
  greenZone: {
    min: number;
    max: number;
  };
  temperature: {
    start: number;
    min: number;
    max: number;
    pullDriftPerSecond: number;
    restDriftPerSecond: number;
    noisePerSecond: number;
  };
  resourceUsePerSecond: {
    energy: number;
    water: number;
  };
  retryLimit: number;
  vibrationPenalty: {
    stability: number;
    temperature: number;
    timePenaltySeconds: number;
  };
  slicing: {
    guideCount: number;
    tolerance: number;
    flawedThreshold: number;
    waferQualityScale: number;
  };
  pacingTargetSeconds: {
    min: number;
    max: number;
  };
  eventTriggers?: {
    vibrationAtHeight: number;
  };
}

export interface IngotProfileSegment {
  start: number;
  end: number;
  width: number;
  flawed: boolean;
}

export interface CrystalChapterState {
  stage: CrystalStage;
  temperature: number;
  ingotHeight: number;
  quality: number;
  pullSeconds: number;
  greenSeconds: number;
  qualityPenalty: number;
  stabilityPenalty: number;
  retryCount: number;
  elapsedSeconds: number;
  triggeredEvents: string[];
  firstFacts: string[];
  ingotProfile: IngotProfileSegment[];
  sliceAttempts: number[];
  wafersProduced: number;
  waferQuality: number;
}

export interface TickCrystalPullResult {
  chapter: CrystalChapterState;
  resources: ResourceState;
  blockedReason: 'insufficient-energy-water' | null;
}

export interface SliceIngotResult {
  chapter: CrystalChapterState;
  createdWafer: boolean;
  discardedFlawed: boolean;
  missedGuide: boolean;
  alreadyCut: boolean;
}

export interface SliceStageStatus {
  cutSegments: number;
  totalSegments: number;
  complete: boolean;
}

export interface CrystalGoalProgress {
  complete: boolean;
  wafersProduced: number;
  waferQuality: number;
}

export function createInitialCrystalChapter(balance: CrystalBalance): CrystalChapterState {
  return {
    stage: 'pull',
    temperature: balance.temperature.start,
    ingotHeight: 0,
    quality: 0,
    pullSeconds: 0,
    greenSeconds: 0,
    qualityPenalty: 0,
    stabilityPenalty: 0,
    retryCount: 0,
    elapsedSeconds: 0,
    triggeredEvents: [],
    firstFacts: [],
    ingotProfile: [],
    sliceAttempts: [],
    wafersProduced: 0,
    waferQuality: 0
  };
}

export function tickCrystalPull(
  chapter: CrystalChapterState,
  resources: ResourceState,
  pulling: boolean,
  seconds: number,
  balance: CrystalBalance,
  options: { growthMultiplier?: number } = {}
): TickCrystalPullResult {
  if (chapter.stage !== 'pull') {
    return { chapter, resources, blockedReason: null };
  }

  const growthMultiplier = Math.max(0, options.growthMultiplier ?? 1);
  const cost = {
    energy: balance.resourceUsePerSecond.energy * seconds,
    water: balance.resourceUsePerSecond.water * seconds
  };
  const spent = spendResources(resources, cost);
  if (!spent.ok) {
    return {
      chapter,
      resources,
      blockedReason: 'insufficient-energy-water'
    };
  }

  const pullSeconds = pulling ? chapter.pullSeconds + seconds : chapter.pullSeconds;
  const center = (balance.greenZone.min + balance.greenZone.max) / 2;
  const halfRange = Math.max(1, balance.temperature.max - center);
  const temperaturePenalty = pulling ? Math.abs(chapter.temperature - center) / halfRange : 0;
  const qualityPenalty = chapter.qualityPenalty + temperaturePenalty * seconds;
  const greenSeconds = isTemperatureGreen(chapter.temperature, balance) && pulling
    ? chapter.greenSeconds + seconds
    : chapter.greenSeconds;
  const baseQuality = pullSeconds > 0
    ? 1 - (qualityPenalty / pullSeconds) - chapter.stabilityPenalty
    : 0;
  const quality = clamp(baseQuality, 0, 1);
  const growthPerSecond = balance.targetIngotHeight / balance.targetPullSeconds;
  const inZoneMultiplier = isTemperatureGreen(chapter.temperature, balance) ? 1 : 0.65;
  const ingotHeight = pulling
    ? clamp(chapter.ingotHeight + growthPerSecond * seconds * inZoneMultiplier * growthMultiplier, 0, balance.targetIngotHeight)
    : chapter.ingotHeight;
  const drift = pulling ? balance.temperature.pullDriftPerSecond : balance.temperature.restDriftPerSecond;
  const deterministicNoise = Math.sin((chapter.elapsedSeconds + seconds) * 1.7) * balance.temperature.noisePerSecond;
  const temperature = clamp(
    chapter.temperature + drift * seconds + deterministicNoise * seconds,
    balance.temperature.min,
    balance.temperature.max
  );
  const stage = ingotHeight >= balance.targetIngotHeight ? 'slice' : 'pull';

  return {
    chapter: {
      ...chapter,
      stage,
      temperature,
      ingotHeight,
      quality,
      pullSeconds,
      greenSeconds,
      qualityPenalty,
      elapsedSeconds: chapter.elapsedSeconds + seconds,
      ingotProfile: stage === 'slice' && chapter.ingotProfile.length === 0
        ? generateIngotProfile(quality, balance)
        : chapter.ingotProfile
    },
    resources: spent.resources,
    blockedReason: null
  };
}

export function applyVibrationPenalty(chapter: CrystalChapterState, balance: CrystalBalance): CrystalChapterState {
  return {
    ...chapter,
    temperature: clamp(
      chapter.temperature + balance.vibrationPenalty.temperature,
      balance.temperature.min,
      balance.temperature.max
    ),
    stabilityPenalty: clamp(chapter.stabilityPenalty + balance.vibrationPenalty.stability, 0, 1),
    quality: clamp(chapter.quality - balance.vibrationPenalty.stability, 0, 1),
    elapsedSeconds: chapter.elapsedSeconds + balance.vibrationPenalty.timePenaltySeconds
  };
}

export function canRetryPull(chapter: CrystalChapterState, balance: CrystalBalance): boolean {
  return chapter.retryCount < balance.retryLimit && chapter.stage === 'pull';
}

export function retryPull(chapter: CrystalChapterState, balance: CrystalBalance): CrystalChapterState {
  if (!canRetryPull(chapter, balance)) {
    return chapter;
  }

  return {
    ...createInitialCrystalChapter(balance),
    retryCount: chapter.retryCount + 1,
    elapsedSeconds: chapter.elapsedSeconds
  };
}

export function generateIngotProfile(quality: number, balance: CrystalBalance): IngotProfileSegment[] {
  const guideCount = Math.max(1, balance.slicing.guideCount);
  const segmentSize = 100 / guideCount;
  const segments: IngotProfileSegment[] = [];

  for (let index = 0; index < guideCount; index += 1) {
    const wobble = Math.abs(Math.sin((index + 1) * 1.91)) * (1 - quality);
    const width = clamp(88 - wobble * 80, 24, 92);
    const flawed = width / 100 < balance.slicing.flawedThreshold;
    segments.push({
      start: index * segmentSize,
      end: (index + 1) * segmentSize,
      width,
      flawed
    });
  }

  return segments;
}

export function sliceIngot(
  chapter: CrystalChapterState,
  position: number,
  balance: CrystalBalance
): SliceIngotResult {
  if (chapter.stage !== 'slice') {
    return {
      chapter,
      createdWafer: false,
      discardedFlawed: false,
      missedGuide: true,
      alreadyCut: false
    };
  }

  const normalizedPosition = clamp(position, 0, 100);
  const segment = segmentAt(chapter.ingotProfile, normalizedPosition);
  const guidePosition = segment
    ? (segment.start + segment.end) / 2
    : nearestGuidePosition(normalizedPosition, balance);
  const missedGuide = Math.abs(normalizedPosition - guidePosition) > balance.slicing.tolerance;

  if (!missedGuide && segment && isSegmentCut(chapter, segment, balance)) {
    return {
      chapter,
      createdWafer: false,
      discardedFlawed: false,
      missedGuide: false,
      alreadyCut: true
    };
  }

  const discardedFlawed = !missedGuide && Boolean(segment?.flawed);
  const createdWafer = !missedGuide && !discardedFlawed;

  return {
    chapter: {
      ...chapter,
      sliceAttempts: [...chapter.sliceAttempts, normalizedPosition],
      wafersProduced: createdWafer ? chapter.wafersProduced + 1 : chapter.wafersProduced
    },
    createdWafer,
    discardedFlawed,
    missedGuide,
    alreadyCut: false
  };
}

export function isSegmentCut(
  chapter: CrystalChapterState,
  segment: IngotProfileSegment,
  balance: CrystalBalance
): boolean {
  const guidePosition = (segment.start + segment.end) / 2;
  return chapter.sliceAttempts.some((attempt) =>
    attempt >= segment.start
    && attempt <= segment.end
    && Math.abs(attempt - guidePosition) <= balance.slicing.tolerance);
}

export function getSliceStageStatus(chapter: CrystalChapterState, balance: CrystalBalance): SliceStageStatus {
  const totalSegments = chapter.ingotProfile.length;
  const cutSegments = chapter.ingotProfile
    .filter((segment) => isSegmentCut(chapter, segment, balance))
    .length;

  return {
    cutSegments,
    totalSegments,
    complete: totalSegments > 0 && cutSegments >= totalSegments
  };
}

export function completeSliceStage(
  chapter: CrystalChapterState,
  resources: ResourceState,
  balance: CrystalBalance,
  caps: ResourceCaps
): { chapter: CrystalChapterState; resources: ResourceState } {
  const waferQuality = Math.round(clamp(chapter.quality, 0, 1) * balance.slicing.waferQualityScale);
  const waferCount = Math.max(0, Math.floor(chapter.wafersProduced));

  return {
    chapter: {
      ...chapter,
      stage: 'complete',
      waferQuality
    },
    resources: addResources(resources, { wafers: waferCount }, caps)
  };
}

export function getCrystalGoalProgress(chapter: CrystalChapterState, _balance: CrystalBalance): CrystalGoalProgress {
  return {
    // Completion means every slice guide has been cut. Flawed segments never
    // produce wafers, so requiring `guideCount` wafers could soft-lock a
    // low-quality ingot; at worst the deterministic profile still yields
    // several clean segments, so at least one wafer is always attainable.
    complete: chapter.stage === 'complete' && chapter.wafersProduced > 0,
    wafersProduced: chapter.wafersProduced,
    waferQuality: chapter.waferQuality
  };
}

function isTemperatureGreen(temperature: number, balance: CrystalBalance): boolean {
  return temperature >= balance.greenZone.min && temperature <= balance.greenZone.max;
}

function nearestGuidePosition(position: number, balance: CrystalBalance): number {
  const segmentSize = 100 / Math.max(1, balance.slicing.guideCount);
  return (Math.floor(position / segmentSize) + 0.5) * segmentSize;
}

function segmentAt(segments: IngotProfileSegment[], position: number): IngotProfileSegment | undefined {
  return segments.find((segment) => position >= segment.start && position <= segment.end);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
