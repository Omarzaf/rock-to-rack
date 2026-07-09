import stringsJson from '../content/strings.json';
import type { TextMode } from '../state/types';
import type { TextModeText } from './text';
import { textForMode } from './text';

export interface JourneyStage {
  fromGlyph: string;
  fromLabel: TextModeText;
  toGlyph: string;
  toLabel: TextModeText;
  benchmark: TextModeText;
  handoff: TextModeText;
}

interface JourneyStrings {
  benchmarkLabel: TextModeText;
  stages: Record<'ch1' | 'ch2' | 'ch3' | 'ch4' | 'ch5' | 'ch6', JourneyStage>;
}

const JOURNEY = (stringsJson as unknown as { journey: JourneyStrings }).journey;

export type JourneyChapter = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Appends the "artifact travels" block to a chapter-complete card:
 * what you brought in, what it became, how it compares to the real
 * industry, and where it goes next.
 */
export function appendJourneyBlock(card: HTMLElement, chapter: JourneyChapter, textMode: TextMode): void {
  const stage = JOURNEY.stages[`ch${chapter}` as keyof JourneyStrings['stages']];
  if (!stage) {
    return;
  }

  const block = document.createElement('section');
  block.className = 'journey-block';

  const transform = document.createElement('div');
  transform.className = 'journey-transform';
  transform.append(
    journeyChip(stage.fromGlyph, textForMode(stage.fromLabel, textMode), 'from'),
    journeyArrow(),
    journeyChip(stage.toGlyph, textForMode(stage.toLabel, textMode), 'to')
  );

  const benchmark = document.createElement('p');
  benchmark.className = 'journey-benchmark';

  const benchmarkTag = document.createElement('span');
  benchmarkTag.className = 'journey-benchmark-tag';
  benchmarkTag.textContent = textForMode(JOURNEY.benchmarkLabel, textMode);

  benchmark.append(benchmarkTag, document.createTextNode(textForMode(stage.benchmark, textMode)));

  const handoff = document.createElement('p');
  handoff.className = 'journey-handoff';
  handoff.textContent = textForMode(stage.handoff, textMode);

  block.append(transform, benchmark, handoff);
  card.append(block);
}

function journeyChip(glyph: string, label: string, kind: 'from' | 'to'): HTMLElement {
  const chip = document.createElement('span');
  chip.className = `journey-chip journey-chip-${kind}`;

  const face = document.createElement('strong');
  face.className = 'journey-chip-face';
  face.textContent = glyph;

  const caption = document.createElement('small');
  caption.textContent = label;

  chip.append(face, caption);
  return chip;
}

function journeyArrow(): HTMLElement {
  const arrow = document.createElement('span');
  arrow.className = 'journey-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  return arrow;
}
