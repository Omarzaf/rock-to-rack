export interface ModalFocusController {
  focusInitial: () => void;
  deactivate: (options?: { restoreFocus?: boolean }) => void;
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function activateModalFocus(container: HTMLElement, onEscape?: () => void): ModalFocusController {
  const previousFocus = activeHTMLElement();

  const focusInitial = (): void => {
    queueMicrotask(() => {
      const [first] = focusableElements(container);
      first?.focus();
    });
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      onEscape();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = focusableElements(container);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = activeHTMLElement();

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', onKeyDown);
  focusInitial();

  return {
    focusInitial,
    deactivate: (options = {}) => {
      container.removeEventListener('keydown', onKeyDown);
      if (options.restoreFocus !== false) {
        previousFocus?.focus();
      }
    }
  };
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !isDisabled(element));
}

function isDisabled(element: HTMLElement): boolean {
  return 'disabled' in element && Boolean((element as HTMLButtonElement).disabled);
}

function activeHTMLElement(): HTMLElement | null {
  if (typeof HTMLElement === 'undefined') {
    return null;
  }

  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}
