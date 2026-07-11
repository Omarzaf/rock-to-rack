import { describe, expect, it } from 'vitest';
import type { DialogueLine } from '../ui/dialogueOverlay';
import { GUIDE_FACTS, vegaGuideLines } from './guide';

const baseLines: DialogueLine[] = [
  {
    id: 'step-one',
    speakerName: { kid: 'Sam', nerd: 'Sam' },
    portraitColor: '#f8d45c',
    text: { kid: 'Do the first thing.', nerd: 'Execute the first operation.' }
  },
  {
    id: 'step-two',
    speakerName: { kid: 'Dr. Vega', nerd: 'Dr. Vega' },
    portraitColor: '#60d394',
    text: { kid: 'Do the second thing.', nerd: 'Execute the second operation.' }
  }
];

describe('Vega guide content', () => {
  it('converts chapter instructions into sourced Vega guide lines', () => {
    const lines = vegaGuideLines(baseLines, 1);

    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.speakerName.kid.includes('Dr. Vega'))).toBe(true);
    expect(lines.every((line) => line.portraitColor === '#60d394')).toBe(true);
    expect(lines[0].text.kid).toContain('Fun fact:');
    expect(lines[0].text.nerd).toContain('Source-backed note:');
  });

  it('keeps guide facts source-backed for every chapter', () => {
    for (const chapter of [1, 2, 3, 4, 5, 6] as const) {
      expect(GUIDE_FACTS[chapter].length).toBeGreaterThan(0);
      expect(GUIDE_FACTS[chapter].every((fact) => fact.sourceId.length > 0)).toBe(true);
    }
  });
});
