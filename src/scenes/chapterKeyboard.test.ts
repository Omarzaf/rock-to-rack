import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clampIndex,
  cycleIndex,
  digitToIndex,
  isActivationKey,
  isInteractiveElementFocused,
  isReplayInterruptKey
} from './chapterKeyboard';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chapter keyboard helpers', () => {
  it('recognizes activation and replay-interrupt keys', () => {
    expect(isActivationKey({ key: 'Enter', code: 'Enter' })).toBe(true);
    expect(isActivationKey({ key: ' ', code: 'Space' })).toBe(true);
    expect(isActivationKey({ key: 'a', code: 'KeyA' })).toBe(false);
    expect(isReplayInterruptKey({ key: 'Escape', code: 'Escape' })).toBe(true);
    expect(isReplayInterruptKey({ key: ' ', code: 'Space' })).toBe(true);
  });

  it('maps number keys and wraps indexes', () => {
    expect(digitToIndex('1', 3)).toBe(0);
    expect(digitToIndex('3', 3)).toBe(2);
    expect(digitToIndex('4', 3)).toBeNull();
    expect(cycleIndex(0, -1, 3)).toBe(2);
    expect(cycleIndex(2, 1, 3)).toBe(0);
    expect(clampIndex(99, 3)).toBe(2);
    expect(clampIndex(-1, 3)).toBe(0);
  });

  it('does not steal keyboard input from focused controls', () => {
    const button = fakeElement('BUTTON');
    vi.stubGlobal('HTMLElement', FakeElement);
    vi.stubGlobal('document', {
      activeElement: button,
      body: fakeElement('BODY'),
      documentElement: fakeElement('HTML')
    });

    expect(isInteractiveElementFocused()).toBe(true);
  });

  it('allows scene shortcuts when the document body has focus', () => {
    const body = fakeElement('BODY');
    vi.stubGlobal('HTMLElement', FakeElement);
    vi.stubGlobal('document', {
      activeElement: body,
      body,
      documentElement: fakeElement('HTML')
    });

    expect(isInteractiveElementFocused()).toBe(false);
  });
});

class FakeElement {
  constructor(readonly tagName: string) {}

  getAttribute(_name: string): string | null {
    return null;
  }
}

function fakeElement(tagName: string): FakeElement {
  return new FakeElement(tagName);
}
