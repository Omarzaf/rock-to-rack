import type { PaceStatus } from '../sim/pace';
import type { ResourceState } from '../state/types';

export type DebugGrantKind = 'credits' | 'resources' | 'chips';

export interface DebugResourceRates {
  creditsPerMinute: number;
  energyPerMinute: number;
  waterPerMinute: number;
  chipsPerMinute: number;
}

export interface DebugOverlayState {
  pace: PaceStatus;
  resources: ResourceState;
  rates: DebugResourceRates;
}

export interface DebugOverlayOptions {
  state: DebugOverlayState;
  onSceneJump: (chapter: number) => void;
  onGrantResources: (kind: DebugGrantKind) => void;
}

export interface MountedDebugOverlay {
  update: (state: DebugOverlayState) => void;
  cleanup: () => void;
}

export function mountDebugOverlay(root: HTMLElement, options: DebugOverlayOptions): MountedDebugOverlay {
  const shell = document.createElement('aside');
  shell.className = 'debug-overlay';
  root.append(shell);

  let currentState = options.state;

  const render = (): void => {
    shell.replaceChildren();
    shell.append(
      heading(currentState),
      row('Progress', `${Math.round(currentState.pace.progressRatio * 100)}%`),
      row('Expected', `${Math.round(currentState.pace.expectedRatio * 100)}%`),
      row('Catch-up', `${currentState.pace.catchUpMultiplier}x`),
      row('Credits/min', currentState.rates.creditsPerMinute.toFixed(1)),
      row('Energy/min', currentState.rates.energyPerMinute.toFixed(1)),
      row('Water/min', currentState.rates.waterPerMinute.toFixed(1)),
      row('Chips/min', currentState.rates.chipsPerMinute.toFixed(1)),
      row('Credits', String(Math.floor(currentState.resources.credits))),
      sceneJumpControls(options.onSceneJump),
      grantControls(options.onGrantResources)
    );
  };

  render();

  return {
    update: (state) => {
      currentState = state;
      render();
    },
    cleanup: () => {
      shell.remove();
    }
  };
}

function heading(state: DebugOverlayState): HTMLElement {
  const title = document.createElement('h2');
  title.textContent = `Debug Ch${state.pace.chapter} ${state.pace.state}`;
  return title;
}

function row(label: string, value: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'debug-row';
  item.append(text('span', label), text('strong', value));
  return item;
}

function sceneJumpControls(onSceneJump: (chapter: number) => void): HTMLElement {
  const group = document.createElement('div');
  group.className = 'debug-button-grid';
  for (let chapter = 1; chapter <= 6; chapter += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.sceneJump = String(chapter);
    button.textContent = `Ch${chapter}`;
    button.addEventListener('click', () => onSceneJump(chapter));
    group.append(button);
  }
  return group;
}

function grantControls(onGrantResources: (kind: DebugGrantKind) => void): HTMLElement {
  const group = document.createElement('div');
  group.className = 'debug-button-grid';
  const grants: Array<[DebugGrantKind, string]> = [
    ['credits', '+Credits'],
    ['resources', '+Resources'],
    ['chips', '+Chips']
  ];
  for (const [kind, label] of grants) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.grant = kind;
    button.textContent = label;
    button.addEventListener('click', () => onGrantResources(kind));
    group.append(button);
  }
  return group;
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
