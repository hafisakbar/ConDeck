import { ConnectionScreen } from './components/ConnectionScreen';
import { RemoteScreen } from './components/RemoteScreen';
import { useRemote } from './hooks/useRemote';

export function App() {
  const {
    state,
    error,
    snapshot,
    obs,
    tiktok,
    feedback,
    stored,
    pairToken,
    target,
    connect,
    press,
    changePage,
    requestDeck,
    disconnect,
    forget,
    clearFeedback,
  } = useRemote();

  if (state === 'connected') {
    return (
      <RemoteScreen
        snapshot={snapshot}
        obs={obs}
        tiktok={tiktok}
        state={state}
        feedback={feedback}
        onPress={press}
        onChangePage={changePage}
        onRefresh={requestDeck}
        onDisconnect={disconnect}
        clearFeedback={clearFeedback}
      />
    );
  }

  return (
    <ConnectionScreen
      target={target}
      pairToken={pairToken}
      stored={stored}
      state={state}
      error={error}
      onConnect={connect}
      onForget={forget}
    />
  );
}
