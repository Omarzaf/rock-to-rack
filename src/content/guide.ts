import type { DialogueLine } from '../ui/dialogueOverlay';
import type { TextModeText } from '../ui/text';

export interface GuideFact {
  text: TextModeText;
  sourceId: 'nvidia-about' | 'sia-101';
}

export const GUIDE_FACTS: Record<1 | 2 | 3 | 4 | 5 | 6, GuideFact[]> = {
  1: [
    {
      sourceId: 'sia-101',
      text: {
        kid: 'A chip starts with materials that must move through many steps before it can compute.',
        nerd: 'SIA describes semiconductor manufacturing as a layered process that turns materials into finished chips.'
      }
    }
  ],
  2: [
    {
      sourceId: 'sia-101',
      text: {
        kid: 'Refining is where ordinary material starts becoming electronics-grade input.',
        nerd: 'Semiconductor process flow depends on carefully prepared materials before circuit fabrication.'
      }
    }
  ],
  3: [
    {
      sourceId: 'sia-101',
      text: {
        kid: 'Wafers are the flat stages where chip patterns will later be built.',
        nerd: 'The wafer is the manufacturing substrate for the later patterning, etching, and layering steps.'
      }
    }
  ],
  4: [
    {
      sourceId: 'sia-101',
      text: {
        kid: 'A tiny process miss can hurt yield, so clean rooms and control loops matter.',
        nerd: 'Fabrication depends on repeated precision steps; yield is shaped by contamination, alignment, and process control.'
      }
    }
  ],
  5: [
    {
      sourceId: 'sia-101',
      text: {
        kid: 'Testing and packaging turn working die into chips that can survive real products.',
        nerd: 'The back-end flow separates working die, packages them, and prepares chips for system integration.'
      }
    }
  ],
  6: [
    {
      sourceId: 'nvidia-about',
      text: {
        kid: 'AI factories need chips, power, cooling, and software working as one system.',
        nerd: 'Industry framing describes modern AI infrastructure as chips, systems, and software for AI factories.'
      }
    }
  ]
};

export function vegaGuideLines(lines: DialogueLine[], chapter: 1 | 2 | 3 | 4 | 5 | 6): DialogueLine[] {
  const facts = GUIDE_FACTS[chapter];

  return lines.map((line, index) => {
    const fact = facts[index % facts.length];
    return {
      ...line,
      speakerName: {
        kid: 'Dr. Vega',
        nerd: 'Dr. Vega, systems mentor'
      },
      portraitColor: '#60d394',
      text: {
        kid: `${line.text.kid} Fun fact: ${fact.text.kid}`,
        nerd: `${line.text.nerd} Source-backed note: ${fact.text.nerd}`
      }
    };
  });
}
