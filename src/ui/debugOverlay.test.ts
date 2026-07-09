import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDebugOverlay, type DebugOverlayState } from './debugOverlay';

const state: DebugOverlayState = {
  pace: {
    chapter: 3,
    elapsedSeconds: 390,
    progressRatio: 0.42,
    expectedRatio: 0.5,
    behindBy: 0.08,
    state: 'onTrack',
    catchUpMultiplier: 1,
    targetSeconds: { min: 720, max: 840 }
  },
  resources: {
    minerals: { quartz: 2, copper: 3, lithium: 4, cobalt: 5, rareEarths: 6 },
    wafers: 7,
    chips: 8,
    energy: 90,
    water: 80,
    credits: 700
  },
  rates: {
    creditsPerMinute: 12,
    energyPerMinute: -4,
    waterPerMinute: -2,
    chipsPerMinute: 1
  }
};

beforeEach(() => {
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('debug overlay', () => {
  it('renders pace, resource rates, scene jumps, and grant buttons', () => {
    const root = document.createElement('div');
    document.body.append(root);

    const mounted = mountDebugOverlay(root, {
      state,
      onSceneJump: vi.fn(),
      onGrantResources: vi.fn()
    });

    expect(root.textContent).toContain('Debug');
    expect(root.textContent).toContain('Ch3');
    expect(root.textContent).toContain('onTrack');
    expect(root.textContent).toContain('Credits/min');
    expect(root.querySelectorAll('button[data-scene-jump]')).toHaveLength(6);
    expect(root.querySelectorAll('button[data-grant]')).toHaveLength(3);

    mounted.cleanup();
    expect(root.querySelector('.debug-overlay')).toBeNull();
  });

  it('fires callbacks from controls', () => {
    const root = document.createElement('div');
    const onSceneJump = vi.fn();
    const onGrantResources = vi.fn();
    document.body.append(root);

    mountDebugOverlay(root, { state, onSceneJump, onGrantResources });

    root.querySelector<HTMLButtonElement>('button[data-scene-jump="4"]')?.click();
    root.querySelector<HTMLButtonElement>('button[data-grant="credits"]')?.click();

    expect(onSceneJump).toHaveBeenCalledWith(4);
    expect(onGrantResources).toHaveBeenCalledWith('credits');
  });
});

class FakeDocument {
  readonly body = new FakeElement('body');

  createElement(tagName: string): HTMLElement {
    return new FakeElement(tagName) as unknown as HTMLElement;
  }
}

class FakeElement {
  className = '';
  dataset: Record<string, string> = {};
  type = '';
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

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) {
      listener();
    }
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
    if (selector === '.debug-overlay') {
      return this.className.split(' ').includes('debug-overlay');
    }

    if (selector === 'button[data-scene-jump]') {
      return this.tagName === 'button' && this.dataset.sceneJump !== undefined;
    }

    if (selector === 'button[data-grant]') {
      return this.tagName === 'button' && this.dataset.grant !== undefined;
    }

    const sceneJumpValue = selector.match(/^button\[data-scene-jump="(.+)"\]$/)?.[1];
    if (sceneJumpValue !== undefined) {
      return this.tagName === 'button' && this.dataset.sceneJump === sceneJumpValue;
    }

    const grantValue = selector.match(/^button\[data-grant="(.+)"\]$/)?.[1];
    if (grantValue !== undefined) {
      return this.tagName === 'button' && this.dataset.grant === grantValue;
    }

    return false;
  }
}
