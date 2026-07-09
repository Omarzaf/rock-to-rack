import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import stringsJson from '../content/strings.json';
import { createInitialPackageChapter, type PackageBalance } from '../sim/package';
import { mountChapterFiveOverlay } from './chapterFiveOverlay';

const balance: PackageBalance = {
  tickSeconds: 0.25,
  sortSampleSize: 18,
  maxBuildChoices: 4,
  binThresholds: {
    perfect: 88,
    good: 58
  },
  testScoreByNode: {
    '90nm': { base: 72, step: 7 },
    '28nm': { base: 78, step: 6 },
    '7nm': { base: 84, step: 5 }
  },
  wrongSortDowngrade: true,
  pacingTargetSeconds: { min: 720, max: 840 }
};

const yields = [
  { node: '90nm' as const, yieldPercent: 84, goodDies: 40, defectiveDies: 8 },
  { node: '28nm' as const, yieldPercent: 77, goodDies: 37, defectiveDies: 11 },
  { node: '7nm' as const, yieldPercent: 66, goodDies: 32, defectiveDies: 16 }
];

beforeEach(() => {
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chapter five overlay', () => {
  it('shows exact sort thresholds from balance data', () => {
    const root = document.createElement('div');
    const chapter = { ...createInitialPackageChapter(balance, yields, 109), stage: 'sort' as const };

    mountChapterFiveOverlay(root, {
      chapter,
      balance,
      chips: [],
      labels: stringsJson.ch5.labels,
      stageNames: stringsJson.ch5.stageNames,
      textMode: 'nerd',
      message: null,
      activeDie: null,
      selectedChip: null,
      canCutWafer: false,
      canStartSort: false,
      canSortPerfect: false,
      canSortGood: false,
      canSortSalvage: false,
      canBuildSelected: false,
      canAdvanceToQuiz: false,
      onCutWafer: () => undefined,
      onStartSort: () => undefined,
      onSortDie: () => undefined,
      onSelectChip: () => undefined,
      onBuildSelectedChip: () => undefined,
      onAdvanceToQuiz: () => undefined,
      onToggleMode: () => undefined,
      onMenu: () => undefined
    });

    expect(root.textContent).toContain('Perfect >= 88');
    expect(root.textContent).toContain('Good >= 58');
    expect(root.textContent).toContain('Salvage below 58');
  });
});

class FakeDocument {
  createElement(tagName: string): HTMLElement {
    return new FakeElement(tagName) as unknown as HTMLElement;
  }
}

class FakeElement {
  className = '';
  disabled = false;
  type = '';
  private readonly children: FakeElement[] = [];
  private ownText = '';
  private parent: FakeElement | undefined;

  constructor(_tagName: string) {}

  get textContent(): string {
    return `${this.ownText}${this.children.map((child) => child.textContent).join('')}`;
  }

  set textContent(value: string | null) {
    this.ownText = value ?? '';
    this.children.length = 0;
  }

  append(...nodes: Array<FakeElement | HTMLElement>): void {
    for (const node of nodes) {
      const child = node as unknown as FakeElement;
      child.parent = this;
      this.children.push(child);
    }
  }

  replaceChildren(...nodes: Array<FakeElement | HTMLElement>): void {
    this.children.length = 0;
    this.ownText = '';
    this.append(...nodes);
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  addEventListener(): void {}

  private removeChild(child: FakeElement): void {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
    child.parent = undefined;
  }
}
