import stringsJson from '../content/strings.json';
import type { MineralType, ResourceState, TextMode } from '../state/types';
import type { TextModeText } from './text';
import { textForMode } from './text';

const STAGE_NAMES = (stringsJson as unknown as { menu: { steps: TextModeText[] } }).menu.steps;

export interface PipelineHudLabels {
  minerals: TextModeText;
  mineralNames: Record<MineralType, TextModeText>;
  wafers: TextModeText;
  chips: TextModeText;
  energy: TextModeText;
  water: TextModeText;
  credits: TextModeText;
}

export interface PipelineHudOptions {
  resources: ResourceState;
  textMode: TextMode;
  labels: PipelineHudLabels;
  /** Current chapter (1-6); renders the six-stage progress strip. */
  stage?: number;
  moduleNav?: PipelineHudModuleNavOptions;
  actionLabels?: PipelineHudActionLabels;
  onOpenCodex?: () => void;
  onOpenSettings?: () => void;
}

export interface PipelineHudModuleNavOptions {
  unlockedChapters: number[];
  activeChapter: number;
  onSwitchChapter: (chapter: number) => void;
}

export interface MountedPipelineHud {
  update: (resources: ResourceState, textMode?: TextMode) => void;
  cleanup: () => void;
}

export interface PipelineHudActionLabels {
  codex: TextModeText;
  settings: TextModeText;
}

const MINERALS: MineralType[] = ['quartz', 'copper', 'lithium', 'cobalt', 'rareEarths'];
const MINERAL_COLORS: Record<MineralType, string> = {
  quartz: '#f8fafc',
  copper: '#f59e0b',
  lithium: '#fb7185',
  cobalt: '#60a5fa',
  rareEarths: '#a78bfa'
};

export function mountPipelineHud(root: HTMLElement, options: PipelineHudOptions): MountedPipelineHud {
  let previous = options.resources;
  let textMode = options.textMode;

  const shell = document.createElement('section');
  shell.className = 'pipeline-hud';
  shell.setAttribute('aria-label', textForMode(options.labels.minerals, textMode));
  root.append(shell);

  const render = (resources: ResourceState): void => {
    shell.replaceChildren();
    shell.setAttribute('aria-label', textForMode(options.labels.minerals, textMode));

    if (options.stage) {
      shell.append(stageStrip(options.stage, textMode));
    }

    if (options.moduleNav) {
      shell.append(moduleNav(options.moduleNav, textMode));
    }

    const mineralGroup = document.createElement('div');
    mineralGroup.className = 'resource-group minerals-group';

    const mineralTitle = document.createElement('span');
    mineralTitle.className = 'resource-group-title';
    mineralTitle.textContent = textForMode(options.labels.minerals, textMode);
    mineralGroup.append(mineralTitle);

    for (const mineral of MINERALS) {
      mineralGroup.append(resourceCell({
        key: mineral,
        label: textForMode(options.labels.mineralNames[mineral], textMode),
        value: resources.minerals[mineral],
        previousValue: previous.minerals[mineral],
        icon: gemIcon(mineral)
      }));
    }

    shell.append(
      mineralGroup,
      resourceCell({
        key: 'wafers',
        label: textForMode(options.labels.wafers, textMode),
        value: resources.wafers,
        previousValue: previous.wafers,
        icon: textIcon('W')
      }),
      resourceCell({
        key: 'chips',
        label: textForMode(options.labels.chips, textMode),
        value: resources.chips,
        previousValue: previous.chips,
        icon: textIcon('C')
      }),
      resourceCell({
        key: 'energy',
        label: textForMode(options.labels.energy, textMode),
        value: resources.energy,
        previousValue: previous.energy,
        icon: textIcon('E')
      }),
      resourceCell({
        key: 'water',
        label: textForMode(options.labels.water, textMode),
        value: resources.water,
        previousValue: previous.water,
        icon: textIcon('H2O')
      }),
      resourceCell({
        key: 'credits',
        label: textForMode(options.labels.credits, textMode),
        value: resources.credits,
        previousValue: previous.credits,
        icon: textIcon('$')
      })
    );

    if (options.actionLabels && options.onOpenCodex && options.onOpenSettings) {
      shell.append(
        hudButton(textForMode(options.actionLabels.codex, textMode), options.onOpenCodex),
        hudButton(textForMode(options.actionLabels.settings, textMode), options.onOpenSettings)
      );
    }
  };

  render(options.resources);

  return {
    update: (resources, nextTextMode) => {
      textMode = nextTextMode ?? textMode;
      render(resources);
      previous = resources;
    },
    cleanup: () => {
      shell.remove();
    }
  };
}

function resourceCell(options: {
  key: string;
  label: string;
  value: number;
  previousValue: number;
  icon: HTMLElement | SVGElement;
}): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'resource-cell';
  cell.dataset.resource = options.key;

  const value = document.createElement('strong');
  value.className = 'resource-value';
  if (options.value !== options.previousValue) {
    value.classList.add('resource-value-changed', options.value > options.previousValue ? 'is-up' : 'is-down');
  }
  value.textContent = String(Math.floor(options.value));

  const label = document.createElement('span');
  label.className = 'resource-label';
  label.textContent = options.label;

  cell.append(options.icon, value, label);
  return cell;
}

function gemIcon(mineral: MineralType): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('resource-icon', 'gem-icon');

  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', '16 2 29 11 24 29 8 29 3 11');
  polygon.setAttribute('fill', MINERAL_COLORS[mineral]);
  polygon.setAttribute('stroke', '#17202a');
  polygon.setAttribute('stroke-width', '2');
  svg.append(polygon);

  const shine = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  shine.setAttribute('points', '9 11 16 5 23 11 16 29');
  shine.setAttribute('fill', 'none');
  shine.setAttribute('stroke', 'rgba(255,255,255,0.72)');
  shine.setAttribute('stroke-width', '2');
  svg.append(shine);

  return svg;
}

function textIcon(text: string): HTMLElement {
  const icon = document.createElement('span');
  icon.className = 'resource-icon text-resource-icon';
  icon.textContent = text;
  return icon;
}

function stageStrip(stage: number, textMode: TextMode): HTMLElement {
  const strip = document.createElement('div');
  strip.className = 'hud-stage-strip';

  const currentName = STAGE_NAMES[stage - 1];
  strip.setAttribute('role', 'img');
  strip.setAttribute(
    'aria-label',
    currentName ? `${textForMode(currentName, textMode)} — ${stage}/6` : `${stage}/6`
  );

  for (let index = 1; index <= STAGE_NAMES.length; index += 1) {
    const node = document.createElement('span');
    node.className = index < stage ? 'hud-stage-node is-done' : index === stage ? 'hud-stage-node is-current' : 'hud-stage-node';
    node.title = textForMode(STAGE_NAMES[index - 1], textMode);
    strip.append(node);
  }

  const label = document.createElement('span');
  label.className = 'hud-stage-label';
  label.textContent = currentName ? textForMode(currentName, textMode) : '';
  strip.append(label);

  return strip;
}

function moduleNav(options: PipelineHudModuleNavOptions, textMode: TextMode): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'module-nav';
  nav.setAttribute('aria-label', 'Switch module');

  const chapters = [...new Set(options.unlockedChapters)]
    .filter((chapter) => Number.isInteger(chapter) && chapter >= 1 && chapter <= STAGE_NAMES.length)
    .sort((a, b) => a - b);

  for (const chapter of chapters) {
    const label = STAGE_NAMES[chapter - 1];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = chapter === options.activeChapter
      ? 'module-nav-button is-active'
      : 'module-nav-button';
    button.textContent = textForMode(label, textMode);
    button.dataset.chapter = String(chapter);
    if (chapter === options.activeChapter) {
      button.setAttribute('aria-current', 'step');
    }
    button.addEventListener('click', () => options.onSwitchChapter(chapter));
    nav.append(button);
  }

  return nav;
}

function hudButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hud-tool-button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}
