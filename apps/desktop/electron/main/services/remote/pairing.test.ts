import { describe, expect, it } from 'vitest';
import { createDeviceCredential, hashCredential, verifyCredential } from './credentials';
import { createPairingManager } from './pairing';

function manager(options: { ttlMs?: number; maxAttempts?: number; clock?: { value: number } } = {}) {
  const clock = options.clock ?? { value: 1_700_000_000_000 };
  return {
    clock,
    pairing: createPairingManager({
      ttlMs: options.ttlMs ?? 60_000,
      maxAttempts: options.maxAttempts ?? 3,
      now: () => clock.value,
    }),
  };
}

describe('pairing tokens', () => {
  it('issues a token that can be used exactly once', () => {
    const { pairing } = manager();
    const issued = pairing.issue();

    expect(issued.token).toHaveLength(43);
    expect(issued.attemptsLeft).toBe(3);

    expect(pairing.consume(issued.token)).toMatchObject({ ok: true });
    expect(pairing.peek()).toBeNull();
    expect(pairing.consume(issued.token)).toEqual({ ok: false, code: 'TOKEN_EXPIRED' });
  });

  it('replaces the previous token when a new one is issued', () => {
    const { pairing } = manager();
    const first = pairing.issue();
    const second = pairing.issue();

    expect(pairing.consume(first.token)).toMatchObject({ ok: false, code: 'INVALID_TOKEN' });
    expect(pairing.consume(second.token)).toMatchObject({ ok: true });
  });

  it('expires after the ttl', () => {
    const { pairing, clock } = manager({ ttlMs: 1_000 });
    const issued = pairing.issue();

    clock.value += 999;
    expect(pairing.peek()).not.toBeNull();

    clock.value += 1;
    expect(pairing.peek()).toBeNull();
    expect(pairing.consume(issued.token)).toEqual({ ok: false, code: 'TOKEN_EXPIRED' });
  });

  it('locks out after the attempt budget is spent', () => {
    const { pairing } = manager({ maxAttempts: 2 });
    pairing.issue();

    expect(pairing.consume('wrong-code-wrong-code-wrong-code')).toEqual({
      ok: false,
      code: 'INVALID_TOKEN',
    });
    expect(pairing.consume('wrong-code-wrong-code-wrong-code')).toEqual({
      ok: false,
      code: 'RATE_LIMITED',
    });
  });

  it('can be cleared explicitly', () => {
    const { pairing } = manager();
    pairing.issue();
    pairing.clear();
    expect(pairing.peek()).toBeNull();
  });
});

describe('device credentials', () => {
  it('stores only a hash and verifies in constant time', () => {
    const { credential, hash } = createDeviceCredential();

    expect(credential).toHaveLength(43);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashCredential(credential));
    expect(verifyCredential(credential, hash)).toBe(true);
    expect(verifyCredential(`${credential}x`, hash)).toBe(false);
    expect(verifyCredential(credential, 'not-a-hash')).toBe(false);
  });

  it('generates a different credential each time', () => {
    const first = createDeviceCredential();
    const second = createDeviceCredential();
    expect(first.credential).not.toBe(second.credential);
    expect(first.hash).not.toBe(second.hash);
  });
});
