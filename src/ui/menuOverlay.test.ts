import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../state/gameState';
import { mountMenuOverlay } from './menuOverlay';

beforeEach(() => {
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('menu overlay', () => {
  it('explains the two play paths and preserves utility state', () => {
    const root = document.createElement('div');
    const state = createInitialGameState();

    mountMenuOverlay(root, {
      state,
      onPlayCampaign: () => undefined,
      onPlayCrisis: () => undefined,
      onTextModeToggle: () => undefined,
      onMuteToggle: () => undefined,
      onOpenCodex: () => undefined,
      onOpenSettings: () => undefined
    });

    expect(root.textContent).toContain('Crisis Run');
    expect(root.textContent).toContain('Fast 5 minute challenge');
    expect(root.textContent).toContain('Learn Mode');
    expect(root.textContent).toContain('Full guided supply chain');
    expect(root.querySelector('.menu-play')).not.toBeNull();
    expect(root.querySelector('.menu-learn')).not.toBeNull();
    expect(root.querySelectorAll('.toggle-action')[0]?.getAttribute('aria-pressed')).toBe('false');
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
  type = '';
  private readonly attributes = new Map<string, string>();
  private children: FakeElement[] = [];
  private ownText = '';
  private parent: FakeElement | undefined;
  private readonly listeners = new Map<string, Array<() => void>>();

  constructor(private readonly tagName: string) {}

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

    return this.tagName === selector;
  }
}
