import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RemoteErrorCode } from '@condeck/websocket-protocol';

export interface PairingToken {
  token: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  attemptsLeft: number;
}

export type PairingConsumeResult =
  | { ok: true; token: PairingToken }
  | { ok: false; code: Extract<RemoteErrorCode, 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'RATE_LIMITED'> };

export interface PairingManagerOptions {
  ttlMs: number;
  maxAttempts: number;
  now?: () => number;
  createToken?: () => string;
}

export interface PairingManager {
  /** Issues a fresh code; any previous code stops working immediately. */
  issue(): PairingToken;
  /** Current code, or null once it expired or was used. */
  peek(): PairingToken | null;
  /** Single-use verification with a bounded number of attempts. */
  consume(token: string): PairingConsumeResult;
  clear(): void;
}

function defaultToken(): string {
  return randomBytes(32).toString('base64url');
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function tokensMatch(candidate: string, expected: string): boolean {
  const left = digest(candidate);
  const right = digest(expected);
  return timingSafeEqual(left, right);
}

export function createPairingManager({
  ttlMs,
  maxAttempts,
  now = Date.now,
  createToken = defaultToken,
}: PairingManagerOptions): PairingManager {
  let current: PairingToken | null = null;

  function dropIfExpired(): void {
    if (current !== null && now() >= current.expiresAt) {
      current = null;
    }
  }

  return {
    issue() {
      current = {
        token: createToken(),
        expiresAt: now() + ttlMs,
        attemptsLeft: maxAttempts,
      };
      return current;
    },

    peek() {
      dropIfExpired();
      return current;
    },

    consume(token) {
      dropIfExpired();

      if (current === null) {
        return { ok: false, code: 'TOKEN_EXPIRED' };
      }

      if (!tokensMatch(token, current.token)) {
        current = { ...current, attemptsLeft: current.attemptsLeft - 1 };
        if (current.attemptsLeft <= 0) {
          current = null;
          return { ok: false, code: 'RATE_LIMITED' };
        }
        return { ok: false, code: 'INVALID_TOKEN' };
      }

      const used = current;
      current = null;
      return { ok: true, token: used };
    },

    clear() {
      current = null;
    },
  };
}
