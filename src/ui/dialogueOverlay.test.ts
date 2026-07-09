import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountDialogue } from './dialogueOverlay';

const labels = {
  next: { kid: 'Next', nerd: 'Advance' },
  done: { kid: 'Done', nerd: 'Close dialogue' },
  skip: { kid: 'Skip', nerd: 'Skip briefing' }
};

const lines = [
  {
    id: 'one',
    speakerName: { kid: 'Sam', nerd: 'Sam' },
    portraitColor: '#f8d45c',
    text: { kid: 'First line', nerd: 'First line' }
  },
  {
    id: 'two',
    speakerName: { kid: 'Dr. Vega', nerd: 'Dr. Vega' },
    portraitColor: '#60d394',
    text: { kid: 'Second line', nerd: 'Second line' }
  }
];

beforeEach(() => {
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mountDialogue', () => {
  it('calls onComplete when skip is pressed', () => {
    const root = document.createElement('div');
    let completed = 0;

    mountDialogue(root, {
      lines,
      textMode: 'kid',
      labels,
      onComplete: () => {
        completed += 1;
      }
    });

    root.querySelector<HTMLButtonElement>('.dialogue-skip')?.click();

    expect(completed).toBe(1);
    expect(root.querySelector('.dialogue-shell')).toBeNull();
  });

  it('does not render skip when the label is absent', () => {
    const root = document.createElement('div');

    mountDialogue(root, {
      lines,
      textMode: 'kid',
      labels: {
        next: labels.next,
        done: labels.done
      },
      onComplete: () => undefined
    });

    expect(root.querySelector('.dialogue-skip')).toBeNull();
  });

  it('renders progress, back navigation, and the pixel Jensen guide portrait', () => {
    const root = document.createElement('div');

    mountDialogue(root, {
      lines: [
        {
          ...lines[0],
          speakerName: { kid: 'Jensen Huang', nerd: 'Jensen Huang, industry guide' },
          portraitKind: 'jensen-pixel',
          portraitAlt: { kid: 'Pixel portrait of Jensen Huang', nerd: 'Stylized pixel portrait of Jensen Huang' }
        },
        lines[1]
      ],
      textMode: 'kid',
      labels,
      onComplete: () => undefined
    });

    expect(root.querySelector('.dialogue-portrait-pixel-jensen')).not.toBeNull();
    expect(root.querySelector('.dialogue-portrait-image')).not.toBeNull();
    expect(root.querySelector('.dialogue-progress')?.textContent).toBe('1 / 2');
    expect(root.textContent).not.toContain('JH');

    root.querySelector<HTMLButtonElement>('.dialogue-next')?.click();
    expect(root.querySelector('.dialogue-progress')?.textContent).toBe('2 / 2');
    expect(root.textContent).toContain('Second line');

    root.querySelector<HTMLButtonElement>('.dialogue-back')?.click();
    expect(root.querySelector('.dialogue-progress')?.textContent).toBe('1 / 2');
    expect(root.textContent).toContain('First line');
  });
});

class FakeDocument {
  createElement(tagName: string): HTMLElement {
    return new FakeElement(tagName) as unknown as HTMLElement;
  }
}

class FakeElement {
  className = '';
  style = {
    setProperty: vi.fn()
  };
  type = '';
  private readonly attributes = new Map<string, string>();
  private children: FakeElement[] = [];
  private ownText = '';
  private parent: FakeElement | undefined;
  private readonly listeners = new Map<string, Array<(event: { stopPropagation: () => void }) => void>>();

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

  addEventListener(type: string, listener: (event: { stopPropagation: () => void }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) {
      listener({ stopPropagation: vi.fn() });
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
    if (selector.startsWith('.')) {
      return this.className.split(' ').includes(selector.slice(1));
    }
    return this.tagName === selector;
  }
}
