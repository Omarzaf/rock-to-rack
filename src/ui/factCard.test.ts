import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountFactCard } from './factCard';

beforeEach(() => {
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mountFactCard', () => {
  it('renders deeper text in the active text mode', () => {
    const root = document.createElement('div');

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

    expect(root.textContent).toContain('Kid deeper');
    expect(root.textContent).not.toContain('Nerd deeper');
  });
});

class FakeDocument {
  createElement(tagName: string): HTMLElement {
    return new FakeElement(tagName) as unknown as HTMLElement;
  }
}

class FakeElement {
  className = '';
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

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  private removeChild(child: FakeElement): void {
    this.children = this.children.filter((candidate) => candidate !== child);
    child.parent = undefined;
  }
}
