import type { ObsStatusPayload, RemoteDeckSnapshot } from '@condeck/websocket-protocol';
import { useEffect, useMemo, useState } from 'react';
import type { ActionFeedback, RemoteConnectionState } from '../lib/remote-client';
import { ConnectionBadge } from './ConnectionBadge';
import { FeedbackToast } from './FeedbackToast';
import { PageTabs } from './PageTabs';
import { RemoteButtonGrid } from './RemoteButtonGrid';

export interface RemoteScreenProps {
  snapshot: RemoteDeckSnapshot | null;
  obs: ObsStatusPayload | null;
  state: RemoteConnectionState;
  feedback: ActionFeedback | null;
  onPress: (buttonId: string) => void;
  onChangePage: (pageId: string) => void;
  onRefresh: () => void;
  onDisconnect: () => void;
  clearFeedback: () => void;
}

function ObsChip({ obs }: { obs: ObsStatusPayload | null }) {
  if (obs === null || !obs.connected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-2 py-1 text-[11px] font-medium text-content-subtle">
        <span aria-hidden className="size-1.5 rounded-full bg-content-subtle" />
        OBS off
      </span>
    );
  }

  const live = obs.streaming;
  const recording = obs.recording;
  const label = live ? 'Live' : recording ? 'Recording' : 'OBS ready';

  return (
    <span
      className={`inline-flex max-w-[9rem] items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium ${
        live ? 'border-danger/50 bg-danger-soft text-danger' : 'border-border-subtle bg-surface text-content-muted'
      }`}
    >
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${live ? 'bg-danger' : 'bg-success'}`} />
      <span className="truncate">
        {label}
        {obs.sceneName ? ` · ${obs.sceneName}` : ''}
      </span>
    </span>
  );
}

export function RemoteScreen({
  snapshot,
  obs,
  state,
  feedback,
  onPress,
  onChangePage,
  onRefresh,
  onDisconnect,
  clearFeedback,
}: RemoteScreenProps) {
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [snapshot?.deckId]);

  const pages = snapshot?.pages ?? [];
  const activePage = pages[Math.min(pageIndex, Math.max(pages.length - 1, 0))] ?? null;

  const buttonLabel = useMemo(() => {
    if (feedback === null || feedback.buttonId === '') {
      return null;
    }
    for (const page of pages) {
      const found = page.buttons.find((button) => button.id === feedback.buttonId);
      if (found) {
        return found.label || 'Button';
      }
    }
    return null;
  }, [feedback, pages]);

  function handlePageChange(index: number): void {
    const page = pages[index];
    if (!page) {
      return;
    }
    setPageIndex(index);
    onChangePage(page.id);
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <header className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-content">
            {snapshot?.name ?? 'ConDeck Remote'}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <ConnectionBadge state={state} />
            <ObsChip obs={obs} />
          </div>
        </div>
        <button
          type="button"
          onClick={onDisconnect}
          className="h-8 shrink-0 rounded-full border border-border-subtle bg-surface px-3 text-[11px] font-medium text-content-muted active:text-content"
        >
          Disconnect
        </button>
      </header>

      {pages.length > 1 ? (
        <div className="mt-3">
          <PageTabs pages={pages} activeIndex={pageIndex} onChange={handlePageChange} />
        </div>
      ) : null}

      <main className="mt-2.5 min-h-0 flex-1">
        {snapshot === null ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-border-subtle p-6 text-center">
            <p className="text-sm font-medium text-content">No deck yet</p>
            <p className="max-w-[16rem] text-xs leading-relaxed text-content-subtle">
              Create a deck in ConDeck Desktop. This screen updates as soon as the deck has pages and
              buttons.
            </p>
            <button
              type="button"
              onClick={onRefresh}
              className="h-9 rounded-control border border-border-subtle bg-surface px-3.5 text-xs font-medium text-content-muted active:text-content"
            >
              Refresh
            </button>
          </div>
        ) : activePage === null || activePage.buttons.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-border-subtle p-6 text-center">
            <p className="text-sm font-medium text-content">This page is empty</p>
            <p className="text-xs text-content-subtle">Add buttons on the desktop to use them here.</p>
          </div>
        ) : (
          <RemoteButtonGrid
            page={activePage}
            columns={snapshot.columns}
            rows={snapshot.rows}
            feedback={feedback}
            onPress={onPress}
          />
        )}
      </main>

      {feedback ? (
        <FeedbackToast feedback={feedback} buttonLabel={buttonLabel} onDismiss={clearFeedback} />
      ) : null}
    </div>
  );
}
