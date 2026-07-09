import { describe, expect, it } from 'vitest';
import { LOADING_FACTS, SITE_METADATA } from './siteMetadata';

describe('site metadata', () => {
  it('defines a concise shippable pitch', () => {
    expect(SITE_METADATA.title).toBe('Rock to Rack');
    expect(SITE_METADATA.description.length).toBeGreaterThan(70);
    expect(SITE_METADATA.description.length).toBeLessThanOrEqual(180);
    expect(SITE_METADATA.description).toContain('semiconductor');
  });

  it('uses root-relative public asset paths', () => {
    expect(SITE_METADATA.faviconPath).toBe('/favicon.svg');
    expect(SITE_METADATA.coverImagePath).toBe('/og-cover.svg');
    expect(SITE_METADATA.manifestPath).toBe('/site.webmanifest');
  });

  it('has enough loading facts for rotation', () => {
    expect(LOADING_FACTS).toHaveLength(6);
    for (const fact of LOADING_FACTS) {
      expect(fact.length).toBeGreaterThan(25);
      expect(fact.length).toBeLessThanOrEqual(120);
    }
  });
});
