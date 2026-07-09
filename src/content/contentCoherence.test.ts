import { describe, expect, it } from 'vitest';
import chips from './chips.json';
import codex from './codex.json';
import strings from './strings.json';

function collectStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string') {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }
    return output;
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectStrings(item, output);
    }
  }

  return output;
}

describe('content coherence', () => {
  const allContentText = collectStrings({ chips, codex, strings }).join('\n');

  it('does not confuse DRAM with flash storage language', () => {
    expect(allContentText).not.toMatch(/Flash the Librarian/i);
  });

  it('keeps Chapter 3 crystal-growth benchmarks factual', () => {
    expect(allContentText).not.toMatch(/slower than your fingernails/i);
    expect(allContentText).not.toMatch(/thinner than a credit card/i);
  });

  it('keeps shipped content free of implementation-placeholder language', () => {
    expect(allContentText).not.toMatch(/\bstub\b/i);
  });

  it('keeps brittle fabrication benchmarks softened as approximations', () => {
    expect(allContentText).not.toMatch(/about 3 months/i);
    expect(allContentText).not.toMatch(/over 1,000 tiny steps/i);
    expect(allContentText).not.toMatch(/one wrong atom in a billion is too many/i);
    expect(allContentText).toMatch(/teaching shortcut/i);
    expect(allContentText).toMatch(/many weeks/i);
  });

  it('frames the campaign around the Nova rescue mission and character tension', () => {
    expect(allContentText).toMatch(/Nova is offline/i);
    expect(allContentText).toMatch(/clinic/i);
    expect(allContentText).toMatch(/urgency does not remove the need for honest abstractions/i);
    expect(allContentText).toMatch(/speed has to answer to purity/i);
    expect(allContentText).toMatch(/without cooking it/i);
  });
});
