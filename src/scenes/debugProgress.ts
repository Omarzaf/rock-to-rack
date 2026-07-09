import balanceJson from '../content/balance.json';
import { calculatePaceStatus, type ChapterId, type PaceTargetSeconds } from '../sim/pace';
import { gameStore } from '../state/gameStore';

interface PaceBalance {
  pace: {
    catchUp: {
      behindThreshold: number;
      passiveMultiplier: number;
    };
  };
}

const BALANCE = balanceJson as unknown as PaceBalance;

export function emitDebugProgress(
  chapter: ChapterId,
  elapsedSeconds: number,
  progressRatio: number,
  targetSeconds: PaceTargetSeconds
): void {
  gameStore.events.emit('debug:chapter-progress', {
    chapter,
    elapsedSeconds,
    progressRatio,
    targetSeconds
  });
}

export function debugCatchUpMultiplier(
  chapter: ChapterId,
  elapsedSeconds: number,
  progressRatio: number,
  targetSeconds: PaceTargetSeconds
): number {
  return calculatePaceStatus({
    chapter,
    elapsedSeconds,
    progressRatio,
    targetSeconds
  }, {
    behindThreshold: BALANCE.pace.catchUp.behindThreshold,
    catchUpMultiplier: BALANCE.pace.catchUp.passiveMultiplier
  }).catchUpMultiplier;
}
