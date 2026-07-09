import type { GameState, TextMode } from '../state/types';
import type { TextModeText } from '../ui/text';
import { textForMode } from '../ui/text';

export type CodexUnlockKind = 'chapter_unlocked' | 'chapter_completed' | 'fact_seen' | 'game_completed';

export interface CodexUnlockRule {
  kind: CodexUnlockKind;
  chapter: 1 | 2 | 3 | 4 | 5 | 6;
  factId?: string;
}

export interface CodexEntry {
  id: string;
  chapter: 1 | 2 | 3 | 4 | 5 | 6;
  icon: string;
  title: TextModeText;
  kidText: [string, string, string];
  nerdText: string;
  realStat: string;
  unlock: CodexUnlockRule;
  lockedHint: TextModeText;
}

export interface CodexEntryViewModel {
  id: string;
  chapter: number;
  icon: string;
  title: string;
  body: string[];
  nerdText: string;
  realStat: string;
  lockedHint: string;
  unlocked: boolean;
}

export interface CodexViewModel {
  unlockedCount: number;
  totalCount: number;
  entries: CodexEntryViewModel[];
}

export function getCodexViewModel(entries: CodexEntry[], state: GameState, textMode: TextMode): CodexViewModel {
  const viewEntries = entries.map((entry) => {
    const unlocked = isCodexEntryUnlocked(entry, state);
    return {
      id: entry.id,
      chapter: entry.chapter,
      icon: entry.icon,
      title: unlocked ? textForMode(entry.title, textMode) : 'Locked entry',
      body: unlocked ? entry.kidText : [],
      nerdText: unlocked ? entry.nerdText : '',
      realStat: unlocked ? entry.realStat : '',
      lockedHint: textForMode(entry.lockedHint, textMode),
      unlocked
    };
  });

  return {
    unlockedCount: viewEntries.filter((entry) => entry.unlocked).length,
    totalCount: viewEntries.length,
    entries: viewEntries
  };
}

export function isCodexEntryUnlocked(entry: CodexEntry, state: GameState): boolean {
  if (entry.unlock.kind === 'chapter_unlocked') {
    return state.progress.unlockedChapters.includes(entry.unlock.chapter);
  }

  if (entry.unlock.kind === 'chapter_completed') {
    return chapterCompleted(state, entry.unlock.chapter);
  }

  if (entry.unlock.kind === 'game_completed') {
    return state.chapters.ch6.completed;
  }

  if (entry.unlock.kind === 'fact_seen' && entry.unlock.factId) {
    return chapterFacts(state, entry.unlock.chapter).includes(entry.unlock.factId);
  }

  return false;
}

function chapterCompleted(state: GameState, chapter: number): boolean {
  if (chapter === 1) {
    return state.chapters.ch1.completed;
  }

  if (chapter === 2) {
    return state.chapters.ch2.completed;
  }

  if (chapter === 3) {
    return state.chapters.ch3.completed;
  }

  if (chapter === 4) {
    return state.chapters.ch4.completed;
  }

  if (chapter === 5) {
    return state.chapters.ch5.completed;
  }

  return state.chapters.ch6.completed;
}

function chapterFacts(state: GameState, chapter: number): string[] {
  if (chapter === 1) {
    return state.chapters.ch1.firstMined.map((mineral) => `ch1-${mineral === 'rareEarths' ? 'rare-earths' : mineral}`);
  }

  if (chapter === 2) {
    return state.chapters.ch2.firstFacts;
  }

  if (chapter === 3) {
    return state.chapters.ch3.firstFacts;
  }

  if (chapter === 4) {
    return state.chapters.ch4.firstFacts;
  }

  if (chapter === 5) {
    return state.chapters.ch5.firstFacts;
  }

  return state.chapters.ch6.firstFacts;
}
