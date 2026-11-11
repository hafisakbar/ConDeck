import { useMemo } from 'react';
import { usePreferencesStore, type Locale } from '../stores/preferences-store';
import { en, id as idMessages, type Messages } from './messages';

const catalogues: Record<Locale, Messages> = { en, id: idMessages };

type Primitive = string | number | boolean | null | undefined;
type NestedKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${NestedKey<T[K]>}`;
}[keyof T & string];

export type MessageKey = NestedKey<Messages>;
export type MessageParams = Record<string, Primitive>;

function lookup(messages: Messages, key: string): string | null {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages);
  return typeof value === 'string' ? value : null;
}

export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const template = lookup(catalogues[locale], key) ?? lookup(en, key) ?? key;
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params && params[name] !== undefined ? String(params[name]) : match,
  );
}

export type Translate = (key: MessageKey, params?: MessageParams) => string;

export function useT(): Translate {
  const locale = usePreferencesStore((state) => state.locale);
  return useMemo(() => (key, params) => translate(locale, key, params), [locale]);
}

/** Localised action labels fall back to whatever the catalog sent. */
export function actionLabelKey(type: string): MessageKey {
  return `action.types.${type}.label` as MessageKey;
}
