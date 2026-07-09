export function isActivationKey(event: Pick<KeyboardEvent, 'key' | 'code'>): boolean {
  return event.key === 'Enter' || event.key === ' ' || event.code === 'Space';
}

export function isReplayInterruptKey(event: Pick<KeyboardEvent, 'key' | 'code'>): boolean {
  return event.key === 'Escape' || isActivationKey(event);
}

export function digitToIndex(key: string, limit: number): number | null {
  const digit = Number(key);
  if (!Number.isInteger(digit) || digit < 1 || digit > limit) {
    return null;
  }

  return digit - 1;
}

export function cycleIndex(current: number, delta: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  const wrapped = (current + delta) % length;
  return wrapped < 0 ? wrapped + length : wrapped;
}

export function clampIndex(value: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(value, 0), length - 1);
}

export function isInteractiveElementFocused(): boolean {
  const active = typeof document === 'undefined' ? null : document.activeElement;
  if (!(active instanceof HTMLElement)) {
    return false;
  }

  if (active === document.body || active === document.documentElement) {
    return false;
  }

  const tagName = active.tagName;
  return tagName === 'BUTTON'
    || tagName === 'A'
    || tagName === 'INPUT'
    || tagName === 'TEXTAREA'
    || tagName === 'SELECT'
    || active.getAttribute('role') === 'dialog';
}
