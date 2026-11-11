import { describe, expect, it } from 'vitest';
import {
  buttonIconNames,
  createButtonInputSchema,
  createDeckInputSchema,
  deckButtonSchema,
  duplicateButtonInputSchema,
  gridLimits,
  hexColorSchema,
  updateButtonInputSchema,
} from './deck';

const uuid = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';

describe('grid validation', () => {
  it('defaults to a 3 × 3 grid', () => {
    const parsed = createDeckInputSchema.parse({ profileId: uuid, name: 'Streaming' });
    expect(parsed.columns).toBe(3);
    expect(parsed.rows).toBe(3);
  });

  it('rejects a grid that is too small or too large', () => {
    const base = { profileId: uuid, name: 'Streaming' };
    expect(createDeckInputSchema.safeParse({ ...base, columns: 0, rows: 3 }).success).toBe(false);
    expect(
      createDeckInputSchema.safeParse({
        ...base,
        columns: gridLimits.maxColumns + 1,
        rows: 3,
      }).success,
    ).toBe(false);
    expect(createDeckInputSchema.safeParse({ ...base, columns: 5, rows: 5 }).success).toBe(true);
  });

  it('rejects an empty or over-long deck name', () => {
    expect(createDeckInputSchema.safeParse({ profileId: uuid, name: '   ' }).success).toBe(false);
    expect(
      createDeckInputSchema.safeParse({ profileId: uuid, name: 'a'.repeat(61) }).success,
    ).toBe(false);
  });
});

describe('button validation', () => {
  it('accepts a hex colour and rejects colour names', () => {
    expect(hexColorSchema.safeParse('#1b2030').success).toBe(true);
    expect(hexColorSchema.safeParse('#fff').success).toBe(true);
    expect(hexColorSchema.safeParse('red').success).toBe(false);
  });

  it('applies the default button colours', () => {
    const parsed = createButtonInputSchema.parse({ pageId: uuid, position: 0, label: 'Go live' });
    expect(parsed.backgroundColor).toBe('#1b2030');
    expect(parsed.textColor).toBe('#e8ebf2');
    expect(parsed.isEnabled).toBe(true);
  });

  it('only accepts known icon identifiers', () => {
    const icon = buttonIconNames[0];
    expect(
      createButtonInputSchema.safeParse({ pageId: uuid, position: 0, label: 'Mute', icon }).success,
    ).toBe(true);
    expect(
      createButtonInputSchema.safeParse({
        pageId: uuid,
        position: 0,
        label: 'Mute',
        icon: 'not-an-icon',
      }).success,
    ).toBe(false);
  });

  it('requires at least one field when updating a button', () => {
    expect(updateButtonInputSchema.safeParse({ buttonId: uuid }).success).toBe(false);
    expect(updateButtonInputSchema.safeParse({ buttonId: uuid, position: 4 }).success).toBe(true);
    expect(updateButtonInputSchema.safeParse({ buttonId: uuid, icon: null }).success).toBe(true);
  });

  it('requires a uuid and a position when duplicating', () => {
    expect(duplicateButtonInputSchema.safeParse({ buttonId: uuid, position: 2 }).success).toBe(true);
    expect(duplicateButtonInputSchema.safeParse({ buttonId: 'nope', position: 2 }).success).toBe(
      false,
    );
  });

  it('round-trips a stored button payload', () => {
    const result = deckButtonSchema.safeParse({
      id: uuid,
      pageId: uuid,
      position: 3,
      label: 'Mute',
      icon: null,
      backgroundColor: '#1b2030',
      textColor: '#e8ebf2',
      appearance: null,
      isEnabled: false,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});
