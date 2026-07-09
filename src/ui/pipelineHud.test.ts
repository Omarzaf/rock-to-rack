import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../state/gameState';
import { mountPipelineHud } from './pipelineHud';

const labels = {
  minerals: { kid: 'Minerals', nerd: 'Minerals' },
  mineralNames: {
    quartz: { kid: 'Quartz', nerd: 'Quartz' },
    copper: { kid: 'Copper', nerd: 'Copper' },
    lithium: { kid: 'Lithium', nerd: 'Lithium' },
    cobalt: { kid: 'Cobalt', nerd: 'Cobalt' },
    rareEarths: { kid: 'Rare earths', nerd: 'Rare earths' }
  },
  wafers: { kid: 'Wafers', nerd: 'Wafers' },
  chips: { kid: 'Chips', nerd: 'Chips' },
  energy: { kid: 'Energy', nerd: 'Energy' },
  water: { kid: 'Water', nerd: 'Water' },
  credits: { kid: 'Credits', nerd: 'Credits' }
};

beforeEach(() => {
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pipeline HUD', () => {
  it('renders unlocked module switch buttons and calls the switch handler', () => {
    const root = document.createElement('div');
    const state = createInitialGameState();
    const switched: number[] = [];

    mountPipelineHud(root, {
      resources: state.resources,
      textMode: 'kid',
      labels,
      stage: 2,
      moduleNav: {
        unlockedChapters: [1, 2, 3],
        activeChapter: 2,
        onSwitchChapter: (chapter) => switched.push(chapter)
      }
    });

    expect(root.textContent).toContain('Mine');
    expect(root.textContent).toContain('Refine');
    expect(root.textContent).toContain('Grow');

    const buttons = root.querySelectorAll<HTMLButtonElement>('.module-nav-button');
    expect(buttons).toHaveLength(3);
    expect(buttons[1]?.getAttribute('aria-current')).toBe('step');

    buttons[2]?.click();
    expect(switched).toEqual([3]);
  });
});

class FakeDocument {
  createElement(tagName: string): HTMLElement {
    return new FakeElement(tagName) as unknown as HTMLElement;
  }

  createElementNS(_namespace: string, tagName: string): SVGElement {
    return new FakeElement(tagName) as unknown as SVGElement;
  }
}

class FakeElement {
  className = '';
  dataset: Record<string, string> = {};
  title = '';
  type = '';
  private readonly attributes = new Map<string, string>();
  private children: FakeElement[] = [];
  private ownText = '';
  private parent: FakeElement | undefined;
  private readonly listeners = new Map<string, Array<() => void>>();

  readonly classList = {
    add: (...names: string[]) => {
      const existing = new Set(this.className.split(/\s+/).filter(Boolean));
      names.forEach((name) => existing.add(name));
      this.className = [...existing].join(' ');
    }
  };

  constructor(private readonly tagName: string) {}

  get textContent(): string {
    return `${this.ownText}${this.children.map((child) => child.textContent).join('')}`;
  }

  set textContent(value: string | null) {
    this.ownText = value ?? '';
    this.children = [];
  }

  append(...nodes: Array<FakeElement | HTMLElement | SVGElement>): void {
    for (const node of nodes) {
      const child = node as unknown as FakeElement;
      child.parent = this;
      this.children.push(child);
    }
  }

  replaceChildren(...nodes: Array<FakeElement | HTMLElement | SVGElement>): void {
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

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) {
      listener();
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  querySelectorAll<T extends HTMLElement>(selector: string): T[] {
    const matches: FakeElement[] = [];
    this.walk((element) => {
      if (element.matches(selector)) {
        matches.push(element);
      }
    });
    return matches as unknown as T[];
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
    return selector.startsWith('.')
      ? this.className.split(/\s+/).includes(selector.slice(1))
      : this.tagName === selector;
  }
}
