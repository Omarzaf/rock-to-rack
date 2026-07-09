import { describe, expect, it } from 'vitest';
import { textForMode } from './text';

describe('textForMode', () => {
  it('selects the kid or nerd register from the same content object', () => {
    const text = {
      kid: 'Kid text',
      nerd: 'Nerd text'
    };

    expect(textForMode(text, 'kid')).toBe('Kid text');
    expect(textForMode(text, 'nerd')).toBe('Nerd text');
  });
});
