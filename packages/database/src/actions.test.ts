import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from '@condeck/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type ConDeckDatabase } from './client';
import { deleteButtonAction, getActionTarget, getButtonAction, setButtonAction } from './repositories/actions';
import { createButton, deleteButton, duplicateButton } from './repositories/buttons';
import { createDeck, getDeckDetail } from './repositories/decks';
import { createProfile } from './repositories/profiles';

let workDir: string;
let database: ConDeckDatabase;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'condeck-actions-'));
  database = openDatabase({ filePath: join(workDir, 'condeck.db') });
});

afterEach(() => {
  database.close();
  rmSync(workDir, { recursive: true, force: true });
});

function seedButton() {
  const profile = createProfile(database.db, { name: 'Streaming' });
  const detail = createDeck(database.db, {
    profileId: profile.id,
    name: 'Main deck',
    columns: 3,
    rows: 3,
  });
  const pageId = detail.pages[0]?.id;
  if (!pageId) {
    throw new Error('createDeck must create a default page');
  }
  const button = createButton(database.db, { pageId, position: 0, label: 'Go live' });
  return { deckId: detail.deck.id, pageId, button };
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

describe('button actions', () => {
  it('saves an action and exposes it in the deck detail', () => {
    const { deckId, button } = seedButton();

    const action = setButtonAction(database.db, {
      buttonId: button.id,
      actionType: 'SYSTEM_OPEN_URL',
      config: { url: 'https://example.com/overlay' },
    });

    expect(action.actionType).toBe('SYSTEM_OPEN_URL');
    expect(action.config).toEqual({ url: 'https://example.com/overlay' });

    const detail = getDeckDetail(database.db, deckId);
    expect(detail.pages[0]?.buttons[0]?.action?.config).toEqual({
      url: 'https://example.com/overlay',
    });
  });

  it('rejects a configuration that does not match the action type', () => {
    const { button } = seedButton();

    expectAppError(
      () =>
        setButtonAction(database.db, {
          buttonId: button.id,
          actionType: 'OBS_SWITCH_SCENE',
          config: { sceneName: '' },
        }),
      'INVALID_INPUT',
    );
    expectAppError(
      () =>
        setButtonAction(database.db, {
          buttonId: button.id,
          actionType: 'SYSTEM_OPEN_URL',
          config: { url: 'javascript:alert(1)' },
        }),
      'INVALID_INPUT',
    );
    expect(getButtonAction(database.db, button.id)).toBeNull();
  });

  it('replaces the previous action instead of stacking a second one', () => {
    const { button } = seedButton();

    setButtonAction(database.db, {
      buttonId: button.id,
      actionType: 'NAV_NEXT_PAGE',
      config: {},
    });
    setButtonAction(database.db, {
      buttonId: button.id,
      actionType: 'OBS_SET_MUTE',
      config: { inputName: 'Mic/Aux', muted: true },
    });

    const rows = database.sqlite
      .prepare('SELECT COUNT(*) AS value FROM actions WHERE button_id = ?')
      .get(button.id) as { value: number };
    expect(rows.value).toBe(1);
    expect(getButtonAction(database.db, button.id)?.actionType).toBe('OBS_SET_MUTE');
  });

  it('removes an action and reports NOT_FOUND the second time', () => {
    const { deckId, button } = seedButton();
    setButtonAction(database.db, {
      buttonId: button.id,
      actionType: 'NAV_PREV_PAGE',
      config: {},
    });

    expect(deleteButtonAction(database.db, button.id)).toBe('NAV_PREV_PAGE');
    expect(getDeckDetail(database.db, deckId).pages[0]?.buttons[0]?.action).toBeNull();
    expectAppError(() => deleteButtonAction(database.db, button.id), 'NOT_FOUND');
  });

  it('refuses to configure an action on a missing button', () => {
    expectAppError(
      () =>
        setButtonAction(database.db, {
          buttonId: '9b2f3c1d-7b1e-4d3a-9c2b-1a2b3c4d5e6f',
          actionType: 'NAV_NEXT_PAGE',
          config: {},
        }),
      'NOT_FOUND',
    );
    expectAppError(
      () => getActionTarget(database.db, '9b2f3c1d-7b1e-4d3a-9c2b-1a2b3c4d5e6f'),
      'NOT_FOUND',
    );
  });

  it('keeps the action across a database reopen', () => {
    const { deckId, button } = seedButton();
    setButtonAction(database.db, {
      buttonId: button.id,
      actionType: 'SYSTEM_OPEN_APP',
      config: { applicationPath: 'C:\\Tools\\app.exe' },
    });

    database.close();
    database = openDatabase({ filePath: join(workDir, 'condeck.db') });

    expect(getDeckDetail(database.db, deckId).pages[0]?.buttons[0]?.action?.config).toEqual({
      applicationPath: 'C:\\Tools\\app.exe',
    });
  });

  it('copies the action when a button is duplicated', () => {
    const { deckId, button } = seedButton();
    setButtonAction(database.db, {
      buttonId: button.id,
      actionType: 'OBS_SWITCH_SCENE',
      config: { sceneName: 'Starting soon' },
    });

    const copy = duplicateButton(database.db, { buttonId: button.id, position: 4 });
    expect(copy.action?.actionType).toBe('OBS_SWITCH_SCENE');
    expect(copy.action?.config).toEqual({ sceneName: 'Starting soon' });

    const detail = getDeckDetail(database.db, deckId);
    const buttons = detail.pages[0]?.buttons ?? [];
    expect(buttons).toHaveLength(2);
    expect(buttons.every((entry) => entry.action?.actionType === 'OBS_SWITCH_SCENE')).toBe(true);
  });

  it('deletes the action with its button', () => {
    const { button } = seedButton();
    setButtonAction(database.db, {
      buttonId: button.id,
      actionType: 'NAV_NEXT_PAGE',
      config: {},
    });

    deleteButton(database.db, button.id);

    const rows = database.sqlite
      .prepare('SELECT COUNT(*) AS value FROM actions')
      .get() as { value: number };
    expect(rows.value).toBe(0);
  });
});
