import type { ButtonIconName, DeckDetail, DeckSummary, UpdateButtonInput } from '@condeck/shared';
import { create } from 'zustand';
import { getBridge, toErrorMessage, unwrap } from '../lib/desktop-bridge';

type DeckStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ButtonDraft {
  label: string;
  icon: ButtonIconName | null;
  backgroundColor: string;
  textColor: string;
  isEnabled: boolean;
  position: number;
}

interface DeckState {
  profileId: string | null;
  status: DeckStatus;
  decks: DeckSummary[];
  detail: DeckDetail | null;
  activePageId: string | null;
  selectedButtonId: string | null;
  busy: boolean;
  error: string | null;
  lastSavedAt: string | null;

  load: (profileId: string | null) => Promise<void>;
  selectDeck: (deckId: string) => Promise<void>;
  selectPage: (pageId: string) => void;
  selectButton: (buttonId: string | null) => void;
  createDeck: (input: { name: string; columns: number; rows: number }) => Promise<boolean>;
  updateDeck: (input: { name?: string; columns?: number; rows?: number }) => Promise<boolean>;
  deleteDeck: () => Promise<boolean>;
  createPage: (name: string) => Promise<boolean>;
  renamePage: (pageId: string, name: string) => Promise<boolean>;
  deletePage: (pageId: string) => Promise<boolean>;
  createButton: (position: number) => Promise<boolean>;
  updateButton: (patch: Partial<ButtonDraft>) => Promise<boolean>;
  deleteButton: (buttonId?: string) => Promise<boolean>;
  duplicateButton: (position: number) => Promise<boolean>;
  clearError: () => void;
}

function firstPageId(detail: DeckDetail | null): string | null {
  return detail?.pages[0]?.id ?? null;
}

export const useDeckStore = create<DeckState>((set, get) => ({
  profileId: null,
  status: 'idle',
  decks: [],
  detail: null,
  activePageId: null,
  selectedButtonId: null,
  busy: false,
  error: null,
  lastSavedAt: null,

  async load(profileId) {
    if (!profileId) {
      set({
        profileId: null,
        status: 'ready',
        decks: [],
        detail: null,
        activePageId: null,
        selectedButtonId: null,
        error: null,
      });
      return;
    }

    set({ profileId, status: 'loading', error: null });
    try {
      const decks = await unwrap(getBridge().listDecks({ profileId }));
      const current = get().detail;
      const stillExists = current && decks.some((deck) => deck.id === current.deck.id);
      const nextDeckId = stillExists ? current.deck.id : decks[0]?.id;

      set({ decks, status: 'ready' });

      if (nextDeckId) {
        await get().selectDeck(nextDeckId);
      } else {
        set({ detail: null, activePageId: null, selectedButtonId: null });
      }
    } catch (error) {
      set({ status: 'error', error: toErrorMessage(error) });
    }
  },

  async selectDeck(deckId) {
    set({ busy: true, error: null });
    try {
      const detail = await unwrap(getBridge().getDeck({ deckId }));
      const previousPageId = get().activePageId;
      const keepPage = detail.pages.find((page) => page.id === previousPageId);
      const pageId = keepPage?.id ?? firstPageId(detail);
      set({ detail, activePageId: pageId, selectedButtonId: null, status: 'ready' });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ busy: false });
    }
  },

  selectPage(pageId) {
    set({ activePageId: pageId, selectedButtonId: null });
  },

  selectButton(buttonId) {
    set({ selectedButtonId: buttonId });
  },

  async createDeck(input) {
    const profileId = get().profileId;
    if (!profileId) {
      set({ error: 'Create a profile before adding a deck.' });
      return false;
    }

    set({ busy: true, error: null });
    try {
      const detail = await unwrap(getBridge().createDeck({ profileId, ...input }));
      const decks = await unwrap(getBridge().listDecks({ profileId }));
      set({
        decks,
        detail,
        activePageId: firstPageId(detail),
        selectedButtonId: null,
        lastSavedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  async updateDeck(input) {
    const detail = get().detail;
    if (!detail) {
      return false;
    }

    set({ busy: true, error: null });
    try {
      await unwrap(getBridge().updateDeck({ deckId: detail.deck.id, ...input }));
      const refreshed = await unwrap(getBridge().getDeck({ deckId: detail.deck.id }));
      const profileId = get().profileId;
      const decks = profileId ? await unwrap(getBridge().listDecks({ profileId })) : get().decks;
      set((state) => ({
        detail: refreshed,
        decks,
        activePageId: state.activePageId ?? firstPageId(refreshed),
        lastSavedAt: new Date().toISOString(),
      }));
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  async deleteDeck() {
    const detail = get().detail;
    const profileId = get().profileId;
    if (!detail) {
      return false;
    }

    set({ busy: true, error: null });
    try {
      await unwrap(getBridge().deleteDeck({ deckId: detail.deck.id }));
      const decks = profileId ? await unwrap(getBridge().listDecks({ profileId })) : [];
      const nextDeckId = decks[0]?.id;
      set({
        decks,
        detail: null,
        activePageId: null,
        selectedButtonId: null,
        lastSavedAt: new Date().toISOString(),
      });
      if (nextDeckId) {
        await get().selectDeck(nextDeckId);
      }
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  async createPage(name) {
    const detail = get().detail;
    if (!detail) {
      return false;
    }

    set({ busy: true, error: null });
    try {
      const updated = await unwrap(getBridge().createPage({ deckId: detail.deck.id, name }));
      const created = updated.pages.find((page) => !detail.pages.some((old) => old.id === page.id));
      set({
        detail: updated,
        activePageId: created?.id ?? get().activePageId,
        selectedButtonId: null,
        lastSavedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  async renamePage(pageId, name) {
    set({ busy: true, error: null });
    try {
      const page = await unwrap(getBridge().updatePage({ pageId, name }));
      set((state) =>
        state.detail
          ? {
              detail: {
                ...state.detail,
                pages: state.detail.pages.map((entry) =>
                  entry.id === page.id ? { ...entry, name: page.name, updatedAt: page.updatedAt } : entry,
                ),
              },
              lastSavedAt: new Date().toISOString(),
            }
          : {},
      );
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  async deletePage(pageId) {
    set({ busy: true, error: null });
    try {
      const updated = await unwrap(getBridge().deletePage({ pageId }));
      const activePageId = updated.pages[0]?.id ?? null;
      set({
        detail: updated,
        activePageId,
        selectedButtonId: null,
        lastSavedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  async createButton(position) {
    const pageId = get().activePageId;
    if (!pageId) {
      set({ error: 'Add a page before placing buttons.' });
      return false;
    }

    set({ busy: true, error: null });
    try {
      const button = await unwrap(
        getBridge().createButton({ pageId, position, label: `Button ${position + 1}` }),
      );
      set((state) => ({
        detail: state.detail
          ? {
              ...state.detail,
              pages: state.detail.pages.map((page) =>
                page.id === pageId ? { ...page, buttons: [...page.buttons, button] } : page,
              ),
            }
          : null,
        selectedButtonId: button.id,
        lastSavedAt: new Date().toISOString(),
      }));
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  async updateButton(patch) {
    const buttonId = get().selectedButtonId;
    if (!buttonId) {
      return false;
    }

    set({ busy: true, error: null });
    try {
      const input: UpdateButtonInput = { buttonId, ...patch };
      const updated = await unwrap(getBridge().updateButton(input));
      set((state) => ({
        detail: state.detail
          ? {
              ...state.detail,
              pages: state.detail.pages.map((page) => ({
                ...page,
                buttons: page.buttons.map((button) =>
                  button.id === updated.id ? updated : button,
                ),
              })),
            }
          : null,
        lastSavedAt: new Date().toISOString(),
      }));
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  async deleteButton(buttonId) {
    const id = buttonId ?? get().selectedButtonId;
    if (!id) {
      return false;
    }

    set({ busy: true, error: null });
    try {
      await unwrap(getBridge().deleteButton({ buttonId: id }));
      set((state) => ({
        detail: state.detail
          ? {
              ...state.detail,
              pages: state.detail.pages.map((page) => ({
                ...page,
                buttons: page.buttons.filter((button) => button.id !== id),
              })),
            }
          : null,
        selectedButtonId: null,
        lastSavedAt: new Date().toISOString(),
      }));
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  async duplicateButton(position) {
    const buttonId = get().selectedButtonId;
    if (!buttonId) {
      return false;
    }

    set({ busy: true, error: null });
    try {
      const copy = await unwrap(getBridge().duplicateButton({ buttonId, position }));
      set((state) => ({
        detail: state.detail
          ? {
              ...state.detail,
              pages: state.detail.pages.map((page) =>
                page.id === copy.pageId ? { ...page, buttons: [...page.buttons, copy] } : page,
              ),
            }
          : null,
        selectedButtonId: copy.id,
        lastSavedAt: new Date().toISOString(),
      }));
      return true;
    } catch (error) {
      set({ error: toErrorMessage(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  clearError() {
    set({ error: null });
  },
}));
