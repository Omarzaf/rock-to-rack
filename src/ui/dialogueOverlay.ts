import { playUiCue } from '../audio/soundDesign';
import type { TextMode } from '../state/types';
import type { TextModeText } from './text';
import { textForMode } from './text';
import { activateModalFocus, type ModalFocusController } from './modalFocus';

export interface DialogueLine {
  id: string;
  speakerName: TextModeText;
  portraitColor: string;
  portraitAlt?: TextModeText;
  text: TextModeText;
}

export interface DialogueLabels {
  next: TextModeText;
  done: TextModeText;
  skip?: TextModeText;
}

export interface DialogueOptions {
  lines: DialogueLine[];
  textMode: TextMode;
  labels: DialogueLabels;
  onComplete: () => void;
}

export interface MountedDialogue {
  updateMode: (textMode: TextMode) => void;
  cleanup: () => void;
}

let dialogueId = 0;

export function mountDialogue(root: HTMLElement, options: DialogueOptions): MountedDialogue {
  let textMode = options.textMode;
  let index = 0;
  let closed = false;
  let focusController: ModalFocusController | undefined;
  const titleId = `dialogue-speaker-${++dialogueId}`;
  const descriptionId = `dialogue-text-${dialogueId}`;

  const shell = document.createElement('section');
  shell.className = 'dialogue-shell';
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-modal', 'true');
  shell.setAttribute('aria-labelledby', titleId);
  shell.setAttribute('aria-describedby', descriptionId);
  root.append(shell);

  const complete = (): void => {
    if (closed) {
      return;
    }

    closed = true;
    focusController?.deactivate();
    options.onComplete();
    shell.remove();
  };

  const advance = (): void => {
    playUiCue('guide');
    if (index >= options.lines.length - 1) {
      complete();
      return;
    }

    index += 1;
    render();
  };

  shell.addEventListener('click', advance);

  const render = (): void => {
    if (closed) {
      return;
    }

    const line = options.lines[index];
    shell.replaceChildren();

    const portrait = portraitElement(line, textMode);

    const body = document.createElement('div');
    body.className = 'dialogue-body';

    const name = document.createElement('strong');
    name.className = 'dialogue-name';
    name.id = titleId;
    name.textContent = textForMode(line.speakerName, textMode);

    const progress = document.createElement('span');
    progress.className = 'dialogue-progress';
    progress.textContent = `${index + 1} / ${options.lines.length}`;

    const text = document.createElement('p');
    text.className = 'dialogue-text';
    text.id = descriptionId;
    text.textContent = textForMode(line.text, textMode);

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'dialogue-next';
    action.textContent = textForMode(index >= options.lines.length - 1 ? options.labels.done : options.labels.next, textMode);
    action.addEventListener('click', (event) => {
      event.stopPropagation();
      advance();
    });
    const actions = document.createElement('div');
    actions.className = 'dialogue-actions';
    if (index > 0) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'dialogue-back';
      back.textContent = 'Back';
      back.addEventListener('click', (event) => {
        event.stopPropagation();
        playUiCue('guide');
        index -= 1;
        render();
      });
      actions.append(back);
    }
    actions.append(action);
    if (options.labels.skip && index < options.lines.length - 1) {
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'dialogue-skip';
      skip.textContent = textForMode(options.labels.skip, textMode);
      skip.addEventListener('click', (event) => {
        event.stopPropagation();
        complete();
      });
      actions.append(skip);
    }

    body.append(name, progress, text, actions);
    shell.append(portrait, body);
    focusController?.focusInitial();
  };

  render();
  focusController = activateModalFocus(shell, () => {
    if (options.labels.skip || index >= options.lines.length - 1) {
      complete();
    }
  });

  return {
    updateMode: (nextTextMode) => {
      textMode = nextTextMode;
      render();
    },
    cleanup: () => {
      if (closed) {
        return;
      }

      closed = true;
      focusController?.deactivate();
      shell.remove();
    }
  };
}

function portraitElement(line: DialogueLine, textMode: TextMode): HTMLElement {
  const portrait = document.createElement('div');
  portrait.className = 'dialogue-portrait';
  portrait.style.setProperty('--portrait-color', line.portraitColor);
  portrait.setAttribute('role', 'img');
  portrait.setAttribute(
    'aria-label',
    line.portraitAlt
      ? textForMode(line.portraitAlt, textMode)
      : textForMode(line.speakerName, textMode)
  );

  portrait.textContent = textForMode(line.speakerName, textMode).slice(0, 1);
  return portrait;
}
