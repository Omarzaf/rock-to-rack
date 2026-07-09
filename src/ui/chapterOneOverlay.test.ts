import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountChapterCompleteOverlay, mountQuizOverlay } from './chapterOneOverlay';

const labels = {
  targetBasket: { kid: 'Target basket', nerd: 'Target basket' },
  minerSlots: { kid: 'Miner slots', nerd: 'Miner slots' },
  selectedDeposit: { kid: 'Selected deposit', nerd: 'Selected deposit' },
  noDeposit: { kid: 'No deposit', nerd: 'No deposit' },
  placeMiner: { kid: 'Place miner', nerd: 'Place miner' },
  removeMiner: { kid: 'Remove miner', nerd: 'Remove miner' },
  depleted: { kid: 'Depleted', nerd: 'Depleted' },
  producing: { kid: 'Producing', nerd: 'Producing' },
  depth: { kid: 'Depth', nerd: 'Depth' },
  remaining: { kid: 'Remaining', nerd: 'Remaining' },
  cost: { kid: 'Cost', nerd: 'Cost' },
  quizTitle: { kid: 'Quick check', nerd: 'Quick check' },
  correct: { kid: 'Correct', nerd: 'Correct' },
  tryAgain: { kid: 'Try again', nerd: 'Try again' },
  chapterComplete: { kid: 'Chapter complete', nerd: 'Chapter complete' },
  nextChapter: { kid: 'Next chapter', nerd: 'Next chapter' },
  stats: { kid: 'Stats', nerd: 'Stats' },
  menu: { kid: 'Menu', nerd: 'Menu' },
  toggleMode: { kid: 'Toggle mode', nerd: 'Toggle mode' }
};

beforeEach(() => {
  vi.stubGlobal('HTMLElement', FakeElement);
  vi.stubGlobal('document', new FakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chapter one modal overlays', () => {
  it('renders the quiz overlay as a labelled dialog with tab containment', async () => {
    const root = document.createElement('div');
    const opener = document.createElement('button');
    root.append(opener);
    opener.focus();

    const mounted = mountQuizOverlay(root, {
      quiz: {
        id: 'quiz-1',
        question: { kid: 'Which mineral starts the chain?', nerd: 'Which mineral starts the chain?' },
        answers: [
          { id: 'a', label: { kid: 'Quartz', nerd: 'Quartz' }, correct: true, explanation: { kid: 'Yes', nerd: 'Yes' } },
          { id: 'b', label: { kid: 'Copper', nerd: 'Copper' }, correct: false, explanation: { kid: 'No', nerd: 'No' } }
        ]
      },
      labels,
      textMode: 'kid',
      onAnswer: () => undefined
    });

    await Promise.resolve();

    const card = root.querySelector('.ch1-quiz-card');
    expect(card?.getAttribute('role')).toBe('dialog');
    expect(card?.getAttribute('aria-modal')).toBe('true');
    expect(card?.getAttribute('aria-labelledby')).toContain('ch1-quiz-title-');
    expect(card?.getAttribute('aria-describedby')).toContain('ch1-quiz-question-');
    expect(document.activeElement).toBe(root.querySelector('.event-choice'));

    const answers = root.querySelectorAll('.event-choice');
    (answers[1] as unknown as FakeElement).focus();
    (card as unknown as FakeElement).dispatchKeydown('Tab');
    expect(document.activeElement).toBe(answers[0]);

    mounted.cleanup();
    expect(root.querySelector('.ch1-modal-backdrop')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('renders the chapter completion overlay as a labelled dialog and restores focus on cleanup', async () => {
    const root = document.createElement('div');
    const opener = document.createElement('button');
    root.append(opener);
    opener.focus();

    const mounted = mountChapterCompleteOverlay(root, {
      title: { kid: 'Mission complete', nerd: 'Mission complete' },
      body: { kid: 'You did it.', nerd: 'You did it.' },
      labels,
      textMode: 'kid',
      elapsedSeconds: 91,
      minedCount: 4,
      journeyChapter: 1,
      onNext: () => undefined
    });

    await Promise.resolve();

    const card = root.querySelector('.ch1-complete-card');
    expect(card?.getAttribute('role')).toBe('dialog');
    expect(card?.getAttribute('aria-modal')).toBe('true');
    expect(card?.getAttribute('aria-labelledby')).toContain('ch1-complete-title-');
    expect(card?.getAttribute('aria-describedby')).toContain('ch1-complete-body-');
    expect(document.activeElement).toBe(root.querySelector('.primary-action'));

    mounted.cleanup();
    expect(root.querySelector('.ch1-modal-backdrop')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

class FakeDocument {
  activeElement: FakeElement | null = null;

  createElement(tagName: string): HTMLElement {
    return new FakeElement(this, tagName) as unknown as HTMLElement;
  }

  createTextNode(text: string): FakeElement {
    const node = new FakeElement(this, '#text');
    node.textContent = text;
    return node;
  }
}

class FakeElement {
  className = '';
  disabled = false;
  id = '';
  type = '';
  style = {
    setProperty: vi.fn()
  };
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
