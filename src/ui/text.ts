import type { TextMode } from '../state/types';

export interface TextModeText {
  kid: string;
  nerd: string;
}

export function textForMode(text: TextModeText, mode: TextMode): string {
  return text[mode];
}
