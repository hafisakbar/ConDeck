import { useState, type FormEvent } from 'react';
import { defaultPort } from '../lib/constants';
import type { ConnectionTarget } from '../lib/pairing-link';
import type { StoredDevice } from '../lib/storage';
import type { RemoteConnectionState } from '../lib/remote-client';
import { BrandMark } from './BrandMark';

export interface ConnectionScreenProps {
  target: ConnectionTarget | null;
  pairToken: string | null;
  stored: StoredDevice | null;
  state: RemoteConnectionState;
  error: string | null;
  onConnect: (request: {
    host: string;
    port: number;
    deviceName: string;
    pairToken: string | null;
  }) => void;
  onForget: () => void;
}

function guessDeviceName(): string {
  if (typeof navigator === 'undefined') {
    return 'My phone';
  }
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) {
    return 'iPhone';
  }
  if (/iPad/i.test(ua)) {
    return 'iPad';
  }
  if (/Android/i.test(ua)) {
    return 'Android phone';
  }
  return 'My phone';
}

export function ConnectionScreen({
  target,
  pairToken,
  stored,
  state,
  error,
  onConnect,
  onForget,
}: ConnectionScreenProps) {
  const [host, setHost] = useState(target?.host ?? stored?.host ?? '');
  const [port, setPort] = useState(String(target?.port ?? stored?.port ?? defaultPort));
  const [deviceName, setDeviceName] = useState(stored?.deviceName ?? guessDeviceName());
  const [token, setToken] = useState(pairToken ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  const busy = state === 'connecting' || state === 'reconnecting';
  const canPair = token.trim().length > 0;

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();

    const numericPort = Number(port);
    if (host.trim().length === 0) {
      setFormError('Enter the address shown on the desktop, for example 192.168.1.20.');
      return;
    }
    if (!Number.isInteger(numericPort) || numericPort < 1024 || numericPort > 65535) {
      setFormError('Use the port shown on the desktop (1024–65535).');
      return;
    }
    if (!canPair && stored === null) {
      setFormError('Scan the QR code from StreamKey Desktop → Devices, or paste the pairing code.');
      return;
    }

    setFormError(null);
    onConnect({
      host: host.trim(),
      port: numericPort,
      deviceName: deviceName.trim().length > 0 ? deviceName.trim() : 'My phone',
      pairToken: canPair ? token.trim() : null,
    });
  }

  const message = formError ?? error;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <BrandMark size={44} />
          <div>
            <p className="text-lg font-semibold tracking-tight text-content">StreamKey Remote</p>
            <p className="text-xs text-content-subtle">Your Stream. Your Control.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="host" className="block text-xs font-medium text-content-muted">
              Desktop address
            </label>
            <input
              id="host"
              inputMode="decimal"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="192.168.1.20"
              value={host}
              disabled={stored !== null}
              onChange={(event) => setHost(event.target.value)}
              className="h-12 w-full rounded-control border border-border-strong bg-surface px-3 text-base text-content placeholder:text-content-subtle focus:border-accent focus:outline-none disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="port" className="block text-xs font-medium text-content-muted">
              Port
            </label>
            <input
              id="port"
              inputMode="numeric"
              value={port}
              disabled={stored !== null}
              onChange={(event) => setPort(event.target.value)}
              className="h-12 w-full rounded-control border border-border-strong bg-surface px-3 text-base text-content tabular-nums placeholder:text-content-subtle focus:border-accent focus:outline-none disabled:opacity-60"
            />
          </div>

          {stored === null ? (
            <>
              <div className="space-y-1.5">
                <label htmlFor="token" className="block text-xs font-medium text-content-muted">
                  Pairing code
                </label>
                <input
                  id="token"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Scan the QR code or paste the code"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  className="h-12 w-full rounded-control border border-border-strong bg-surface px-3 font-mono text-sm text-content placeholder:text-content-subtle focus:border-accent focus:outline-none"
                />
                {pairToken ? (
                  <p className="text-xs text-success">Pairing code found in the link. Confirm below.</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="deviceName" className="block text-xs font-medium text-content-muted">
                  Name this phone
                </label>
                <input
                  id="deviceName"
                  value={deviceName}
                  maxLength={60}
                  onChange={(event) => setDeviceName(event.target.value)}
                  className="h-12 w-full rounded-control border border-border-strong bg-surface px-3 text-base text-content focus:border-accent focus:outline-none"
                />
              </div>
            </>
          ) : (
            <p className="rounded-control border border-border-subtle bg-surface px-3 py-2.5 text-xs leading-relaxed text-content-muted">
              This phone is paired with {stored.host}:{stored.port} as “{stored.deviceName}”.
            </p>
          )}

          {message ? (
            <p
              role="alert"
              className="rounded-control border border-danger/40 bg-danger-soft px-3 py-2.5 text-xs leading-relaxed text-danger"
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-control bg-accent text-sm font-semibold text-white transition-colors active:bg-accent-hover disabled:opacity-60"
          >
            {busy ? (
              <>
                <span
                  aria-hidden
                  className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                />
                {state === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
              </>
            ) : stored !== null ? (
              'Reconnect'
            ) : canPair ? (
              'Pair this phone'
            ) : (
              'Connect'
            )}
          </button>

          {stored !== null ? (
            <button
              type="button"
              onClick={onForget}
              className="h-11 w-full rounded-control text-xs font-medium text-content-subtle transition-colors active:text-content-muted"
            >
              Forget this device and pair again
            </button>
          ) : null}
        </form>

        <div className="mt-8 space-y-2 border-t border-border-subtle pt-5">
          <p className="text-xs font-medium text-content-muted">How pairing works</p>
          <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-content-subtle">
            <li>On the desktop, open Devices and create a pairing code.</li>
            <li>Scan the QR code with this phone, or type the address and code.</li>
            <li>The code works once and expires after two minutes.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
