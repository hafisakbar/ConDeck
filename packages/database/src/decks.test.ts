import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from '@condeck/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type ConDeckDatabase } from './client';
import { createButton, deleteButton, duplicateButton, updateButton } from './repositories/buttons';
import { createDeck, deleteDeck, getDeckDetail, listDecks, updateDeck } from './repositories/decks';
import { createPage, deletePage, updatePage } from './repositories/pages';
import { createProfile, deleteProfile, listProfiles } from './repositories/profiles';

let workDir: string;
let database: ConDeckDatabase;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'condeck-decks-'));
  database = openDatabase({ filePath: join(workDir, 'condeck.db') });
});

afterEach(() => {
  database.close();
  rmSync(workDir, { recursive: true, force: true });
});

function seedDeck(columns = 3, rows = 3) {
  const profile = createProfile(database.db, { name: 'Streaming' });
  const detail = createDeck(database.db, {
    profileId: profile.id,
    name: 'Main deck',
    columns,
    rows,
  });
  const pageId = detail.pages[0]?.id;
  if (!pageId) {
    throw new Error('createDeck must create a default page');
  }
  return { profileId: profile.id, deckId: detail.deck.id, pageId };
}

function expectAppError(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return;
  }
  throw new Error('Expected an AppError to be thrown.');
}

describe('decks', () => {
  it('creates a deck with one default page and empty grid', () => {
    const { profileId, deckId } = seedDeck();
    const detail = getDeckDetail(database.db, deckId);

    expect(detail.deck.profileId).toBe(profileId);
    expect(detail.pages).toHaveLength(1);
    expect(detail.pages[0]?.name).toBe('Main');
    expect(detail.pages[0]?.buttons).toEqual([]);
  });

  it('reports page and button counts in the deck list', () => {
    const { profileId, deckId, pageId } = seedDeck();
    createPage(database.db, { deckId, name: 'Audio' });
    createButton(database.db, { pageId, position: 0, label: 'Go live' });

    const [summary] = listDecks(database.db, profileId);
    expect(summary?.pageCount).toBe(2);
    expect(summary?.buttonCount).toBe(1);
  });

  it('persists a deck and its buttons across a reopen', () => {
    const { deckId, pageId } = seedDeck();
    createButton(database.db, { pageId, position: 1, label: 'Mute', icon: 'mic-off' });

    database.close();
    database = openDatabase({ filePath: join(workDir, 'condeck.db') });

    const detail = getDeckDetail(database.db, deckId);
    expect(detail.pages[0]?.buttons[0]?.label).toBe('Mute');
    expect(detail.pages[0]?.buttons[0]?.icon).toBe('mic-off');
  });

  it('cascades pages and buttons when a deck is deleted', () => {
    const { profileId, deckId, pageId } = seedDeck();
    createButton(database.db, { pageId, position: 0, label: 'Go live' });

    deleteDeck(database.db, deckId);

    expect(listDecks(database.db, profileId)).toEqual([]);
    expect(
      (database.sqlite.prepare('SELECT COUNT(*) AS value FROM buttons').get() as { value: number })
        .value,
    ).toBe(0);
  });

  it('refuses to shrink a grid when a button would fall outside', () => {
    const { deckId, pageId } = seedDeck(5, 5);
    createButton(database.db, { pageId, position: 20, label: 'Far corner' });

    expectAppError(() => updateDeck(database.db, { deckId, columns: 3, rows: 3 }), 'CONFLICT');
    expect(getDeckDetail(database.db, deckId).deck.columns).toBe(5);
  });

  it('allows shrinking once the grid is empty enough', () => {
    const { deckId, pageId } = seedDeck(5, 5);
    const button = createButton(database.db, { pageId, position: 24, label: 'Far corner' });
    deleteButton(database.db, button.id);

    const deck = updateDeck(database.db, { deckId, columns: 3, rows: 3 });
    expect(deck.columns).toBe(3);
    expect(deck.rows).toBe(3);
  });

  it('renames a deck', () => {
    const { deckId } = seedDeck();
    const deck = updateDeck(database.db, { deckId, name: 'Gaming' });

    expect(deck.name).toBe('Gaming');
  });
});

describe('pages', () => {
  it('appends pages in order', () => {
    const { deckId } = seedDeck();
    createPage(database.db, { deckId, name: 'Audio' });
    const detail = createPage(database.db, { deckId, name: 'Scenes' });

    expect(detail.pages.map((page) => [page.name, page.position])).toEqual([
      ['Main', 0],
      ['Audio', 1],
      ['Scenes', 2],
    ]);
  });

  it('renumbers remaining pages after a delete', () => {
    const { deckId, pageId } = seedDeck();
    createPage(database.db, { deckId, name: 'Audio' });
    createPage(database.db, { deckId, name: 'Scenes' });

    const detail = deletePage(database.db, pageId);

    expect(detail.pages.map((page) => [page.name, page.position])).toEqual([
      ['Audio', 0],
      ['Scenes', 1],
    ]);
  });

  it('renames a page', () => {
    const { deckId, pageId } = seedDeck();
    createPage(database.db, { deckId, name: 'Audio' });

    expect(updatePage(database.db, { pageId, name: 'Soundboard' }).name).toBe('Soundboard');
  });
});

describe('buttons', () => {
  it('places a button in a free slot', () => {
    const { pageId } = seedDeck();
    const button = createButton(database.db, {
      pageId,
      position: 4,
      label: 'Go live',
      icon: 'play',
      backgroundColor: '#123a2b',
      textColor: '#e8ebf2',
      isEnabled: true,
    });

    expect(button.position).toBe(4);
    expect(button.icon).toBe('play');
    expect(button.backgroundColor).toBe('#123a2b');
  });

  it('rejects two buttons in the same slot', () => {
    const { pageId } = seedDeck();
    createButton(database.db, { pageId, position: 0, label: 'First' });

    expectAppError(
      () => createButton(database.db, { pageId, position: 0, label: 'Second' }),
      'CONFLICT',
    );
  });

  it('rejects a position outside the grid', () => {
    const { pageId } = seedDeck(3, 3);

    expectAppError(
      () => createButton(database.db, { pageId, position: 9, label: 'Too far' }),
      'INVALID_INPUT',
    );
  });

  it('moves a button to another slot and rejects an occupied target', () => {
    const { pageId } = seedDeck();
    const first = createButton(database.db, { pageId, position: 0, label: 'First' });
    createButton(database.db, { pageId, position: 1, label: 'Second' });

    expect(updateButton(database.db, { buttonId: first.id, position: 2 }).position).toBe(2);
    expectAppError(() => updateButton(database.db, { buttonId: first.id, position: 1 }), 'CONFLICT');
    expectAppError(() => updateButton(database.db, { buttonId: first.id, position: 12 }), 'INVALID_INPUT');
  });

  it('updates appearance without touching the position', () => {
    const { pageId } = seedDeck();
    const button = createButton(database.db, { pageId, position: 3, label: 'Mute' });

    const updated = updateButton(database.db, {
      buttonId: button.id,
      label: 'Mic mute',
      icon: 'mic-off',
      isEnabled: false,
    });

    expect(updated.label).toBe('Mic mute');
    expect(updated.position).toBe(3);
    expect(updated.isEnabled).toBe(false);
  });

  it('duplicates a button into another slot', () => {
    const { pageId } = seedDeck();
    const source = createButton(database.db, {
      pageId,
      position: 0,
      label: 'Go live',
      icon: 'play',
      backgroundColor: '#123a2b',
      textColor: '#e8ebf2',
      isEnabled: true,
    });

    const copy = duplicateButton(database.db, { buttonId: source.id, position: 5 });

    expect(copy.id).not.toBe(source.id);
    expect(copy.position).toBe(5);
    expect(copy.label).toBe(source.label);
    expect(copy.backgroundColor).toBe(source.backgroundColor);
    expect(() =>
      duplicateButton(database.db, { buttonId: source.id, position: 5 }),
    ).toThrowError(AppError);
  });
});

describe('button appearance', () => {
  it('persists per-state colours and returns them with the deck detail', () => {
    const { pageId, deckId } = seedDeck(5, 3);
    const appearance = {
      normal: {
        backgroundColor: '#123a2b',
        textColor: '#e8ebf2',
        borderColor: '#2a2f3a',
        glowColor: '#123a2b',
        glowIntensity: 0.25,
      },
      hover: {
        backgroundColor: '#123a2b',
        textColor: '#e8ebf2',
        borderColor: '#3a6a52',
        glowColor: '#34c17b',
        glowIntensity: 0.5,
      },
      active: {
        backgroundColor: '#0d2a1f',
        textColor: '#ffffff',
        borderColor: '#34c17b',
        glowColor: '#34c17b',
        glowIntensity: 0.85,
      },
      pressed: {
        backgroundColor: '#081a13',
        textColor: '#ffffff',
        borderColor: '#7bf0b4',
        glowColor: '#7bf0b4',
        glowIntensity: 1,
      },
    };

    const created = createButton(database.db, {
      pageId,
      position: 0,
      label: 'Record',
      backgroundColor: '#123a2b',
      textColor: '#e8ebf2',
      appearance,
    });
    expect(created.appearance).toEqual(appearance);

    const detail = getDeckDetail(database.db, deckId);
    expect(detail.pages[0]?.buttons[0]?.appearance).toEqual(appearance);

    const copy = duplicateButton(database.db, { buttonId: created.id, position: 1 });
    expect(copy.appearance).toEqual(appearance);

    const cleared = updateButton(database.db, { buttonId: created.id, appearance: null });
    expect(cleared.appearance).toBeNull();
  });

  it('rejects an appearance that is not a complete four-state palette', () => {
    const { pageId } = seedDeck();
    expect(() =>
      createButton(database.db, {
        pageId,
        position: 0,
        label: 'Broken',
        appearance: { normal: {} } as never,
      }),
    ).toThrowError(AppError);
  });
});

describe('profile deletion', () => {
  it('hands the active flag to the remaining profile and removes its decks', () => {
    const first = createProfile(database.db, { name: 'Streaming' });
    createDeck(database.db, { profileId: first.id, name: 'Main deck', columns: 3, rows: 3 });
    const second = createProfile(database.db, { name: 'Gaming' });

    expectAppError(() => deleteProfile(database.db, '9b2f3c1d-7b1e-4d3a-9c2b-1a2b3c4d5e6f'), 'NOT_FOUND');

    deleteProfile(database.db, first.id);

    const remaining = listProfiles(database.db);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(second.id);
    expect(remaining[0]?.isActive).toBe(true);
    expect(listDecks(database.db, first.id)).toEqual([]);
  });
});
