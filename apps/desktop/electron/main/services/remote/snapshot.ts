import type { DeckDetail, ObsSnapshot } from '@condeck/shared';
import type { ObsStatusPayload, RemoteDeckSnapshot } from '@condeck/websocket-protocol';

/**
 * Mobile only needs what it takes to draw a button (API_WEBSOCKET_CONTRACT.md
 * §7.2). Action configuration — scene names, audio inputs, file paths — stays on
 * the desktop, so a compromised remote cannot read or replay it.
 */
export function toRemoteDeckSnapshot(detail: DeckDetail): RemoteDeckSnapshot {
  return {
    deckId: detail.deck.id,
    name: detail.deck.name,
    columns: detail.deck.columns,
    rows: detail.deck.rows,
    pages: detail.pages.map((page) => ({
      id: page.id,
      name: page.name,
      position: page.position,
      buttons: page.buttons.map((button) => ({
        id: button.id,
        position: button.position,
        label: button.label,
        icon: button.icon,
        backgroundColor: button.backgroundColor,
        textColor: button.textColor,
        isEnabled: button.isEnabled,
        hasAction: button.action !== null,
      })),
    })),
  };
}

/** OBS status as the remote understands it (§10); no credentials, no hosts. */
export function toObsStatusPayload(snapshot: ObsSnapshot | null): ObsStatusPayload {
  if (snapshot === null) {
    return { connected: false, streaming: false, recording: false, sceneName: null };
  }

  return {
    connected: snapshot.state === 'CONNECTED',
    streaming: snapshot.state === 'CONNECTED' && snapshot.isStreaming,
    recording: snapshot.state === 'CONNECTED' && snapshot.isRecording,
    sceneName: snapshot.state === 'CONNECTED' ? snapshot.sceneName : null,
  };
}
