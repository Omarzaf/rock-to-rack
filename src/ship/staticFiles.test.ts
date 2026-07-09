import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

function readBytes(path: string): Buffer {
  return readFileSync(join(root, path));
}

describe('ship static files', () => {
  it('declares OpenGraph, Twitter, favicon, and manifest tags in index.html', () => {
    const html = read('index.html');

    expect(html).toContain('<meta name="description"');
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('<meta property="og:image" content="/og-cover.svg"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg"');
    expect(html).toContain('<link rel="alternate icon" href="/favicon.ico"');
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest"');
    expect(html).toContain('<title>Rock to Rack</title>');
  });

  it('ships a favicon, cover image, manifest, and 404 fallback', () => {
    expect(read('public/favicon.svg')).toContain('<svg');
    expect(readBytes('public/favicon.ico').length).toBeGreaterThan(100);
    expect(read('public/og-cover.svg')).toContain('Rock to Rack');
    expect(JSON.parse(read('public/site.webmanifest')).name).toBe('Rock to Rack');
    expect(read('public/404.html')).toContain('window.location.replace');
  });

  it('ships transformation and victory audio cues', () => {
    for (const cue of ['ore', 'refine', 'crystal', 'fab', 'package', 'rack', 'victory', 'warning']) {
      const file = readBytes(`public/audio/${cue}.wav`);
      expect(file.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(file.subarray(8, 12).toString('ascii')).toBe('WAVE');
      expect(file.length).toBeGreaterThan(1_000);
    }
  });

  it('declares Vercel fallback routing to the game shell', () => {
    const config = JSON.parse(read('vercel.json'));

    expect(config.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' });
  });

  it('ships a production service worker', () => {
    expect(read('public/sw.js')).toContain('rock-to-rack');
    expect(read('public/sw.js')).toContain("event.request.mode !== 'navigate'");
    expect(read('public/sw.js')).toContain('fetch');
  });

  it('keeps award playtest and submission handoff files linked', () => {
    const readme = read('README.md');
    const playtestScript = read('docs/playtests/2026-07-09-cold-playtest-script.md');
    const notesTemplate = read('docs/playtests/2026-07-09-cold-playtest-notes-template.md');
    const submissionChecklist = read('docs/submission/2026-07-09-award-submission-checklist.md');

    expect(readme).toContain('docs/playtests/2026-07-09-cold-playtest-script.md');
    expect(readme).toContain('docs/playtests/2026-07-09-cold-playtest-notes-template.md');
    expect(readme).toContain('docs/submission/2026-07-09-award-submission-checklist.md');
    expect(playtestScript).toContain('3-5 people');
    expect(notesTemplate).toContain('Do not store');
    expect(submissionChecklist).toContain('must not submit forms');
  });
});
