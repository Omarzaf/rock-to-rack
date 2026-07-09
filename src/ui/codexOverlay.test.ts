import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountCodexOverlay } from './codexOverlay';
import type { CodexViewModel } from '../sim/codex';

beforeEach(() => {
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('codex overlay', () => {
  it('shows a first-run primer before the locked card grid', () => {
    const root = document.createElement('div');
    const viewModel: CodexViewModel = {
      unlockedCount: 0,
      totalCount: 1,
      entries: [
        {
          id: 'mineral-quartz',
          chapter: 1,
          icon: 'Si',
          title: 'Locked entry',
          body: [],
          nerdText: '',
          realStat: '',
          lockedHint: 'Mine quartz to unlock this entry.',
          unlocked: false
        }
      ]
    };

    mountCodexOverlay(root, viewModel, () => undefined);

    expect(root.textContent).toContain('Start building your chip library');
    expect(root.textContent).toContain('Mine quartz to unlock this entry.');
    expect(root.querySelector('.codex-panel')?.getAttribute('role')).toBe('dialog');
  });

  it('does not show the primer after the player has unlocked cards', () => {
    const root = document.createElement('div');
    const viewModel: CodexViewModel = {
      unlockedCount: 1,
      totalCount: 1,
      entries: [
        {
          id: 'mineral-quartz',
          chapter: 1,
          icon: 'Si',
          title: 'Quartz',
          body: ['Quartz is a common mineral that can become silicon.'],
          nerdText: 'Quartz is mostly silicon dioxide.',
          realStat: 'Silicon is abundant but chipmaking needs it purified.',
          lockedHint: '',
          unlocked: true
        }
      ]
    };

    mountCodexOverlay(root, viewModel, () => undefined);

    expect(root.textContent).not.toContain('Start building your chip library');
    expect(root.textContent).toContain('Quartz');
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
  private readonly listeners = new Map<string, Array<() => void>>();

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

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
  }

  focus(): void {}

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

    return false;
  }
}
