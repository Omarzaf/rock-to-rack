import { describe, expect, it } from 'vitest';
import codexJson from '../content/codex.json';
import { createInitialGameState } from '../state/gameState';
import { getCodexViewModel, type CodexEntry } from './codex';

const entries = codexJson as CodexEntry[];

describe('codex content', () => {
  it('contains exactly 24 unique entries with dual-register text and stats', () => {
    expect(entries).toHaveLength(24);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(24);

    for (const entry of entries) {
      expect(entry.title.kid.length).toBeGreaterThan(0);
      expect(entry.title.nerd.length).toBeGreaterThan(0);
      expect(entry.kidText).toHaveLength(3);
      expect(entry.kidText.every((line) => line.length > 0)).toBe(true);
      expect(entry.nerdText.length).toBeGreaterThan(40);
      expect(entry.realStat.length).toBeGreaterThan(10);
      expect(entry.lockedHint.kid.length).toBeGreaterThan(0);
    }
  });

  it('keeps first-chapter mineral entries unlocked when their facts were seen', () => {
    const state = createInitialGameState();
    state.chapters.ch1.firstMined = ['quartz'];

    const viewModel = getCodexViewModel(entries, state, 'kid');
    const quartz = viewModel.entries.find((entry) => entry.id === 'mineral-quartz');
    const cobalt = viewModel.entries.find((entry) => entry.id === 'mineral-cobalt');

    expect(quartz?.unlocked).toBe(true);
    expect(cobalt?.unlocked).toBe(false);
  });

  it('unlocks the final data-center entries when Chapter 6 is complete', () => {
    const state = createInitialGameState();
    state.progress.unlockedChapters = [1, 2, 3, 4, 5, 6];
    state.chapters.ch6.completed = true;

    const viewModel = getCodexViewModel(entries, state, 'nerd');
    const unlockedIds = viewModel.entries.filter((entry) => entry.unlocked).map((entry) => entry.id);

    expect(unlockedIds).toContain('datacenter-anatomy');
    expect(unlockedIds).toContain('global-supply-chain');
  });
});
