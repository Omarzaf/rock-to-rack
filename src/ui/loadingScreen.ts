export interface LoadingScreenShell {
  root: Pick<HTMLElement, 'hidden'> & { classList: Pick<DOMTokenList, 'add'> };
  fact: Pick<HTMLElement, 'textContent'>;
}

export interface LoadingScreenController {
  hide: () => void;
  cleanup: () => void;
}

export function createLoadingScreenController(
  shell: LoadingScreenShell,
  facts: readonly string[],
  intervalMs = 2_200
): LoadingScreenController {
  let index = 0;
  shell.fact.textContent = facts[index] ?? '';

  const interval = globalThis.setInterval(() => {
    if (facts.length === 0) {
      return;
    }
    index = (index + 1) % facts.length;
    shell.fact.textContent = facts[index];
  }, intervalMs);

  return {
    hide: () => {
      shell.root.classList.add('is-hidden');
      shell.root.hidden = true;
    },
    cleanup: () => globalThis.clearInterval(interval)
  };
}

export function loadingScreenFromDocument(documentRef: Document): LoadingScreenShell | undefined {
  const root = documentRef.getElementById('loading-screen');
  const fact = documentRef.getElementById('loading-fact');
  if (!root || !fact) {
    return undefined;
  }

  return { root, fact };
}
