import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountChapterOverlay } from './chapterOverlay';

beforeEach(() => {
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chapter overlay fallback', () => {
  it('uses player-facing copy instead of placeholder implementation language', () => {
    const root = document.createElement('div');

    mountChapterOverlay(root, {
      chapter: 2,
      title: 'Refinery',
      textMode: 'nerd',
      hasNext: true,
      onMenu: vi.fn(),
      onNext: vi.fn()
    });

    expect(root.textContent).toContain('Chapter 2: Refinery');
    expect(root.textContent).not.toMatch(/\b(stub|scaffold)\b/i);
  });
});

class FakeDocument {
  createElement(_tagName: string): HTMLElement {
    return new FakeElement() as unknown as HTMLElement;
  }
}

class FakeElement {
  className = '';
  type = '';
  private children: FakeElement[] = [];
  private ownText = '';
  private parent: FakeElement | undefined;

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

  addEventListener(): void {}

  private removeChild(child: FakeElement): void {
    this.children = this.children.filter((candidate) => candidate !== child);
    child.parent = undefined;
  }
}
