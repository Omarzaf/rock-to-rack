import type { CrisisRunReplayComparison } from '../sim/crisisRun';
import type { ChipTypeId, CrisisRunResult, DatacenterBuildingType } from '../state/types';
import { activateModalFocus } from './modalFocus';

export interface CrisisRunOverlayOptions {
  elapsedSeconds: number;
  cityLights: number;
  heat: number;
  powerLoad: number;
  powerCapacity: number;
  selectedBuildType: DatacenterBuildingType;
  availableChipIds: ChipTypeId[];
  installedChipIds: ChipTypeId[];
  selectedChipId: ChipTypeId | null;
  selectedRackLabel: string | null;
  canInstallSelectedChip: boolean;
  canComplete: boolean;
  challengeLabel: string;
  message: string;
  onSelectBuildType: (type: DatacenterBuildingType) => void;
  onSelectChip: (chipId: ChipTypeId) => void;
  onInstallSelectedChip: () => void;
  onComplete: () => void;
  onMenu: () => void;
}

export interface CrisisRunResultOptions {
  result: CrisisRunResult;
  runNumber: number;
  comparison: CrisisRunReplayComparison;
  challengeLabel: string;
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
  let latest = options;
  const shell = document.createElement('section');
  shell.className = 'crisis-overlay';
  root.append(shell);

  const header = document.createElement('div');
  header.className = 'crisis-header';
  const challengeLabel = elementWithText('p', 'crisis-challenge-label', '');
  header.append(
    elementWithText('h1', 'crisis-title', 'Crisis Run'),
    elementWithText('p', 'crisis-objective', 'Bring Nova online before the city goes dark.'),
    challengeLabel
  );

  const stats = document.createElement('div');
  stats.className = 'crisis-stats';
  const statValues = {
    time: stat('Time', ''),
    lights: stat('Lights', ''),
    heat: stat('Heat', ''),
    power: stat('Power', '')
  };
  stats.append(statValues.time.item, statValues.lights.item, statValues.heat.item, statValues.power.item);

  const builds = document.createElement('div');
  builds.className = 'crisis-builds';
  const buildButtons = new Map<DatacenterBuildingType, HTMLButtonElement>();
  for (const type of BUILD_TYPES) {
    const build = button(labelForBuild(type), '', () => latest.onSelectBuildType(type));
    build.dataset.buildType = type;
    buildButtons.set(type, build);
    builds.append(build);
  }

  const chips = document.createElement('div');
  chips.className = 'crisis-chips';
  const chipHelp = elementWithText('p', 'crisis-chip-help', '');
  const selectedHelp = elementWithText('p', 'crisis-build-help', '');
  const message = elementWithText('p', 'crisis-message', '');
  const actions = document.createElement('div');
  actions.className = 'crisis-actions';
  const installChip = button('Install chip', 'secondary-action crisis-install-chip', () => latest.onInstallSelectedChip());
  const complete = button('Serve Nova', 'primary-action', () => latest.onComplete());
  actions.append(installChip, complete, button('Menu', 'secondary-action', () => latest.onMenu()));

  shell.append(header, stats, builds, chips, selectedHelp, chipHelp, message, actions);

  const render = (next: CrisisRunOverlayOptions): void => {
    latest = next;
    challengeLabel.textContent = next.challengeLabel;
    statValues.time.value.textContent = `${Math.round(next.elapsedSeconds)}s`;
    statValues.lights.value.textContent = `${Math.round(next.cityLights)}%`;
    statValues.heat.value.textContent = `${Math.round(next.heat)}%`;
    statValues.power.value.textContent = `${Math.round(next.powerLoad)}/${Math.round(next.powerCapacity)}`;

    for (const [type, build] of buildButtons.entries()) {
      build.className = type === next.selectedBuildType ? 'is-selected' : '';
    }
    chips.replaceChildren();
    if (next.availableChipIds.length === 0) {
      chips.append(elementWithText('span', 'crisis-chip-empty', 'All chips installed'));
    } else {
      for (const chipId of next.availableChipIds) {
        const chip = button(labelForChip(chipId), chipId === next.selectedChipId ? 'is-selected' : '', () => latest.onSelectChip(chipId));
        chip.dataset.chipId = chipId;
        chips.append(chip);
      }
    }
    selectedHelp.textContent = buildHelp(next.selectedBuildType);
    chipHelp.textContent = chipHelpText(next);
    message.textContent = next.message;
    installChip.disabled = !next.canInstallSelectedChip;
    complete.disabled = !next.canComplete;
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
    stat('Time', formatResultSeconds(options.result.elapsedSeconds)).item,
    stat('Lights', `${Math.round(options.result.cityLights)}%`).item,
    stat('Heat peak', `${Math.round(options.result.heatPeak)}%`).item
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
    elementWithText('p', 'crisis-result-challenge', options.challengeLabel),
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

function stat(label: string, value: string): { item: HTMLElement; value: HTMLElement } {
  const item = document.createElement('span');
  item.className = 'crisis-stat';
  const valueElement = elementWithText('strong', '', value);
  item.append(valueElement, elementWithText('small', '', label));
  return { item, value: valueElement };
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

function labelForChip(chipId: ChipTypeId): string {
  const labels: Record<ChipTypeId, string> = {
    cpu: 'CPU',
    gpu: 'GPU',
    dram: 'DRAM',
    nand: 'NAND',
    nic: 'NIC',
    pmic: 'PMIC',
    nova: 'Nova'
  };
  return labels[chipId];
}

function chipHelpText(options: CrisisRunOverlayOptions): string {
  if (options.installedChipIds.length > 0) {
    return `Installed: ${options.installedChipIds.map(labelForChip).join(', ')}.`;
  }

  if (!options.selectedChipId) {
    return 'No campaign chips remain. Replay the campaign for a stronger Crisis Run inventory.';
  }

  const rack = options.selectedRackLabel ?? 'a rack';
  return `Selected chip: ${labelForChip(options.selectedChipId)}. Select ${rack}, then install it before serving Nova.`;
}

function formatResultSeconds(seconds: number): string {
  return `${Math.max(1, Math.round(seconds))}s`;
}
