import type { GameState, TextSize } from '../state/types';
import { activateModalFocus, type ModalFocusController } from './modalFocus';

export interface SettingsOverlayOptions {
  state: GameState;
  onSetTextMode: () => void;
  onSetMuted: () => void;
  onSetTextSize: (textSize: TextSize) => void;
  onResetSave: () => void;
  onClose: () => void;
}

export interface MountedSettingsOverlay {
  update: (options: SettingsOverlayOptions) => void;
  cleanup: () => void;
}

export function mountSettingsOverlay(root: HTMLElement, options: SettingsOverlayOptions): MountedSettingsOverlay {
  const backdrop = document.createElement('section');
  backdrop.className = 'settings-backdrop';
  root.append(backdrop);
  let focusController: ModalFocusController | undefined;

  const render = (nextOptions: SettingsOverlayOptions): void => {
    const panel = document.createElement('article');
    panel.className = 'settings-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'settings-title');

    const header = document.createElement('header');
    header.className = 'settings-header';
    header.append(heading('Settings'), button('Close', nextOptions.onClose, 'secondary-action'));

    const controls = document.createElement('div');
    controls.className = 'settings-controls';
    controls.append(
      button(`Mode: ${nextOptions.state.preferences.textMode === 'kid' ? 'Kid' : 'Nerd'}`, nextOptions.onSetTextMode),
      button(nextOptions.state.preferences.muted ? 'Muted' : 'Sound On', nextOptions.onSetMuted),
      button(`Text: ${nextOptions.state.preferences.textSize === 'normal' ? 'Normal' : 'Large'}`, () => {
        nextOptions.onSetTextSize(nextOptions.state.preferences.textSize === 'normal' ? 'large' : 'normal');
      }),
      button('Reset save', nextOptions.onResetSave, 'danger-action')
    );

    panel.append(header, controls, parentInfo());
    focusController?.deactivate({ restoreFocus: false });
    backdrop.replaceChildren(panel);
    focusController = activateModalFocus(panel, nextOptions.onClose);
  };

  render(options);

  return {
    update: render,
    cleanup: () => {
      focusController?.deactivate();
      backdrop.remove();
    }
  };
}

function button(label: string, onClick: () => void, className = 'toggle-action'): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

function heading(text: string): HTMLElement {
  const title = document.createElement('h2');
  title.id = 'settings-title';
  title.textContent = text;
  return title;
}

function parentInfo(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'parent-info';

  const title = document.createElement('h3');
  title.textContent = 'Teacher / Parent';

  const body = document.createElement('p');
  body.textContent = 'Rock to Rack teaches the semiconductor supply chain through six chapters: mining, refining, crystal growth, fabrication, packaging, and data centers. Field Checks are low-stakes and explain missed answers.';

  section.append(title, body);
  return section;
}
