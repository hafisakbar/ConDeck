import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Device credentials (API_WEBSOCKET_CONTRACT.md §5.3, §6).
 *
 * The mobile device stores the plaintext credential in its own storage. The
 * desktop only keeps a SHA-256 hash, so a database copy never grants access.
 * Credentials are always compared in constant time.
 */
export interface IssuedCredential {
  credential: string;
  hash: string;
}

export function createDeviceCredential(): IssuedCredential {
  const credential = randomBytes(32).toString('base64url');
  return { credential, hash: hashCredential(credential) };
}

export function hashCredential(credential: string): string {
  return createHash('sha256').update(credential, 'utf8').digest('hex');
}

export function verifyCredential(credential: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashCredential(credential), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  if (actual.length !== expected.length || actual.length === 0) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
