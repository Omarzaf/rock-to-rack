import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrisisRunReplayComparison } from '../sim/crisisRun';
import type { CrisisRunResult } from '../state/types';
import { mountCrisisRunOverlay, mountCrisisRunResult } from './crisisRunOverlay';

beforeEach(() => {
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('crisis run overlay', () => {
  it('renders the primary objective and build buttons', () => {
    const root = document.createElement('div');
    const selected: string[] = [];

    const overlay = mountCrisisRunOverlay(root, {
      elapsedSeconds: 12,
      cityLights: 25,
      heat: 18,
      powerLoad: 20,
      powerCapacity: 80,
      selectedBuildType: 'rack',
      canComplete: false,
      challengeLabel: 'Daily seed 2026-07-09 · campaign lineup (4 chips)',
      message: 'Place one rack, power, cooling, and network.',
      onSelectBuildType: (type) => selected.push(type),
      onComplete: () => undefined,
      onMenu: () => undefined
    });

    expect(root.textContent).toContain('Crisis Run');
    expect(root.textContent).toContain('campaign lineup');
    expect(root.textContent).toContain('25%');
    expect(root.textContent).toContain('Selected: Rack');
    root.querySelector<HTMLButtonElement>('[data-build-type="power"]')?.click();
    expect(selected).toEqual(['power']);
    overlay.cleanup();
    expect(root.querySelector('.crisis-overlay')).toBeNull();
  });

  it('renders result score, copy feedback, and actions', async () => {
    const root = document.createElement('div');
    const actions: string[] = [];
    const copied: string[] = [];
    const result: CrisisRunResult = {
      runId: 'run-1',
      mode: 'crisis',
      completedAt: '2026-07-08T12:00:00.000Z',
      elapsedSeconds: 510,
      cityLights: 100,
      servedContracts: 4,
      powerEfficiency: 0.82,
      heatPeak: 55,
      mistakes: 0,
      score: 910,
      grade: 'S',
      shareLine: 'Rock to Rack Crisis Run: 910 points, grade S, 100% city lights online.'
    };
    const comparison: CrisisRunReplayComparison = {
      status: 'new-best',
      bestScore: 870,
      deltaFromPreviousBest: 40,
      targetScore: 911,
      headline: 'New best by 40 pts',
      detail: 'Previous best was 870.',
      replayPrompt: 'Replay to beat 910'
    };

    const modal = mountCrisisRunResult(root, {
      result,
      runNumber: 2,
      comparison,
      challengeLabel: 'Daily seed 2026-07-09 · campaign lineup (4 chips)',
      onCopyResult: (shareLine) => {
        copied.push(shareLine);
        return true;
      },
      onReplay: () => actions.push('replay'),
      onMenu: () => actions.push('menu')
    });

    expect(root.textContent).toContain('910');
    expect(root.textContent).toContain('New best');
    expect(root.textContent).toContain('Run 2');
    expect(root.textContent).toContain('campaign lineup');
    expect(root.textContent).toContain('New best by 40 pts');
    expect(root.textContent).toContain('Previous best was 870.');
    expect(root.textContent).toContain('Replay to beat 910');
    expect(root.querySelector('.crisis-result-stats')).not.toBeNull();
    expect(root.querySelector('.crisis-result-card')?.getAttribute('role')).toBe('dialog');
    root.querySelector<HTMLButtonElement>('.crisis-copy')?.click();
    await Promise.resolve();
    expect(copied).toEqual([result.shareLine]);
    expect(root.textContent).toContain('Copied result.');
    root.querySelector<HTMLButtonElement>('.crisis-replay')?.click();
    expect(actions).toEqual(['replay']);
    modal.cleanup();
    expect(root.querySelector('.crisis-result-backdrop')).toBeNull();
  });

  it('shows at least one second for a completed sub-second run', () => {
    const root = document.createElement('div');
    const result: CrisisRunResult = {
      runId: 'run-quick',
      mode: 'crisis',
      completedAt: '2026-07-08T12:00:00.000Z',
      elapsedSeconds: 0.4,
      cityLights: 100,
      servedContracts: 4,
      powerEfficiency: 0.82,
      heatPeak: 55,
      mistakes: 0,
      score: 910,
      grade: 'S',
      shareLine: 'Rock to Rack Crisis Run: 910 points, grade S, 100% city lights online.'
    };
    const comparison: CrisisRunReplayComparison = {
      status: 'first-run',
      bestScore: null,
      deltaFromPreviousBest: null,
      targetScore: 911,
      headline: 'First run scored 910',
      detail: 'Replay to set a higher best score.',
      replayPrompt: 'Replay to beat 910'
    };

    mountCrisisRunResult(root, {
      result,
      runNumber: 1,
      comparison,
      challengeLabel: 'Daily seed 2026-07-09 · quick play lineup',
      onReplay: () => undefined,
      onMenu: () => undefined
    });

    expect(root.textContent).toContain('1s');
  });

  it('does not label a matched score as a new best score', () => {
    const root = document.createElement('div');
    const result: CrisisRunResult = {
      runId: 'run-2',
      mode: 'crisis',
      completedAt: '2026-07-08T12:00:00.000Z',
      elapsedSeconds: 500,
      cityLights: 100,
      servedContracts: 4,
      powerEfficiency: 0.82,
      heatPeak: 55,
      mistakes: 0,
      score: 910,
      grade: 'S',
      shareLine: 'Rock to Rack Crisis Run: 910 points, grade S, 100% city lights online.'
    };
    const comparison: CrisisRunReplayComparison = {
      status: 'matched-best',
      bestScore: 910,
      deltaFromPreviousBest: 0,
      targetScore: 911,
      headline: 'Matched your best',
      detail: 'Beat 910 to set a new best.',
      replayPrompt: 'Replay to beat 910'
    };

    mountCrisisRunResult(root, {
      result,
      runNumber: 2,
      comparison,
      challengeLabel: 'Daily seed 2026-07-09 · quick play lineup',
      onReplay: () => undefined,
      onMenu: () => undefined
    });

    expect(root.textContent).toContain('Run complete');
    expect(root.textContent).not.toContain('New best');
  });
});

class FakeDocument {
  createElement(tagName: string): HTMLElement {
    return new FakeElement(tagName) as unknown as HTMLElement;
  }
}

class FakeElement {
  className = '';
  dataset: Record<string, string> = {};
  disabled = false;
  id = '';
  type = '';
  private readonly attributes = new Map<string, string>();
  private children: FakeElement[] = [];
  private ownText = '';
  private parent: FakeElement | undefined;
  private readonly listeners = new Map<string, Array<() => void | Promise<void>>>();

  constructor(_tagName: string) {}

  get textContent(): string {
    return `${this.ownText}${this.children.map((child) => child.textContent).join('')}`;
  }

  set textContent(value: string | null) {
    this.ownText = value ?? '';
    this.children = [];
  }

  append(...nodes: Array<FakeElement | HTMLElement>): void {
    for (const node of nodes) {
      const child = node as unknown as FakeElement;
      child.parent = this;
      this.children.push(child);
    }
  }

  replaceChildren(...nodes: Array<FakeElement | HTMLElement>): void {
    this.children = [];
    this.ownText = '';
    this.append(...nodes);
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  addEventListener(type: string, listener: () => void | Promise<void>): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: () => void | Promise<void>): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
  }

  focus(): void {}

  click(): void {
    if (this.disabled) {
      return;
    }
    for (const listener of this.listeners.get('click') ?? []) {
      void listener();
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  querySelector<T extends HTMLElement>(selector: string): T | null {
    return (this.querySelectorAll(selector)[0] ?? null) as T | null;
  }

  querySelectorAll(selector: string): HTMLElement[] {
    const matches: FakeElement[] = [];
    this.walk((element) => {
      if (element.matches(selector)) {
        matches.push(element);
      }
    });
    return matches as unknown as HTMLElement[];
  }

  private removeChild(child: FakeElement): void {
    this.children = this.children.filter((candidate) => candidate !== child);
    child.parent = undefined;
  }

  private walk(visitor: (element: FakeElement) => void): void {
    for (const child of this.children) {
      visitor(child);
      child.walk(visitor);
    }
  }

  private matches(selector: string): boolean {
    if (selector.startsWith('.')) {
      return this.className.split(' ').includes(selector.slice(1));
    }

    const buildType = selector.match(/^\[data-build-type="(.+)"\]$/)?.[1];
    if (buildType !== undefined) {
      return this.dataset.buildType === buildType;
    }

    const attribute = selector.match(/^\[([^=]+)="(.+)"\]$/);
    if (attribute) {
      return this.getAttribute(attribute[1]) === attribute[2];
    }

    return false;
  }
}
