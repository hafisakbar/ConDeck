import { describe, expect, it } from 'vitest';
import { actionCategories, actionTypes } from '@condeck/shared';
import { translate, type MessageKey } from './index';
import { en, id } from './messages';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : flatten(value, path);
  });
}

const enKeys = flatten(en as unknown as Tree).sort();
const idKeys = flatten(id as unknown as Tree).sort();

describe('translation catalogue', () => {
  it('defines exactly the same keys in both languages', () => {
    expect(idKeys).toEqual(enKeys);
  });

  it('resolves every key without falling back to the key itself', () => {
    for (const key of enKeys) {
      expect(translate('en', key as MessageKey)).not.toBe(key);
      expect(translate('id', key as MessageKey)).not.toBe(key);
    }
  });

  it('keeps the placeholders of each key identical across languages', () => {
    const placeholders = (value: string): string[] =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();
    for (const key of enKeys) {
      expect(placeholders(translate('id', key as MessageKey))).toEqual(
        placeholders(translate('en', key as MessageKey)),
      );
    }
  });

  it('has copy for every action type and category', () => {
    for (const type of actionTypes) {
      expect(translate('en', `action.types.${type}.label` as MessageKey)).not.toContain('action.types');
      expect(translate('id', `action.types.${type}.label` as MessageKey)).not.toContain('action.types');
    }
    for (const category of actionCategories) {
      expect(translate('id', `action.categories.${category}` as MessageKey)).not.toContain('action.categories');
    }
  });
});
