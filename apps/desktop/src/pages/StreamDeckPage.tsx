import type { DeckButtonWithAction } from '@condeck/shared';
import { LayoutGrid } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ButtonPropertiesPanel } from '../components/stream-deck/ButtonPropertiesPanel';
import { DeckLayoutDialog, type LayoutDraft } from '../components/stream-deck/DeckLayoutDialog';
import { DeviceToolbar } from '../components/stream-deck/DeviceToolbar';
import { StreamDeckFallback } from '../components/stream-deck/StreamDeckFallback';
import type { StreamDeckViewHandle } from '../components/stream-deck/StreamDeckScene';
import { supportsWebGL } from '../components/stream-deck/webgl';
import { Button } from '../components/ui/Button';
import { useT } from '../i18n';
import {
  buttonLayout,
  clamp,
  fitScale,
  type RemovedButton,
} from '../components/stream-deck/grid-layout';
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

// three.js only loads for the device workspace, keeping the other pages light.
const StreamDeckScene = lazy(() =>
  import('../components/stream-deck/StreamDeckScene').then((module) => ({
    default: module.StreamDeckScene,
  })),
);

/**
 * Device-first workspace. ConDeck now has exactly one deck and one page, so the
 * page never shows deck/page selectors, create or delete controls; the store
 * provisions the default deck once for a fresh profile.
 */
export function StreamDeckPage() {
  const t = useT();
  const profiles = useAppStore((state) => state.profiles);
  const setView = useNavigationStore((state) => state.setView);

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
  const selectButton = useDeckStore((state) => state.selectButton);
  const createButton = useDeckStore((state) => state.createButton);
  const updateDeck = useDeckStore((state) => state.updateDeck);
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
          <h1 className="mt-4 text-lg font-semibold text-content">{t('dashboard.welcomeTitle')}</h1>
          <p className="mt-2 text-xs leading-relaxed text-content-muted">
            {t('dashboard.welcomeDescription')}
          </p>
          <Button className="mt-5" variant="primary" onClick={() => setView('profiles')}>
            {t('dashboard.manageProfiles')}
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
            {t('common.close')}
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
              detail={detail}
              mode={mode}
              zoomPercent={zoomPercent}
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
            {mode === 'edit' ? t('deck.editHint') : t('deck.liveHint')}
            <br />
            {t('deck.slotsUsed', {
              used: activePage.buttons.length,
              total: columns * rows,
            })}{' '}
            · {t('deck.page', { name: activePage.name })}
          </p>
        </>
      ) : status === 'loading' ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-xs text-content-subtle">{t('common.loading')}</p>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center px-6">
          <div className="max-w-md rounded-2xl border border-border-subtle bg-surface/80 px-8 py-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
              <LayoutGrid className="size-5" aria-hidden />
            </span>
            <h1 className="mt-4 text-lg font-semibold text-content">{t('deck.unconfigured')}</h1>
            <p className="mt-2 text-xs leading-relaxed text-content-muted">{t('deck.editHint')}</p>
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
        onDelete={() => {
          void removeButton().then((ok) => {
            if (ok) {
              handleClosePanel();
            }
          });
        }}
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
    </div>
  );
}
