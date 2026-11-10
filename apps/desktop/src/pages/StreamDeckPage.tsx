import type { DeckButtonWithAction } from '@condeck/shared';
import { LayoutGrid, Plus } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeckFormDialog, type DeckFormValues } from '../components/deck/DeckFormDialog';
import { ButtonPropertiesPanel } from '../components/stream-deck/ButtonPropertiesPanel';
import { DeckLayoutDialog, type LayoutDraft } from '../components/stream-deck/DeckLayoutDialog';
import { DeviceToolbar } from '../components/stream-deck/DeviceToolbar';
import { StreamDeckFallback } from '../components/stream-deck/StreamDeckFallback';
import type { StreamDeckViewHandle } from '../components/stream-deck/StreamDeckScene';
import { supportsWebGL } from '../components/stream-deck/webgl';

// three.js only loads for the device workspace, keeping the other pages light.
const StreamDeckScene = lazy(() =>
  import('../components/stream-deck/StreamDeckScene').then((module) => ({
    default: module.StreamDeckScene,
  })),
);
import {
  buttonLayout,
  clamp,
  fitScale,
  type RemovedButton,
} from '../components/stream-deck/grid-layout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  loadDevicePreferences,
  loadWorkspaceMode,
  saveDevicePreferences,
  saveWorkspaceMode,
  type DevicePreferences,
  type WorkspaceMode,
} from '../lib/device-preferences';
import { useAppStore } from '../stores/app-store';
import { useDeckStore } from '../stores/deck-store';
import { useNavigationStore } from '../stores/navigation-store';
import { useObsStore } from '../stores/obs-store';

type DialogKind =
  | 'create-deck'
  | 'rename-deck'
  | 'delete-deck'
  | 'add-page'
  | 'rename-page'
  | 'delete-page'
  | 'delete-button'
  | null;

/**
 * Device-first workspace. The 3D deck is the page; navigation lives in the
 * hamburger drawer and configuration only appears after a key is selected.
 */
export function StreamDeckPage() {
  const profiles = useAppStore((state) => state.profiles);
  const setView = useNavigationStore((state) => state.setView);

  const decks = useDeckStore((state) => state.decks);
  const detail = useDeckStore((state) => state.detail);
  const activePageId = useDeckStore((state) => state.activePageId);
  const selectedButtonId = useDeckStore((state) => state.selectedButtonId);
  const status = useDeckStore((state) => state.status);
  const busy = useDeckStore((state) => state.busy);
  const error = useDeckStore((state) => state.error);
  const catalog = useDeckStore((state) => state.catalog);
  const executions = useDeckStore((state) => state.executions);
  const appearanceDraft = useDeckStore((state) => state.appearanceDraft);
  const previewAppearance = useDeckStore((state) => state.previewAppearance);
  const clearAppearanceDrafts = useDeckStore((state) => state.clearAppearanceDrafts);

  const obs = useObsStore((state) => state.snapshot);
  const initializeObs = useObsStore((state) => state.initialize);

  const load = useDeckStore((state) => state.load);
  const selectDeck = useDeckStore((state) => state.selectDeck);
  const selectPage = useDeckStore((state) => state.selectPage);
  const selectButton = useDeckStore((state) => state.selectButton);
  const createDeck = useDeckStore((state) => state.createDeck);
  const updateDeck = useDeckStore((state) => state.updateDeck);
  const deleteDeck = useDeckStore((state) => state.deleteDeck);
  const createPage = useDeckStore((state) => state.createPage);
  const renamePage = useDeckStore((state) => state.renamePage);
  const deletePage = useDeckStore((state) => state.deletePage);
  const createButton = useDeckStore((state) => state.createButton);
  const updateButton = useDeckStore((state) => state.updateButton);
  const removeButton = useDeckStore((state) => state.deleteButton);
  const duplicateButton = useDeckStore((state) => state.duplicateButton);
  const loadCatalog = useDeckStore((state) => state.loadCatalog);
  const saveAction = useDeckStore((state) => state.saveAction);
  const removeAction = useDeckStore((state) => state.removeAction);
  const executeButton = useDeckStore((state) => state.executeButton);
  const navigate = useDeckStore((state) => state.navigate);
  const clearError = useDeckStore((state) => state.clearError);

  const activeProfile = profiles.find((profile) => profile.isActive) ?? null;
  const profileId = activeProfile?.id ?? null;

  const [mode, setMode] = useState<WorkspaceMode>(() => loadWorkspaceMode());
  const [preferences, setPreferences] = useState<DevicePreferences>(() => loadDevicePreferences());
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [slot, setSlot] = useState<{ position: number; buttonId: string | null } | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [webgl] = useState(() => supportsWebGL());
  const viewRef = useRef<StreamDeckViewHandle | null>(null);

  useEffect(() => {
    void load(profileId);
  }, [profileId, load]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // Active key colours follow the real OBS status, not the last click.
  useEffect(() => {
    void initializeObs();
  }, [initializeObs]);

  useEffect(() => {
    saveWorkspaceMode(mode);
    if (mode === 'operate' && slot?.buttonId) {
      // Live mode should not keep a configuration sheet on screen.
      setSlot(null);
      selectButton(null);
    }
    // Only react to mode changes; slot is read for the guard above.
  }, [mode]);

  useEffect(() => {
    saveDevicePreferences(preferences);
  }, [preferences]);

  // NAV_* actions run in the main process and come back as a page request.
  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.condeck : undefined;
    if (!bridge) {
      return;
    }
    return bridge.onNavigationRequest((request) => {
      navigate(request.direction);
    });
  }, [navigate]);

  const pages = detail?.pages ?? [];
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0] ?? null;
  const selectedButton: DeckButtonWithAction | null =
    activePage?.buttons.find((button) => button.id === selectedButtonId) ?? null;
  const panelButton =
    slot === null
      ? null
      : slot.buttonId === null
        ? null
        : (activePage?.buttons.find((button) => button.id === slot.buttonId) ?? selectedButton);

  const columns = detail?.deck.columns ?? 3;
  const rows = detail?.deck.rows ?? 3;
  const layout = useMemo(
    () => buttonLayout(columns, rows, preferences.buttonScale, preferences.gapScale),
    [columns, rows, preferences.buttonScale, preferences.gapScale],
  );
  const scale = fitScale(columns, rows);
  const zoomPercent = Math.round(preferences.zoom * 100);

  const openDialog = useCallback((kind: DialogKind, initialName = '') => {
    setFormError(null);
    setNameDraft(initialName);
    setDialog(kind);
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setFormError(null);
  }, []);

  function handleSelect(position: number, buttonId: string | null): void {
    if (mode === 'operate' && buttonId !== null) {
      return;
    }
    setSlot({ position, buttonId });
    selectButton(buttonId);
  }

  function handleClosePanel(): void {
    setSlot(null);
    selectButton(null);
    clearAppearanceDrafts();
  }

  const handleViewReady = useCallback((view: StreamDeckViewHandle | null) => {
    viewRef.current = view;
  }, []);

  const handleZoomChange = useCallback((zoom: number) => {
    setPreferences((current) =>
      Math.abs(current.zoom - zoom) < 0.01 ? current : { ...current, zoom },
    );
  }, []);

  async function handleCreateButton(position: number): Promise<void> {
    const created = await createButton(position);
    if (created) {
      const newId = useDeckStore.getState().selectedButtonId;
      setSlot({ position, buttonId: newId });
    }
  }

  async function handleDeckSubmit(values: DeckFormValues): Promise<void> {
    const ok = await createDeck(values);
    if (ok) {
      closeDialog();
    }
  }

  async function handleRenameDeck(): Promise<void> {
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0) {
      setFormError('Deck name is required.');
      return;
    }
    const ok = await updateDeck({ name: trimmed });
    if (ok) {
      closeDialog();
    }
  }

  async function handleApplyLayout(draft: LayoutDraft, removed: RemovedButton[]): Promise<void> {
    for (const entry of removed) {
      await removeButton(entry.buttonId);
    }
    const ok = await updateDeck({ columns: draft.columns, rows: draft.rows });
    if (ok) {
      setPreferences((current) => ({
        ...current,
        buttonScale: draft.buttonScale,
        gapScale: draft.gapScale,
      }));
      setLayoutOpen(false);
      handleClosePanel();
    }
  }

  if (!activeProfile) {
    return (
      <div className="deck-stage flex h-full items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-border-subtle bg-surface/80 px-8 py-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <LayoutGrid className="size-5" aria-hidden />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-content">Create a profile first</h1>
          <p className="mt-2 text-xs leading-relaxed text-content-muted">
            A profile holds its own decks, pages and buttons. Create one, then the virtual device
            appears here ready to be configured.
          </p>
          <Button className="mt-5" variant="primary" onClick={() => setView('profiles')}>
            Go to profiles
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="deck-stage relative h-full w-full overflow-hidden">
      {error ? (
        <div
          role="alert"
          className="absolute top-4 left-1/2 z-40 flex max-w-xl -translate-x-1/2 items-start gap-3 rounded-xl border border-danger/40 bg-danger-soft px-3.5 py-2.5 shadow-lg"
        >
          <p className="text-xs leading-relaxed text-danger">{error}</p>
          <button
            type="button"
            onClick={clearError}
            className="shrink-0 text-[11px] font-medium text-danger/80 hover:text-danger"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {detail && activePage ? (
        <>
          <div className="absolute inset-0">
            {webgl ? (
              <Suspense fallback={null}>
                <StreamDeckScene
                columns={columns}
                rows={rows}
                buttons={activePage.buttons}
                layout={layout}
                selectedButtonId={selectedButtonId}
                executions={executions}
                  appearanceDraft={appearanceDraft}
                  obs={obs}
                  operate={mode === 'operate'}
                  scale={scale}
                  zoom={preferences.zoom}
                  onZoomChange={handleZoomChange}
                  onViewReady={handleViewReady}
                  onSelect={handleSelect}
                  onActivate={(buttonId) => void executeButton(buttonId)}
                />
              </Suspense>
            ) : (
              <StreamDeckFallback
                columns={columns}
                rows={rows}
                buttons={activePage.buttons}
                selectedButtonId={selectedButtonId}
                executions={executions}
                obs={obs}
                onSelect={handleSelect}
                onActivate={(buttonId) => void executeButton(buttonId)}
              />
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
            <DeviceToolbar
              decks={decks}
              detail={detail}
              activePageId={activePage.id}
              mode={mode}
              zoomPercent={zoomPercent}
              busy={busy}
              onSelectDeck={(deckId) => {
                handleClosePanel();
                void selectDeck(deckId);
              }}
              onCreateDeck={() => openDialog('create-deck')}
              onEditDeck={() => openDialog('rename-deck', detail.deck.name)}
              onDeleteDeck={() => openDialog('delete-deck')}
              onSelectPage={(pageId) => {
                handleClosePanel();
                selectPage(pageId);
              }}
              onAddPage={() => openDialog('add-page')}
              onRenamePage={() => openDialog('rename-page', activePage.name)}
              onDeletePage={() => openDialog('delete-page')}
              onModeChange={setMode}
              onOpenLayout={() => setLayoutOpen(true)}
              onZoomIn={() => {
                const next = clamp(preferences.zoom + 0.1, 0.55, 1.6);
                viewRef.current?.setZoom(next);
              }}
              onZoomOut={() => {
                const next = clamp(preferences.zoom - 0.1, 0.55, 1.6);
                viewRef.current?.setZoom(next);
              }}
              onResetView={() => viewRef.current?.reset()}
              onFit={() => {
                viewRef.current?.fit();
                setPreferences((current) => ({ ...current, zoom: 1 }));
              }}
            />
          </div>

          <p className="pointer-events-none absolute bottom-4 left-5 z-10 hidden text-[10px] leading-relaxed text-content-subtle lg:block">
            {mode === 'edit' ? 'Edit mode — click a key to configure it' : 'Live mode — press a key to run its action'}
            <br />
            {activePage.buttons.length} of {columns * rows} slots used · page “{activePage.name}”
          </p>
        </>
      ) : status === 'loading' ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-xs text-content-subtle">Loading decks…</p>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center px-6">
          <div className="max-w-md rounded-2xl border border-border-subtle bg-surface/80 px-8 py-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
              <LayoutGrid className="size-5" aria-hidden />
            </span>
            <h1 className="mt-4 text-lg font-semibold text-content">
              {detail ? 'This deck has no pages' : 'Build your first deck'}
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-content-muted">
              {detail
                ? 'Pages split a deck into scenes. Add one to place keys on the device.'
                : `Decks belong to the profile “${activeProfile.name}”. The device appears as soon as one exists.`}
            </p>
            <Button
              className="mt-5"
              variant="primary"
              icon={<Plus className="size-3.5" aria-hidden />}
              onClick={() => openDialog(detail ? 'add-page' : 'create-deck')}
            >
              {detail ? 'Add page' : 'Create deck'}
            </Button>
          </div>
        </div>
      )}

      <ButtonPropertiesPanel
        slot={slot}
        button={panelButton}
        pageButtons={activePage?.buttons ?? []}
        columns={columns}
        rows={rows}
        busy={busy}
        catalog={catalog}
        execution={panelButton ? executions[panelButton.id] : undefined}
        onClose={handleClosePanel}
        onCreate={(position) => void handleCreateButton(position)}
        onSave={(patch) => {
          void updateButton(patch).then((ok) => {
            if (ok && panelButton) {
              previewAppearance(panelButton.id, null);
            }
          });
        }}
        onPreviewAppearance={(appearance) => {
          if (panelButton) {
            previewAppearance(panelButton.id, appearance);
          }
        }}
        onDuplicate={(position) => void duplicateButton(position)}
        onDelete={() => openDialog('delete-button')}
        onSaveAction={(buttonId, actionType, config) => void saveAction({ buttonId, actionType, config })}
        onRemoveAction={(buttonId) => void removeAction(buttonId)}
        onRunAction={(buttonId) => void executeButton(buttonId)}
      />

      <DeckLayoutDialog
        open={layoutOpen}
        detail={detail}
        initial={preferences}
        busy={busy}
        onClose={() => setLayoutOpen(false)}
        onApply={(draft, removed) => void handleApplyLayout(draft, removed)}
      />

      <DeckFormDialog
        open={dialog === 'create-deck'}
        mode="create"
        busy={busy}
        onClose={closeDialog}
        onSubmit={(values) => void handleDeckSubmit(values)}
      />

      <Modal
        open={dialog === 'rename-deck'}
        title="Rename deck"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void handleRenameDeck()}>
              Save name
            </Button>
          </>
        }
      >
        <Input
          label="Deck name"
          value={nameDraft}
          maxLength={60}
          autoFocus
          error={formError ?? undefined}
          onChange={(event) => {
            setNameDraft(event.target.value);
            if (formError) {
              setFormError(null);
            }
          }}
        />
      </Modal>

      <Modal
        open={dialog === 'delete-deck'}
        title="Delete deck"
        description={detail ? `“${detail.deck.name}” and all of its pages, buttons and actions will be removed.` : undefined}
        onClose={closeDialog}
        footer={
          <>
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => {
                void deleteDeck().then((ok) => {
                  if (ok) {
                    closeDialog();
                    handleClosePanel();
                  }
                });
              }}
            >
              Delete deck
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-content-muted">
          This cannot be undone. The deck configuration is deleted from the local database.
        </p>
      </Modal>

      <Modal
        open={dialog === 'add-page' || dialog === 'rename-page'}
        title={dialog === 'rename-page' ? 'Rename page' : 'Add page'}
        description={
          dialog === 'rename-page'
            ? 'Give the page a name you recognise while streaming.'
            : 'Pages split a deck into scenes, for example Main, Audio and Scenes.'
        }
        onClose={closeDialog}
        footer={
          <>
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() => {
                const trimmed = nameDraft.trim();
                if (trimmed.length === 0) {
                  setFormError('Page name is required.');
                  return;
                }
                const action =
                  dialog === 'rename-page' && activePage
                    ? renamePage(activePage.id, trimmed)
                    : createPage(trimmed);
                void action.then((ok) => {
                  if (ok) {
                    closeDialog();
                  }
                });
              }}
            >
              {dialog === 'rename-page' ? 'Save name' : 'Add page'}
            </Button>
          </>
        }
      >
        <Input
          label="Page name"
          placeholder="Audio"
          value={nameDraft}
          maxLength={40}
          autoFocus
          error={formError ?? undefined}
          onChange={(event) => {
            setNameDraft(event.target.value);
            if (formError) {
              setFormError(null);
            }
          }}
        />
      </Modal>

      <Modal
        open={dialog === 'delete-page'}
        title="Delete page"
        description={activePage ? `“${activePage.name}” and its buttons will be removed.` : undefined}
        onClose={closeDialog}
        footer={
          <>
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => {
                if (!activePage) {
                  return;
                }
                void deletePage(activePage.id).then((ok) => {
                  if (ok) {
                    closeDialog();
                    handleClosePanel();
                  }
                });
              }}
            >
              Delete page
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-content-muted">
          The remaining pages keep their order. This cannot be undone.
        </p>
      </Modal>

      <Modal
        open={dialog === 'delete-button'}
        title="Delete button"
        description={panelButton ? `“${panelButton.label}” will be removed from this page.` : undefined}
        onClose={closeDialog}
        footer={
          <>
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => {
                void removeButton().then((ok) => {
                  if (ok) {
                    closeDialog();
                    handleClosePanel();
                  }
                });
              }}
            >
              Delete button
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-content-muted">
          The slot becomes empty again and can hold a different button.
        </p>
      </Modal>
    </div>
  );
}
