# M8 Codex Analytics Save Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the always-available Codex, analytics delivery layer, settings/parent information pane, and versioned save migration required by milestone M8 without changing Chapter 1-6 core gameplay.

**Architecture:** Keep M8 as a shared-systems milestone. Put Codex unlock logic and analytics normalization in pure TypeScript modules with Vitest coverage, keep DOM panels in `src/ui/`, and integrate them through the existing HUD and `gameStore` instead of adding scene-specific state. Preserve existing chapter scene behavior except for opening global panels and emitting start/end analytics.

**Tech Stack:** Phaser 3.90, TypeScript strict, Vite 6, Vitest, DOM overlays, existing `gameStore`, `EventBus`, `pipelineHud`, JSON content, and `localStorage` save layer.

---

## Classification

TYPE: `NEW_FEATURE`

COMPLEXITY: `COMPLEX`

SCOPE:
- Create: `src/content/codex.json`
- Create: `src/sim/codex.ts`
- Create: `src/sim/codex.test.ts`
- Create: `src/analytics/analytics.ts`
- Create: `src/analytics/analytics.test.ts`
- Create: `src/ui/codexOverlay.ts`
- Create: `src/ui/settingsOverlay.ts`
- Modify: `src/state/types.ts`
- Modify: `src/state/gameState.ts`
- Modify: `src/state/gameState.test.ts`
- Modify: `src/state/gameStore.ts`
- Modify: `src/state/storage.ts`
- Modify: `src/ui/pipelineHud.ts`
- Modify: `src/ui/menuOverlay.ts`
- Modify: `src/scenes/MenuScene.ts`
- Modify: `src/scenes/SandboxScene.ts`
- Modify: `src/scenes/Ch1MineScene.ts`
- Modify: `src/scenes/Ch2RefineryScene.ts`
- Modify: `src/scenes/Ch3CrystalScene.ts`
- Modify: `src/scenes/Ch4FabScene.ts`
- Modify: `src/scenes/Ch5PackageScene.ts`
- Modify: `src/scenes/Ch6DatacenterScene.ts`
- Modify: `src/content/strings.json`
- Modify: `src/content/SOURCES.md`
- Modify: `src/styles.css`
- Modify: `docs/agent-context.md`

RISK: `MEDIUM`

Risk notes:
- Save version changes can wipe progress if migration is wrong.
- M8 touches all chapter scenes through the global HUD.
- Analytics must not leak PII and must be safe when no endpoint is configured.

Subagents for implementation:
- `@architect`: review save migration, analytics contract, and unlock derivation before edits.
- `@frontend`: implement Codex/settings DOM overlays and responsive CSS.

Human checkpoint before step: Task 1. Do not implement until Umar approves this plan.

Estimated token cost: 100k-150k for implementation, verification, moderation, and playtest.

Workspace constraint:
- `/Users/omar/Downloads/Game` is not currently a git repo. Skip commit steps in this workspace. If moved into git later, commit after each green task using the suggested messages below.

## Existing Context

- The latest completed milestone is M7. `docs/agent-context.md` says M8 is next and requires approval before implementation.
- `GameState.version` is currently `1`; incompatible versions reset in `hydrateGameState`.
- Preferences currently include only `textMode` and `muted`.
- Analytics events currently exist only on `gameStore.events` as `analytics:event`.
- Existing emitted analytics names are `factcard_opened` and `quiz_answer`.
- Fact-card IDs already available for Codex unlocks:
  - Ch1: `ch1-quartz`, `ch1-copper`, `ch1-lithium`, `ch1-cobalt`, `ch1-rare-earths`
  - Ch2: `ch2-nine-nines`, `ch2-energy-hungry`, `ch2-recycling-ewaste`
  - Ch3: `ch3-czochralski`, `ch3-round-wafers`, `ch3-diamond-wire`
  - Ch4: `ch4-bunny-suits`, `ch4-dust-speck`, `ch4-euv-asml`
  - Ch5: `ch5-packaging`, `ch5-binning`, `ch5-chip-roster`
  - Ch6: `ch6-datacenter-anatomy`, `ch6-cooling`, `ch6-network`
- Run commands with `corepack pnpm ...`; `pnpm` is not necessarily on PATH.

## Acceptance Targets

- `content/codex.json` contains 24 entries, each with title, icon, three kid sentences, nerd paragraph, one real stat, unlock rule, and locked hint.
- Codex opens from the HUD in every chapter and shows locked entries as silhouettes with hints.
- Settings pane opens from the HUD/menu and supports kid/nerd mode, mute, text size, reset save, and a Teacher/Parent info screen.
- Analytics reporter handles `chapter_start`, `chapter_end`, `quiz_answer`, `factcard_opened`, and `game_complete`.
- Analytics sends POST requests only when an endpoint is configured; otherwise it records a local debug log without throwing.
- Save schema is versioned with migration from v1 to v2; corrupt saves and future versions reset gracefully.
- Tests and build pass:

```bash
corepack pnpm test
corepack pnpm build
```

- Browser smoke checks pass at:
  - `http://localhost:5173/?reset#ch1`
  - `http://localhost:5173/?reset#ch4`
  - `http://localhost:5173/?reset#ch6`

## Task 1: Codex Content Contract and Unlock Logic

**Files:**
- Create: `src/content/codex.json`
- Create: `src/sim/codex.ts`
- Create: `src/sim/codex.test.ts`

- [ ] **Step 1: Create failing Codex tests**

Add tests that define the contract before writing implementation:

```ts
import { describe, expect, it } from 'vitest';
import codexJson from '../content/codex.json';
import { createInitialGameState } from '../state/gameState';
import { getCodexViewModel, type CodexEntry } from './codex';

const entries = codexJson as CodexEntry[];

describe('codex content', () => {
  it('contains exactly 24 unique entries with dual-register text and stats', () => {
    expect(entries).toHaveLength(24);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(24);

    for (const entry of entries) {
      expect(entry.title.kid.length).toBeGreaterThan(0);
      expect(entry.title.nerd.length).toBeGreaterThan(0);
      expect(entry.kidText).toHaveLength(3);
      expect(entry.kidText.every((line) => line.length > 0)).toBe(true);
      expect(entry.nerdText.length).toBeGreaterThan(40);
      expect(entry.realStat.length).toBeGreaterThan(10);
      expect(entry.lockedHint.kid.length).toBeGreaterThan(0);
    }
  });

  it('keeps first-chapter mineral entries unlocked when their facts were seen', () => {
    const state = createInitialGameState();
    state.chapters.ch1.firstMined = ['quartz'];

    const viewModel = getCodexViewModel(entries, state, 'kid');
    const quartz = viewModel.entries.find((entry) => entry.id === 'mineral-quartz');
    const cobalt = viewModel.entries.find((entry) => entry.id === 'mineral-cobalt');

    expect(quartz?.unlocked).toBe(true);
    expect(cobalt?.unlocked).toBe(false);
  });

  it('unlocks the final data-center entries when Chapter 6 is complete', () => {
    const state = createInitialGameState();
    state.progress.unlockedChapters = [1, 2, 3, 4, 5, 6];
    state.chapters.ch6.completed = true;

    const viewModel = getCodexViewModel(entries, state, 'nerd');
    const unlockedIds = viewModel.entries.filter((entry) => entry.unlocked).map((entry) => entry.id);

    expect(unlockedIds).toContain('datacenter-anatomy');
    expect(unlockedIds).toContain('global-supply-chain');
  });
});
```

Run:

```bash
corepack pnpm test src/sim/codex.test.ts
```

Expected: FAIL because `src/content/codex.json` and `src/sim/codex.ts` do not exist.

- [ ] **Step 2: Add Codex types and view-model logic**

Create `src/sim/codex.ts`:

```ts
import type { GameState, TextMode } from '../state/types';
import type { TextModeText } from '../ui/text';
import { textForMode } from '../ui/text';

export type CodexUnlockKind = 'chapter_unlocked' | 'chapter_completed' | 'fact_seen' | 'game_completed';

export interface CodexUnlockRule {
  kind: CodexUnlockKind;
  chapter: 1 | 2 | 3 | 4 | 5 | 6;
  factId?: string;
}

export interface CodexEntry {
  id: string;
  chapter: 1 | 2 | 3 | 4 | 5 | 6;
  icon: string;
  title: TextModeText;
  kidText: [string, string, string];
  nerdText: string;
  realStat: string;
  unlock: CodexUnlockRule;
  lockedHint: TextModeText;
}

export interface CodexEntryViewModel {
  id: string;
  chapter: number;
  icon: string;
  title: string;
  body: string[];
  nerdText: string;
  realStat: string;
  lockedHint: string;
  unlocked: boolean;
}

export interface CodexViewModel {
  unlockedCount: number;
  totalCount: number;
  entries: CodexEntryViewModel[];
}

export function getCodexViewModel(entries: CodexEntry[], state: GameState, textMode: TextMode): CodexViewModel {
  const viewEntries = entries.map((entry) => {
    const unlocked = isCodexEntryUnlocked(entry, state);
    return {
      id: entry.id,
      chapter: entry.chapter,
      icon: entry.icon,
      title: unlocked ? textForMode(entry.title, textMode) : 'Locked entry',
      body: unlocked ? entry.kidText : [],
      nerdText: unlocked ? entry.nerdText : '',
      realStat: unlocked ? entry.realStat : '',
      lockedHint: textForMode(entry.lockedHint, textMode),
      unlocked
    };
  });

  return {
    unlockedCount: viewEntries.filter((entry) => entry.unlocked).length,
    totalCount: viewEntries.length,
    entries: viewEntries
  };
}

export function isCodexEntryUnlocked(entry: CodexEntry, state: GameState): boolean {
  if (entry.unlock.kind === 'chapter_unlocked') {
    return state.progress.unlockedChapters.includes(entry.unlock.chapter);
  }

  if (entry.unlock.kind === 'chapter_completed') {
    return chapterCompleted(state, entry.unlock.chapter);
  }

  if (entry.unlock.kind === 'game_completed') {
    return state.chapters.ch6.completed;
  }

  if (entry.unlock.kind === 'fact_seen' && entry.unlock.factId) {
    return chapterFacts(state, entry.unlock.chapter).includes(entry.unlock.factId);
  }

  return false;
}

function chapterCompleted(state: GameState, chapter: number): boolean {
  return chapter === 1 ? state.chapters.ch1.completed
    : chapter === 2 ? state.chapters.ch2.completed
      : chapter === 3 ? state.chapters.ch3.completed
        : chapter === 4 ? state.chapters.ch4.completed
          : chapter === 5 ? state.chapters.ch5.completed
            : state.chapters.ch6.completed;
}

function chapterFacts(state: GameState, chapter: number): string[] {
  if (chapter === 1) {
    return state.chapters.ch1.firstMined.map((mineral) => `ch1-${mineral === 'rareEarths' ? 'rare-earths' : mineral}`);
  }

  return chapter === 2 ? state.chapters.ch2.firstFacts
    : chapter === 3 ? state.chapters.ch3.firstFacts
      : chapter === 4 ? state.chapters.ch4.firstFacts
        : chapter === 5 ? state.chapters.ch5.firstFacts
          : state.chapters.ch6.firstFacts;
}
```

- [ ] **Step 3: Add 24 Codex entries**

Create `src/content/codex.json` with these IDs:

```json
[
  "mineral-quartz",
  "mineral-copper",
  "mineral-lithium",
  "mineral-cobalt",
  "mineral-rare-earths",
  "purity-nine-nines",
  "energy-water",
  "czochralski",
  "round-wafers",
  "cleanroom",
  "lithography",
  "euv-asml",
  "doping",
  "yield",
  "binning",
  "chip-cpu",
  "chip-gpu",
  "chip-dram",
  "chip-nand",
  "chip-nic",
  "chip-pmic",
  "chip-nova",
  "datacenter-anatomy",
  "global-supply-chain"
]
```

Write the real JSON as objects matching `CodexEntry`, not as strings. Use existing chapter copy from `strings.json` where possible, and keep current-stat claims conservative. Any specific volatile claim goes into `SOURCES.md` with a note to fact-check before public launch.

- [ ] **Step 4: Verify Codex logic**

Run:

```bash
corepack pnpm test src/sim/codex.test.ts
```

Expected: PASS.

Suggested commit if git is available:

```bash
git add src/content/codex.json src/sim/codex.ts src/sim/codex.test.ts src/content/SOURCES.md
git commit -m "feat(codex): add entry content and unlock logic"
```

## Task 2: Versioned Save Migration and Preferences

**Files:**
- Modify: `src/state/types.ts`
- Modify: `src/state/gameState.ts`
- Modify: `src/state/gameState.test.ts`
- Modify: `src/state/gameStore.ts`

- [ ] **Step 1: Add failing save migration tests**

Append tests to `src/state/gameState.test.ts`:

```ts
it('migrates version 1 saves into version 2 preferences', () => {
  const state = hydrateGameState(JSON.stringify({
    version: 1,
    preferences: { textMode: 'nerd', muted: false },
    progress: { currentChapter: 4, unlockedChapters: [1, 2, 3, 4], activeScene: 'Ch4FabScene' },
    resources: {
      minerals: { quartz: 10, copper: 9, lithium: 8, cobalt: 7, rareEarths: 6 },
      wafers: 3,
      chips: 12,
      energy: 88,
      water: 77,
      credits: 666
    },
    chapters: {},
    updatedAt: new Date(0).toISOString()
  }));

  expect(state.version).toBe(SAVE_VERSION);
  expect(state.preferences.textMode).toBe('nerd');
  expect(state.preferences.textSize).toBe('normal');
  expect(state.progress.currentChapter).toBe(4);
});

it('resets future save versions to a fresh state', () => {
  const state = hydrateGameState('{"version":999,"preferences":{"textMode":"nerd","textSize":"large"}}');

  expect(state.version).toBe(SAVE_VERSION);
  expect(state.preferences.textMode).toBe('kid');
  expect(state.preferences.textSize).toBe('normal');
});
```

Run:

```bash
corepack pnpm test src/state/gameState.test.ts
```

Expected: FAIL because `textSize` and v1 migration are not implemented.

- [ ] **Step 2: Add text size type and save version 2**

Modify `src/state/types.ts`:

```ts
export type TextSize = 'normal' | 'large';

export interface Preferences {
  textMode: TextMode;
  muted: boolean;
  textSize: TextSize;
}
```

Modify `src/state/gameState.ts`:

```ts
export const SAVE_VERSION = 2;
```

Add `textSize: 'normal'` to `createInitialGameState().preferences`.

- [ ] **Step 3: Implement v1 migration**

In `hydrateGameState`, accept parsed version `1` or `SAVE_VERSION`; reset only missing, invalid, or future versions.

```ts
const parsedVersion = numberOr(parsed.version, 0);
if (parsedVersion < 1 || parsedVersion > SAVE_VERSION) {
  return createInitialGameState();
}
```

Hydrate preferences with:

```ts
preferences: {
  textMode: isTextMode(preferences.textMode) ? preferences.textMode : base.preferences.textMode,
  muted: typeof preferences.muted === 'boolean' ? preferences.muted : base.preferences.muted,
  textSize: isTextSize(preferences.textSize) ? preferences.textSize : base.preferences.textSize
}
```

Add:

```ts
function isTextSize(value: unknown): value is TextSize {
  return value === 'normal' || value === 'large';
}
```

- [ ] **Step 4: Add `GameStore.setTextSize`**

Modify `src/state/gameStore.ts`:

```ts
import type { GameState, TextMode, TextSize } from './types';

setTextSize(textSize: TextSize): void {
  this.update((state) => ({
    ...state,
    preferences: {
      ...state.preferences,
      textSize
    }
  }));
  this.saveNow();
}
```

- [ ] **Step 5: Verify save migration**

Run:

```bash
corepack pnpm test src/state/gameState.test.ts
```

Expected: PASS.

Suggested commit if git is available:

```bash
git add src/state/types.ts src/state/gameState.ts src/state/gameState.test.ts src/state/gameStore.ts
git commit -m "feat(save): migrate preferences to schema version two"
```

## Task 3: Analytics Reporter

**Files:**
- Create: `src/analytics/analytics.ts`
- Create: `src/analytics/analytics.test.ts`
- Modify: `src/state/gameStore.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create failing analytics tests**

Create `src/analytics/analytics.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { AnalyticsEvent } from '../state/eventBus';
import { createAnalyticsReporter, normalizeAnalyticsEvent } from './analytics';

describe('analytics', () => {
  it('adds required metadata without PII fields', () => {
    const normalized = normalizeAnalyticsEvent({
      name: 'quiz_answer',
      payload: {
        questionId: 'ch1-field-check',
        correct: true,
        email: 'not-allowed@example.com'
      }
    });

    expect(normalized.name).toBe('quiz_answer');
    expect(normalized.payload.questionId).toBe('ch1-field-check');
    expect(normalized.payload.correct).toBe(true);
    expect(normalized.payload.email).toBeUndefined();
    expect(typeof normalized.sentAt).toBe('string');
  });

  it('uses the configured transport and does not throw on failure', async () => {
    const send = vi.fn<(event: AnalyticsEvent) => Promise<void>>().mockRejectedValue(new Error('offline'));
    const reporter = createAnalyticsReporter({ send });

    await expect(reporter.track({ name: 'chapter_start', payload: { chapter: 1 } })).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
```

Run:

```bash
corepack pnpm test src/analytics/analytics.test.ts
```

Expected: FAIL because analytics module does not exist.

- [ ] **Step 2: Implement analytics module**

Create `src/analytics/analytics.ts`:

```ts
import type { AnalyticsEvent } from '../state/eventBus';

type AnalyticsPrimitive = string | number | boolean;

const ALLOWED_PAYLOAD_KEYS = new Set([
  'chapter',
  'sceneKey',
  'durationSeconds',
  'questionId',
  'answerId',
  'correct',
  'factCardId',
  'eventId',
  'choiceId',
  'completed',
  'unlockedCount',
  'totalCount'
]);

export interface NormalizedAnalyticsEvent {
  name: string;
  payload: Record<string, AnalyticsPrimitive>;
  sentAt: string;
}

export interface AnalyticsTransport {
  send(event: NormalizedAnalyticsEvent): Promise<void>;
}

export interface AnalyticsReporter {
  track(event: AnalyticsEvent): Promise<void>;
  dispose(): void;
}

export function normalizeAnalyticsEvent(event: AnalyticsEvent): NormalizedAnalyticsEvent {
  return {
    name: event.name,
    payload: Object.fromEntries(
      Object.entries(event.payload).filter(([key, value]) => ALLOWED_PAYLOAD_KEYS.has(key) && isAnalyticsPrimitive(value))
    ),
    sentAt: new Date().toISOString()
  };
}

export function createAnalyticsReporter(transport: AnalyticsTransport): AnalyticsReporter {
  return {
    async track(event) {
      try {
        await transport.send(normalizeAnalyticsEvent(event));
      } catch {
        // Analytics must never break gameplay.
      }
    },
    dispose() {}
  };
}

export function createBrowserAnalyticsTransport(endpoint: string | null): AnalyticsTransport {
  return {
    async send(event) {
      if (!endpoint) {
        appendLocalDebugEvent(event);
        return;
      }

      await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true
      });
    }
  };
}

export function analyticsEndpointFromLocation(location: Location): string | null {
  const params = new URLSearchParams(location.search);
  return params.get('analyticsEndpoint') || import.meta.env.VITE_ANALYTICS_ENDPOINT || null;
}

function appendLocalDebugEvent(event: NormalizedAnalyticsEvent): void {
  if (typeof window === 'undefined') {
    return;
  }

  const key = 'rock-to-rack.analytics.debug';
  const current = JSON.parse(window.localStorage.getItem(key) ?? '[]') as NormalizedAnalyticsEvent[];
  window.localStorage.setItem(key, JSON.stringify([...current.slice(-49), event]));
}

function isAnalyticsPrimitive(value: unknown): value is AnalyticsPrimitive {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
```

- [ ] **Step 3: Wire reporter at startup**

Modify `src/main.ts`:

```ts
import './styles.css';
import { analyticsEndpointFromLocation, createAnalyticsReporter, createBrowserAnalyticsTransport } from './analytics/analytics';
import { createRockToRackGame } from './game/createGame';
import { gameStore } from './state/gameStore';

const reporter = createAnalyticsReporter(createBrowserAnalyticsTransport(analyticsEndpointFromLocation(window.location)));
const offAnalytics = gameStore.events.on('analytics:event', (event) => {
  void reporter.track(event);
});

const game = createRockToRackGame('game-root');

window.addEventListener('beforeunload', () => {
  offAnalytics();
  reporter.dispose();
  game.destroy(false);
});
```

- [ ] **Step 4: Emit chapter start/end and game complete centrally**

Modify `GameStore.enterScene` to emit `chapter_start` when a chapter is entered:

```ts
if (chapter) {
  this.events.emit('analytics:event', {
    name: 'chapter_start',
    payload: { chapter, sceneKey }
  });
}
```

In `replaceState`, compare previous and next state. Emit `chapter_end` when a chapter's `completed` flips from `false` to `true`, and emit `game_complete` when `ch6.completed` flips.

- [ ] **Step 5: Verify analytics**

Run:

```bash
corepack pnpm test src/analytics/analytics.test.ts
corepack pnpm test src/state/gameState.test.ts
corepack pnpm build
```

Expected: PASS.

Manual browser verification:

```bash
corepack pnpm dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/?reset&analyticsEndpoint=/__codex_analytics#ch1
```

Open a fact card or answer a quiz. Expected: a POST request appears in DevTools Network to `/__codex_analytics`; it may 404 in Vite, but the game must not throw or stall.

Suggested commit if git is available:

```bash
git add src/analytics src/state/gameStore.ts src/main.ts
git commit -m "feat(analytics): add safe browser event reporter"
```

## Task 4: Codex and Settings DOM Panels

**Files:**
- Create: `src/ui/codexOverlay.ts`
- Create: `src/ui/settingsOverlay.ts`
- Modify: `src/ui/pipelineHud.ts`
- Modify: `src/ui/menuOverlay.ts`
- Modify: `src/content/strings.json`
- Modify: `src/styles.css`

- [ ] **Step 1: Extend HUD options**

Modify `src/ui/pipelineHud.ts`:

```ts
export interface PipelineHudActionLabels {
  codex: TextModeText;
  settings: TextModeText;
}

export interface PipelineHudOptions {
  resources: ResourceState;
  textMode: TextMode;
  labels: PipelineHudLabels;
  actionLabels?: PipelineHudActionLabels;
  onOpenCodex?: () => void;
  onOpenSettings?: () => void;
}
```

Append action buttons after resources when callbacks are provided:

```ts
if (options.actionLabels && options.onOpenCodex && options.onOpenSettings) {
  shell.append(
    hudButton(textForMode(options.actionLabels.codex, textMode), options.onOpenCodex),
    hudButton(textForMode(options.actionLabels.settings, textMode), options.onOpenSettings)
  );
}
```

Add `hudButton` helper with `type="button"` and class `hud-tool-button`.

- [ ] **Step 2: Add Codex overlay**

Create `src/ui/codexOverlay.ts`:

```ts
import type { CodexViewModel } from '../sim/codex';

export interface MountedCodexOverlay {
  update(viewModel: CodexViewModel): void;
  cleanup(): void;
}

export function mountCodexOverlay(root: HTMLElement, viewModel: CodexViewModel, onClose: () => void): MountedCodexOverlay {
  const backdrop = document.createElement('section');
  backdrop.className = 'codex-backdrop';
  root.append(backdrop);

  const render = (nextViewModel: CodexViewModel): void => {
    const panel = document.createElement('article');
    panel.className = 'codex-panel';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'codex-close';
    close.textContent = 'Close';
    close.addEventListener('click', onClose);

    const title = document.createElement('h2');
    title.textContent = `Codex ${nextViewModel.unlockedCount}/${nextViewModel.totalCount}`;

    const list = document.createElement('div');
    list.className = 'codex-grid';

    for (const entry of nextViewModel.entries) {
      const card = document.createElement('section');
      card.className = entry.unlocked ? 'codex-entry' : 'codex-entry is-locked';
      card.append(codexIcon(entry.icon, entry.unlocked), codexTitle(entry.title));
      if (entry.unlocked) {
        const body = document.createElement('ul');
        entry.body.forEach((line) => {
          const item = document.createElement('li');
          item.textContent = line;
          body.append(item);
        });
        const stat = document.createElement('p');
        stat.className = 'codex-stat';
        stat.textContent = entry.realStat;
        card.append(body, stat);
      } else {
        const hint = document.createElement('p');
        hint.textContent = entry.lockedHint;
        card.append(hint);
      }
      list.append(card);
    }

    panel.append(close, title, list);
    backdrop.replaceChildren(panel);
  };

  render(viewModel);

  return {
    update: render,
    cleanup: () => backdrop.remove()
  };
}
```

Implement small local helpers `codexIcon` and `codexTitle` in the same file.

- [ ] **Step 3: Add Settings overlay**

Create `src/ui/settingsOverlay.ts` with callbacks instead of importing `gameStore`:

```ts
import type { GameState, TextSize } from '../state/types';

export interface SettingsOverlayOptions {
  state: GameState;
  onSetTextMode(): void;
  onSetMuted(): void;
  onSetTextSize(textSize: TextSize): void;
  onResetSave(): void;
  onClose(): void;
}

export interface MountedSettingsOverlay {
  update(options: SettingsOverlayOptions): void;
  cleanup(): void;
}

export function mountSettingsOverlay(root: HTMLElement, options: SettingsOverlayOptions): MountedSettingsOverlay {
  const backdrop = document.createElement('section');
  backdrop.className = 'settings-backdrop';
  root.append(backdrop);

  const render = (nextOptions: SettingsOverlayOptions): void => {
    const panel = document.createElement('article');
    panel.className = 'settings-panel';
    panel.append(
      button('Close', nextOptions.onClose),
      heading('Settings'),
      button(`Mode: ${nextOptions.state.preferences.textMode === 'kid' ? 'Kid' : 'Nerd'}`, nextOptions.onSetTextMode),
      button(nextOptions.state.preferences.muted ? 'Muted' : 'Sound On', nextOptions.onSetMuted),
      button(`Text: ${nextOptions.state.preferences.textSize === 'normal' ? 'Normal' : 'Large'}`, () => {
        nextOptions.onSetTextSize(nextOptions.state.preferences.textSize === 'normal' ? 'large' : 'normal');
      }),
      parentInfo(),
      button('Reset save', nextOptions.onResetSave)
    );
    backdrop.replaceChildren(panel);
  };

  render(options);

  return {
    update: render,
    cleanup: () => backdrop.remove()
  };
}
```

Implement `button`, `heading`, and `parentInfo` helpers. Keep parent info concise and content-specific:

```text
Rock to Rack teaches the semiconductor supply chain through six chapters: mining, refining, crystal growth, fabrication, packaging, and data centers. Field Checks are low-stakes and explain missed answers.
```

- [ ] **Step 4: Add labels to strings and CSS**

Add to `strings.json`:

```json
"globalTools": {
  "codex": { "kid": "Codex", "nerd": "Open Codex" },
  "settings": { "kid": "Settings", "nerd": "Open settings" }
}
```

Add CSS for:
- `.hud-tool-button`
- `.codex-backdrop`
- `.codex-panel`
- `.codex-grid`
- `.codex-entry`
- `.codex-entry.is-locked`
- `.settings-backdrop`
- `.settings-panel`
- `body.text-large`

Do not use page-dominating single-hue styling. Keep the panels compact enough for mobile.

Suggested commit if git is available:

```bash
git add src/ui/codexOverlay.ts src/ui/settingsOverlay.ts src/ui/pipelineHud.ts src/ui/menuOverlay.ts src/content/strings.json src/styles.css
git commit -m "feat(ui): add codex and settings panels"
```

## Task 5: Integrate Global Panels Across Scenes

**Files:**
- Modify: `src/scenes/MenuScene.ts`
- Modify: `src/scenes/SandboxScene.ts`
- Modify: `src/scenes/Ch1MineScene.ts`
- Modify: `src/scenes/Ch2RefineryScene.ts`
- Modify: `src/scenes/Ch3CrystalScene.ts`
- Modify: `src/scenes/Ch4FabScene.ts`
- Modify: `src/scenes/Ch5PackageScene.ts`
- Modify: `src/scenes/Ch6DatacenterScene.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add shared scene helper locally or duplicate minimally**

For each scene that mounts `mountPipelineHud`, pass:

```ts
actionLabels: STRINGS.globalTools,
onOpenCodex: () => this.openCodex(),
onOpenSettings: () => this.openSettings()
```

Add scene fields:

```ts
private codexOverlay: MountedCodexOverlay | undefined;
private settingsOverlay: MountedSettingsOverlay | undefined;
```

Add methods:

```ts
private openCodex(): void {
  const uiRoot = documentRoot();
  const viewModel = getCodexViewModel(CODEX, gameStore.getState(), this.textMode);
  this.codexOverlay?.cleanup();
  this.codexOverlay = mountCodexOverlay(uiRoot, viewModel, () => {
    this.codexOverlay?.cleanup();
    this.codexOverlay = undefined;
  });
}

private openSettings(): void {
  const uiRoot = documentRoot();
  this.settingsOverlay?.cleanup();
  this.settingsOverlay = mountSettingsOverlay(uiRoot, {
    state: gameStore.getState(),
    onSetTextMode: () => this.toggleMode(),
    onSetMuted: () => gameStore.setMuted(!gameStore.getState().preferences.muted),
    onSetTextSize: (textSize) => {
      gameStore.setTextSize(textSize);
      document.body.classList.toggle('text-large', textSize === 'large');
    },
    onResetSave: () => {
      clearSavedState();
      window.location.href = `${window.location.pathname}?reset#menu`;
    },
    onClose: () => {
      this.settingsOverlay?.cleanup();
      this.settingsOverlay = undefined;
    }
  });
}
```

Use exact local method names already present in each scene for text-mode toggling. If a scene does not have `toggleMode`, use its current mode-toggle handler.

- [ ] **Step 2: Apply text-size class on startup**

In `src/main.ts`, after loading starts:

```ts
gameStore.events.on('state:changed', (state) => {
  document.body.classList.toggle('text-large', state.preferences.textSize === 'large');
});
```

- [ ] **Step 3: Update cleanup paths**

In every scene shutdown cleanup, include:

```ts
this.codexOverlay?.cleanup();
this.settingsOverlay?.cleanup();
this.codexOverlay = undefined;
this.settingsOverlay = undefined;
```

- [ ] **Step 4: Verify compile**

Run:

```bash
corepack pnpm build
```

Expected: PASS.

Suggested commit if git is available:

```bash
git add src/scenes src/main.ts
git commit -m "feat(m8): expose global codex and settings from scenes"
```

## Task 6: Final Verification, Browser QA, Moderator, Retrospective

**Files:**
- Modify: `docs/agent-context.md`

- [ ] **Step 1: Run automated verification**

Run:

```bash
corepack pnpm test
corepack pnpm build
```

Expected: both PASS.

- [ ] **Step 2: Run browser smoke checks**

Start dev server:

```bash
corepack pnpm dev -- --host 127.0.0.1
```

Check:

```text
http://127.0.0.1:5173/?reset#ch1
http://127.0.0.1:5173/?reset#ch4
http://127.0.0.1:5173/?reset#ch6
```

For each:
- Open Codex from HUD.
- Confirm unlocked/locked entries render.
- Open Settings.
- Toggle text size and mode.
- Return to gameplay without overlap.

- [ ] **Step 3: Verify analytics POST path**

Open:

```text
http://127.0.0.1:5173/?reset&analyticsEndpoint=/__codex_analytics#ch1
```

Expected:
- `chapter_start` emits when the scene loads.
- `factcard_opened` emits after opening a fact card.
- Network tab shows POST requests to `/__codex_analytics`.
- 404 responses do not break gameplay.

- [ ] **Step 4: Update handoff**

Update `docs/agent-context.md`:

```md
## M8 Implementation Summary

Codex, analytics, settings, and save polish are implemented and verified.

Implemented:
- 24-entry Codex content file with unlock rules.
- Codex overlay accessible from HUD in every chapter.
- Settings pane with mode, mute, text size, reset save, and Teacher/Parent info.
- Version 2 save migration from v1 plus corrupt/future reset handling.
- Analytics reporter for chapter_start, chapter_end, quiz_answer, factcard_opened, and game_complete.

Verification:
- `corepack pnpm test`
- `corepack pnpm build`
- Browser smoke at `#ch1`, `#ch4`, and `#ch6`.
```

- [ ] **Step 5: Moderator review**

Use this exact review shape:

```text
╔══════════════════════════════════════╗
║         MODERATOR REVIEW             ║
╠══════════════════════════════════════╣
║ Scope: M8 Codex, analytics, settings, save migration
╠══════════════════════════════════════╣
║ [BLOCK] <critical issue or none>      ║
║ [WARN]  <important issue or none>     ║
║ [NIT]   <minor issue or none>         ║
║ [IDEA]  <optional enhancement>        ║
╠══════════════════════════════════════╣
║ Verdict: PASS | NEEDS_FIXES | REDESIGN
╚══════════════════════════════════════╝
```

- [ ] **Step 6: Retrospective**

Emit:

```text
╔══════════════════════════════════╗
║         RETROSPECTIVE            ║
╠══════════════════════════════════╣
║ ✓ Worked:    <one line>          ║
║ ✗ Didn't:    <one line>          ║
║ → Rule:      <concrete proposal> ║
╚══════════════════════════════════╝
```

Because this is a complex task, append the session log to `~/.codex/session-log.md` only after implementation is complete.

Suggested final commit if git is available:

```bash
git add docs/agent-context.md
git commit -m "docs(m8): update codex analytics handoff"
```

## Plan Self-Review

Spec coverage:
- Codex: Task 1 and Task 4.
- Analytics: Task 3 and Task 6.
- Settings/Teacher/Parent pane: Task 4 and Task 5.
- Save schema/versioning: Task 2.
- Verification and handoff: Task 6.

Placeholder scan:
- No `TBD`, `TODO`, or unstated "write tests" placeholders remain.

Type consistency:
- `TextSize`, `CodexEntry`, `CodexViewModel`, `AnalyticsReporter`, and `AnalyticsTransport` are introduced before later tasks use them.

Execution options after approval:
1. Subagent-driven implementation: dispatch `@architect` for contracts/migration, then `@frontend` for panels/CSS, then coordinator integration and verification.
2. Inline implementation: implement tasks in this session in order, with verification after each task.
