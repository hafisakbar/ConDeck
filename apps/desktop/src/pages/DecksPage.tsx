import { LayoutGrid, Settings2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ButtonGrid } from '../components/deck/ButtonGrid';
import { ButtonInspector, type ButtonPatch } from '../components/deck/ButtonInspector';
import { DeckFormDialog, type DeckFormValues } from '../components/deck/DeckFormDialog';
import { DeckList } from '../components/deck/DeckList';
import { PageBar } from '../components/deck/PageBar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Panel, PanelBody, PanelHeader } from '../components/ui/Panel';
import { formatRelativeTime } from '../lib/format';
import { useAppStore } from '../stores/app-store';
import { useDeckStore } from '../stores/deck-store';
import { useNavigationStore } from '../stores/navigation-store';

type DialogKind =
  | 'create-deck'
  | 'edit-deck'
  | 'delete-deck'
  | 'add-page'
  | 'rename-page'
  | 'delete-page'
  | 'delete-button'
  | null;

export function DecksPage() {
  const profiles = useAppStore((state) => state.profiles);
  const setView = useNavigationStore((state) => state.setView);

  const decks = useDeckStore((state) => state.decks);
  const detail = useDeckStore((state) => state.detail);
  const activePageId = useDeckStore((state) => state.activePageId);
  const selectedButtonId = useDeckStore((state) => state.selectedButtonId);
  const status = useDeckStore((state) => state.status);
  const busy = useDeckStore((state) => state.busy);
  const error = useDeckStore((state) => state.error);
  const lastSavedAt = useDeckStore((state) => state.lastSavedAt);
  const catalog = useDeckStore((state) => state.catalog);
  const executions = useDeckStore((state) => state.executions);

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

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pageName, setPageName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void load(profileId);
  }, [profileId, load]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

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
  const selectedButton = activePage?.buttons.find((button) => button.id === selectedButtonId) ?? null;

  function openDialog(kind: DialogKind, initialName = '') {
    setFormError(null);
    setPageName(initialName);
    setDialog(kind);
  }

  function closeDialog() {
    setDialog(null);
    setFormError(null);
  }

  async function handleDeckSubmit(values: DeckFormValues) {
    const ok =
      dialog === 'edit-deck'
        ? await updateDeck({ name: values.name, columns: values.columns, rows: values.rows })
        : await createDeck(values);
    if (ok) {
      closeDialog();
    }
  }

  async function handleButtonSave(patch: ButtonPatch) {
    await updateButton(patch);
  }

  if (!activeProfile) {
    return (
      <Panel>
        <PanelHeader
          title="Deck editor"
          description="Decks belong to a profile, and no profile is active yet."
        />
        <EmptyState
          icon={LayoutGrid}
          title="Create a profile first"
          description="Profiles keep separate decks for streaming, gaming or anything else. Create one, then come back to build its deck."
        >
          <Button variant="primary" onClick={() => setView('profiles')}>
            Go to profiles
          </Button>
        </EmptyState>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-control border border-danger/40 bg-danger-soft px-3 py-2"
        >
          <p className="text-xs leading-relaxed text-danger">{error}</p>
          <Button size="sm" variant="ghost" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[13rem_minmax(0,1fr)_19rem]">
        <Panel className="overflow-hidden">
          <DeckList
            decks={decks}
            activeDeckId={detail?.deck.id ?? null}
            busy={busy || status === 'loading'}
            onSelect={(deckId) => void selectDeck(deckId)}
            onCreate={() => openDialog('create-deck')}
          />
        </Panel>

        <Panel className="min-w-0">
          {!detail ? (
            <>
              <PanelHeader
                title="Deck editor"
                description={`Decks of profile "${activeProfile.name}".`}
              />
              <EmptyState
                icon={LayoutGrid}
                title={status === 'loading' ? 'Loading decks…' : 'No deck yet'}
                description="Create a deck to get a grid of buttons. The default grid is 3 × 3; larger grids are available in deck settings."
              >
                <Button variant="primary" onClick={() => openDialog('create-deck')}>
                  Create deck
                </Button>
              </EmptyState>
            </>
          ) : (
            <>
              <PanelHeader
                title={detail.deck.name}
                description={`${detail.deck.columns} × ${detail.deck.rows} grid · ${detail.deck.columns * detail.deck.rows} slots per page`}
                action={
                  <div className="flex items-center gap-1.5">
                    <Badge tone="accent">Phase 3</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Settings2 className="size-3.5" aria-hidden />}
                      onClick={() => openDialog('edit-deck')}
                    >
                      Deck
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 className="size-3.5" aria-hidden />}
                      onClick={() => openDialog('delete-deck')}
                    >
                      Delete
                    </Button>
                  </div>
                }
              />

              <PageBar
                pages={pages}
                activePageId={activePage?.id ?? null}
                busy={busy}
                onSelect={selectPage}
                onAdd={() => openDialog('add-page')}
                onRename={() => openDialog('rename-page', activePage?.name ?? '')}
                onDelete={() => openDialog('delete-page')}
              />

              <PanelBody className="space-y-3">
                {activePage ? (
                  <>
                    <ButtonGrid
                      columns={detail.deck.columns}
                      rows={detail.deck.rows}
                      buttons={activePage.buttons}
                      selectedButtonId={selectedButtonId}
                      executions={executions}
                      onSelectButton={selectButton}
                      onCreateButton={(position) => void createButton(position)}
                      onRunButton={(buttonId) => void executeButton(buttonId)}
                    />
                    <p className="text-[11px] text-content-subtle">
                      Click an empty slot to add a button. Click a button to edit its label, icon,
                      colours and action. A button with an action shows a play control that runs it.
                    </p>
                  </>
                ) : (
                  <EmptyState
                    icon={LayoutGrid}
                    title="This deck has no pages"
                    description="Every deck needs at least one page before buttons can be placed."
                  >
                    <Button variant="primary" onClick={() => openDialog('add-page')}>
                      Add page
                    </Button>
                  </EmptyState>
                )}
              </PanelBody>

              <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2">
                <p className="text-[11px] text-content-subtle">
                  {activePage
                    ? `${activePage.buttons.length} of ${detail.deck.columns * detail.deck.rows} slots used on "${activePage.name}"`
                    : 'No page selected'}
                </p>
                <p className="text-[11px] text-content-subtle">
                  {lastSavedAt ? `Saved ${formatRelativeTime(lastSavedAt)}` : 'Saved to the local database'}
                </p>
              </div>
            </>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          {selectedButton && detail && activePage ? (
            <ButtonInspector
              button={selectedButton}
              pageButtons={activePage.buttons}
              columns={detail.deck.columns}
              rows={detail.deck.rows}
              busy={busy}
              catalog={catalog}
              execution={executions[selectedButton.id]}
              onClose={() => selectButton(null)}
              onSave={(patch) => void handleButtonSave(patch)}
              onDuplicate={(position) => void duplicateButton(position)}
              onDelete={() => openDialog('delete-button')}
              onSaveAction={(buttonId, actionType, config) =>
                void saveAction({ buttonId, actionType, config })
              }
              onRemoveAction={(buttonId) => void removeAction(buttonId)}
              onRunAction={(buttonId) => void executeButton(buttonId)}
            />
          ) : (
            <>
              <PanelHeader title="Properties" description="Select a button to edit it." />
              <PanelBody>
                <p className="text-xs leading-relaxed text-content-muted">
                  Buttons store a label, an icon, colours, an enabled state and one action. Actions
                  are validated before they are saved and only run through the action registry.
                  Everything is written to SQLite through validated IPC, so the deck survives a
                  restart.
                </p>
              </PanelBody>
            </>
          )}
        </Panel>
      </div>

      <DeckFormDialog
        open={dialog === 'create-deck' || dialog === 'edit-deck'}
        mode={dialog === 'edit-deck' ? 'edit' : 'create'}
        initial={
          dialog === 'edit-deck' && detail
            ? { name: detail.deck.name, columns: detail.deck.columns, rows: detail.deck.rows }
            : undefined
        }
        busy={busy}
        onClose={closeDialog}
        onSubmit={(values) => void handleDeckSubmit(values)}
      />

      <Modal
        open={dialog === 'delete-deck'}
        title="Delete deck"
        description={
          detail
            ? `"${detail.deck.name}" and all of its pages, buttons and actions will be removed.`
            : undefined
        }
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
                const trimmed = pageName.trim();
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
          value={pageName}
          maxLength={40}
          autoFocus
          error={formError ?? undefined}
          onChange={(event) => {
            setPageName(event.target.value);
            if (formError) {
              setFormError(null);
            }
          }}
        />
      </Modal>

      <Modal
        open={dialog === 'delete-page'}
        title="Delete page"
        description={activePage ? `"${activePage.name}" and its buttons will be removed.` : undefined}
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
        description={selectedButton ? `"${selectedButton.label}" will be removed from this page.` : undefined}
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
