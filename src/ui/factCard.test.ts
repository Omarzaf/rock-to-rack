import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountFactCard } from './factCard';

beforeEach(() => {
  vi.stubGlobal('HTMLElement', FakeElement);
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mountFactCard', () => {
  it('renders a labelled dialog, focuses the close button, and keeps the active text mode copy', async () => {
    const root = document.createElement('div');
    const opener = document.createElement('button');
    root.append(opener);
    opener.focus();

    mountFactCard(root, {
      card: {
        id: 'fact',
        title: { kid: 'Kid title', nerd: 'Nerd title' },
        imageGlyph: 'Si',
        imageAlt: { kid: 'Kid alt', nerd: 'Nerd alt' },
        summary: { kid: 'Kid summary', nerd: 'Nerd summary' },
        deeper: { kid: 'Kid deeper', nerd: 'Nerd deeper' }
      },
      textMode: 'kid',
      labels: {
        goDeeper: { kid: 'Go deeper', nerd: 'Technical note' },
        dismiss: { kid: 'Dismiss', nerd: 'Close' }
      },
      onDismiss: () => undefined,
      onOpen: () => undefined
    });

    await Promise.resolve();

    const card = root.querySelector('.fact-card');
    expect(card?.getAttribute('role')).toBe('dialog');
    expect(card?.getAttribute('aria-modal')).toBe('true');
    expect(card?.getAttribute('aria-labelledby')).toContain('fact-card-title-');
    expect(card?.getAttribute('aria-describedby')).toContain('fact-card-summary-');
    expect(document.activeElement).toBe(root.querySelector('.fact-card-close'));
    expect(root.textContent).toContain('Kid deeper');
    expect(root.textContent).not.toContain('Nerd deeper');
  });

  it('dismisses on Escape and restores focus to the opener', async () => {
    const root = document.createElement('div');
    const opener = document.createElement('button');
    root.append(opener);
    opener.focus();
    let dismissed = 0;

    mountFactCard(root, {
      card: {
        id: 'fact',
        title: { kid: 'Kid title', nerd: 'Nerd title' },
        imageGlyph: 'Si',
        imageAlt: { kid: 'Kid alt', nerd: 'Nerd alt' },
        summary: { kid: 'Kid summary', nerd: 'Nerd summary' },
        deeper: { kid: 'Kid deeper', nerd: 'Nerd deeper' }
      },
      textMode: 'kid',
      labels: {
        goDeeper: { kid: 'Go deeper', nerd: 'Technical note' },
        dismiss: { kid: 'Dismiss', nerd: 'Close' }
      },
      onDismiss: () => {
        dismissed += 1;
      },
      onOpen: () => undefined
    });

    await Promise.resolve();

    (root.querySelector('.fact-card') as unknown as FakeElement).dispatchKeydown('Escape');

    expect(dismissed).toBe(1);
    expect(root.querySelector('.fact-card')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

class FakeDocument {
  activeElement: FakeElement | null = null;

  createElement(tagName: string): HTMLElement {
    return new FakeElement(this, tagName) as unknown as HTMLElement;
  }
}

class FakeElement {
  className = '';
  disabled = false;
  id = '';
  type = '';
  private readonly attributes = new Map<string, string>();
  private children: FakeElement[] = [];
  private ownText = '';
  private parent: FakeElement | undefined;
  private readonly listeners = new Map<string, Array<(event: any) => void>>();

  constructor(private readonly ownerDocument: FakeDocument, private readonly tagName: string) {}

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

  addEventListener(type: string, listener: (event: any) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: (event: any) => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
  }

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  getAttributeNames(): string[] {
    return [...this.attributes.keys()];
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) {
      listener({ stopPropagation: vi.fn() });
    }
  }

  dispatchKeydown(key: string, shiftKey = false): void {
    const event = {
      key,
      shiftKey,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    for (const listener of this.listeners.get('keydown') ?? []) {
      listener(event);
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
    if (selector.includes(',')) {
      return selector.split(',').some((part) => this.matches(part.trim()));
    }
    if (selector === '[href]') {
      return this.attributes.has('href');
    }
    if (selector.startsWith('[tabindex]')) {
      return this.attributes.has('tabindex') && this.attributes.get('tabindex') !== '-1';
    }
    if (selector.startsWith('.')) {
      return this.className.split(' ').includes(selector.slice(1));
    }

    return this.tagName === selector;
  }
}
