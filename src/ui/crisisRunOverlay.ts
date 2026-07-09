import type { CrisisRunReplayComparison } from '../sim/crisisRun';
import type { CrisisRunResult, DatacenterBuildingType } from '../state/types';
import { activateModalFocus } from './modalFocus';

export interface CrisisRunOverlayOptions {
  elapsedSeconds: number;
  cityLights: number;
  heat: number;
  powerLoad: number;
  powerCapacity: number;
  selectedBuildType: DatacenterBuildingType;
  canComplete: boolean;
  message: string;
  onSelectBuildType: (type: DatacenterBuildingType) => void;
  onComplete: () => void;
  onMenu: () => void;
}

export interface CrisisRunResultOptions {
  result: CrisisRunResult;
  runNumber: number;
  comparison: CrisisRunReplayComparison;
  onCopyResult?: (shareLine: string) => boolean | Promise<boolean>;
  onReplay: () => void;
  onMenu: () => void;
}

export interface MountedCrisisRunOverlay {
  update: (options: CrisisRunOverlayOptions) => void;
  cleanup: () => void;
}

const BUILD_TYPES: DatacenterBuildingType[] = ['rack', 'power', 'cooling', 'network', 'battery'];

export function mountCrisisRunOverlay(root: HTMLElement, options: CrisisRunOverlayOptions): MountedCrisisRunOverlay {
  const shell = document.createElement('section');
  shell.className = 'crisis-overlay';
  root.append(shell);

  const render = (next: CrisisRunOverlayOptions): void => {
    const header = document.createElement('div');
    header.className = 'crisis-header';
    header.append(
      elementWithText('h1', 'crisis-title', 'Crisis Run'),
      elementWithText('p', 'crisis-objective', 'Bring Nova online before the city goes dark.')
    );

    const stats = document.createElement('div');
    stats.className = 'crisis-stats';
    stats.append(
      stat('Time', `${Math.round(next.elapsedSeconds)}s`),
      stat('Lights', `${Math.round(next.cityLights)}%`),
      stat('Heat', `${Math.round(next.heat)}%`),
      stat('Power', `${Math.round(next.powerLoad)}/${Math.round(next.powerCapacity)}`)
    );

    const builds = document.createElement('div');
    builds.className = 'crisis-builds';
    for (const type of BUILD_TYPES) {
      const build = button(labelForBuild(type), type === next.selectedBuildType ? 'is-selected' : '', () => next.onSelectBuildType(type));
      build.dataset.buildType = type;
      builds.append(build);
    }

    const selectedHelp = elementWithText('p', 'crisis-build-help', buildHelp(next.selectedBuildType));
    const message = elementWithText('p', 'crisis-message', next.message);
    const actions = document.createElement('div');
    actions.className = 'crisis-actions';
    const complete = button('Serve Nova', 'primary-action', next.onComplete);
    complete.disabled = !next.canComplete;
    actions.append(complete, button('Menu', 'secondary-action', next.onMenu));

    shell.replaceChildren(header, stats, builds, selectedHelp, message, actions);
  };

  render(options);

  return {
    update: render,
    cleanup: () => shell.remove()
  };
}

export function mountCrisisRunResult(root: HTMLElement, options: CrisisRunResultOptions): { cleanup: () => void } {
  const backdrop = document.createElement('section');
  backdrop.className = 'crisis-result-backdrop';

  const card = document.createElement('article');
  card.className = 'crisis-result-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'crisis-result-title');
  const isNewScoreBest = options.comparison.status === 'first-run' || options.comparison.status === 'new-best';
  const stats = document.createElement('div');
  stats.className = 'crisis-result-stats';
  stats.append(
    stat('Time', formatResultSeconds(options.result.elapsedSeconds)),
    stat('Lights', `${Math.round(options.result.cityLights)}%`),
    stat('Heat peak', `${Math.round(options.result.heatPeak)}%`)
  );
  const comparison = document.createElement('div');
  comparison.className = 'crisis-replay-summary';
  comparison.append(
    elementWithText('span', 'crisis-run-number', `Run ${options.runNumber}`),
    elementWithText('strong', '', options.comparison.headline),
    elementWithText('p', '', options.comparison.detail),
    elementWithText('small', '', `Next target: ${options.comparison.targetScore}`)
  );
  const title = elementWithText('h2', '', `${options.result.score} pts - Grade ${options.result.grade}`);
  title.id = 'crisis-result-title';

  card.append(
    elementWithText('span', 'crisis-result-kicker', isNewScoreBest ? 'New best' : 'Run complete'),
    title,
    elementWithText('p', 'crisis-share-line', options.result.shareLine),
    comparison,
    stats
  );

  const copyStatus = elementWithText('p', 'crisis-copy-status', '');
  copyStatus.setAttribute('aria-live', 'polite');

  const actions = document.createElement('div');
  actions.className = 'crisis-result-actions';
  actions.append(
    button('Copy result', 'secondary-action crisis-copy', async () => {
      const copied = await Promise.resolve(options.onCopyResult?.(options.result.shareLine) ?? false);
      copyStatus.textContent = copied ? 'Copied result.' : 'Copy unavailable. Select the result line.';
    }),
    button(options.comparison.replayPrompt, 'primary-action crisis-replay', options.onReplay),
    button('Menu', 'secondary-action crisis-menu', options.onMenu)
  );

  card.append(copyStatus, actions);
  backdrop.append(card);
  root.append(backdrop);
  const focusController = activateModalFocus(card);

  return {
    cleanup: () => {
      focusController.deactivate();
      backdrop.remove();
    }
  };
}

function buildHelp(type: DatacenterBuildingType): string {
  const help: Record<DatacenterBuildingType, string> = {
    rack: 'Selected: Rack - adds compute, uses power, and raises heat.',
    power: 'Selected: Power - expands capacity so racks can run.',
    cooling: 'Selected: Cooling - lowers heat pressure and spends water.',
    network: 'Selected: Network - links Nova to city jobs.',
    battery: 'Selected: Battery - stores backup power for instability.'
  };
  return `${help[type]} Tap a grid cell to place it.`;
}

function stat(label: string, value: string): HTMLElement {
  const item = document.createElement('span');
  item.className = 'crisis-stat';
  item.append(elementWithText('strong', '', value), elementWithText('small', '', label));
  return item;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

function elementWithText<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function labelForBuild(type: DatacenterBuildingType): string {
  const labels: Record<DatacenterBuildingType, string> = {
    rack: 'Rack',
    power: 'Power',
    cooling: 'Cooling',
    network: 'Network',
    battery: 'Battery'
  };
  return labels[type];
}

function formatResultSeconds(seconds: number): string {
  return `${Math.max(1, Math.round(seconds))}s`;
}
