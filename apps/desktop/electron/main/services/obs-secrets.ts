import { AppError } from '@condeck/shared';
import { safeStorage } from 'electron';

/**
 * OBS WebSocket passwords are never written to the database as plaintext
 * (TECHNICAL_SPECIFICATION.md §7). The database only stores the reference this
 * module produces, which is the safeStorage ciphertext in base64.
 */
export interface SecretStore {
  isAvailable(): boolean;
  encrypt(value: string): string;
  decrypt(reference: string): string;
}

const SECRET_PREFIX = 'safeStorage:v1:';

/** True when a stored column value is a safeStorage reference. */
export function isSecretReference(value: string | null): value is string {
  return value !== null && value.startsWith(SECRET_PREFIX);
}

export function createSafeStorageSecretStore(): SecretStore {
  const isAvailable = (): boolean => {
    if (!safeStorage.isEncryptionAvailable()) {
      return false;
    }
    // On Linux Electron falls back to a plaintext backend when no keyring is
    // present; that is not an encrypted store, so refuse to save secrets there.
    if (typeof safeStorage.getSelectedStorageBackend === 'function') {
      return safeStorage.getSelectedStorageBackend() !== 'basic_text';
    }
    return true;
  };

  return {
    isAvailable,

    encrypt(value) {
      if (!isAvailable()) {
        throw new AppError(
          'NOT_AVAILABLE',
          'This system has no secure credential store, so the OBS password cannot be saved. Enable the OS keyring, or leave the OBS password empty.',
        );
      }
      return `${SECRET_PREFIX}${safeStorage.encryptString(value).toString('base64')}`;
    },

    decrypt(reference) {
      if (!isSecretReference(reference)) {
        throw new AppError(
          'OBS_CONNECTION_FAILED',
          'The saved OBS password could not be read. Enter it again in Integrations.',
        );
      }
      try {
        return safeStorage.decryptString(Buffer.from(reference.slice(SECRET_PREFIX.length), 'base64'));
      } catch {
        throw new AppError(
          'OBS_CONNECTION_FAILED',
          'The saved OBS password could not be decrypted. Enter it again in Integrations.',
        );
      }
    },
  };
}
