import codexJson from '../content/codex.json';
import stringsJson from '../content/strings.json';
import { getCodexViewModel, type CodexEntry } from '../sim/codex';
import { gameStore } from '../state/gameStore';
import { clearSavedState } from '../state/storage';
import type { TextMode, TextSize } from '../state/types';
import { mountCodexOverlay, type MountedCodexOverlay } from './codexOverlay';
import { mountSettingsOverlay, type MountedSettingsOverlay, type SettingsOverlayOptions } from './settingsOverlay';
import type { PipelineHudActionLabels } from './pipelineHud';

interface GlobalStrings {
  globalTools: PipelineHudActionLabels;
}

export interface GlobalPanelController {
  openCodex: () => void;
  openSettings: () => void;
  update: () => void;
  cleanup: () => void;
}

export interface GlobalPanelControllerOptions {
  getTextMode: () => TextMode;
  onToggleTextMode: () => void;
  onPreferencesChanged?: () => void;
}

const CODEX = codexJson as CodexEntry[];
const STRINGS = stringsJson as GlobalStrings;

export const GLOBAL_TOOL_LABELS = STRINGS.globalTools;

export function createGlobalPanelController(options: GlobalPanelControllerOptions): GlobalPanelController {
  let codexOverlay: MountedCodexOverlay | undefined;
  let settingsOverlay: MountedSettingsOverlay | undefined;

  const update = (): void => {
    codexOverlay?.update(getCodexViewModel(CODEX, gameStore.getState(), options.getTextMode()));
    settingsOverlay?.update(settingsOptions(options, update, closeSettings));
  };

  const closeCodex = (): void => {
    codexOverlay?.cleanup();
    codexOverlay = undefined;
  };

  function closeSettings(): void {
    settingsOverlay?.cleanup();
    settingsOverlay = undefined;
  }

  return {
    openCodex: () => {
      const uiRoot = documentRoot();
      closeCodex();
      codexOverlay = mountCodexOverlay(uiRoot, getCodexViewModel(CODEX, gameStore.getState(), options.getTextMode()), closeCodex);
    },
    openSettings: () => {
      const uiRoot = documentRoot();
      closeSettings();
      settingsOverlay = mountSettingsOverlay(uiRoot, settingsOptions(options, update, closeSettings));
    },
    update,
    cleanup: () => {
      closeCodex();
      closeSettings();
    }
  };
}

function settingsOptions(
  options: GlobalPanelControllerOptions,
  update: () => void,
  closeSettings: () => void
): SettingsOverlayOptions {
  return {
    state: gameStore.getState(),
    onSetTextMode: () => {
      options.onToggleTextMode();
      options.onPreferencesChanged?.();
      update();
    },
    onSetMuted: () => {
      gameStore.setMuted(!gameStore.getState().preferences.muted);
      options.onPreferencesChanged?.();
      update();
    },
    onSetTextSize: (textSize: TextSize) => {
      gameStore.setTextSize(textSize);
      document.body.classList.toggle('text-large', textSize === 'large');
      options.onPreferencesChanged?.();
      update();
    },
    onResetSave: () => {
      clearSavedState();
      window.location.href = `${window.location.pathname}?reset#menu`;
    },
    onClose: closeSettings
  };
}

function documentRoot(): HTMLElement {
  const root = document.getElementById('ui-root');
  if (!root) {
    throw new Error('Missing #ui-root element');
  }
  return root;
}
