import { existsSync } from 'node:fs';
import { copyFile, mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createSound,
  deleteSound as deleteSoundRow,
  getSound,
  getSoundFilePath,
  listSounds,
  soundUsage,
  type ConDeckDb,
} from '@condeck/database';
import {
  AppError,
  SOUND_MAX_BYTES,
  soundBytesMatchFormat,
  soundFormatFromFileName,
  soundMimeTypes,
  type Sound,
  type SoundAudio,
  type SoundPlayMode,
} from '@condeck/shared';
import { dialog } from 'electron';
import type { FileLogger } from '../logger';

export interface SoundService {
  list(): Sound[];
  import(): Promise<Sound[]>;
  remove(soundId: string): Promise<{ id: string }>;
  audio(soundId: string): Promise<SoundAudio>;
  play(soundId: string, mode: SoundPlayMode): Sound;
}

export interface SoundServiceOptions {
  db: ConDeckDb;
  soundsDir: string;
  broadcast: (channel: string, payload: unknown) => void;
  logger: FileLogger;
}

const MAGIC_BYTES = 16;

async function readHeader(filePath: string): Promise<Uint8Array> {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(MAGIC_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, MAGIC_BYTES, 0);
    return new Uint8Array(buffer.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}

/** Files live outside the database so playback and backups stay simple. */
export function createSoundService({
  db,
  soundsDir,
  broadcast,
  logger,
}: SoundServiceOptions): SoundService {
  async function ensureDir(): Promise<void> {
    await mkdir(soundsDir, { recursive: true });
  }

  return {
    list: () => listSounds(db),

    async import() {
      const selection = await dialog.showOpenDialog({
        title: 'Add sounds to the library',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] }],
      });
      if (selection.canceled || selection.filePaths.length === 0) {
        return [];
      }

      await ensureDir();
      const imported: Sound[] = [];

      for (const filePath of selection.filePaths) {
        const fileName = basename(filePath);
        const format = soundFormatFromFileName(fileName);
        if (!format) {
          throw new AppError('INVALID_INPUT', `"${fileName}" is not a supported audio file.`);
        }

        const info = await stat(filePath);
        if (info.size <= 0 || info.size > SOUND_MAX_BYTES) {
          throw new AppError(
            'INVALID_INPUT',
            `"${fileName}" must be between 1 byte and ${Math.round(SOUND_MAX_BYTES / (1024 * 1024))} MB.`,
          );
        }

        const header = await readHeader(filePath);
        if (!soundBytesMatchFormat(header, format)) {
          throw new AppError('INVALID_INPUT', `"${fileName}" does not contain valid ${format.toUpperCase()} audio.`);
        }

        const storedName = `${randomUUID()}.${format}`;
        const destination = join(soundsDir, storedName);
        await copyFile(filePath, destination);

        try {
          const sound = createSound(db, {
            name: fileName.replace(/\.[^.]+$/, '').slice(0, 80) || fileName,
            fileName,
            filePath: destination,
            format,
            mimeType: soundMimeTypes[format],
            fileSize: info.size,
          });
          imported.push(sound);
          logger.info('Sound imported', { soundId: sound.id, format, byteSize: info.size });
        } catch (error) {
          await unlink(destination).catch(() => undefined);
          throw error;
        }
      }

      return imported;
    },

    async remove(soundId) {
      const usage = soundUsage(db, soundId);
      if (usage.count > 0) {
        const buttons = usage.buttonLabels.slice(0, 3).join('", "');
        throw new AppError(
          'CONFLICT',
          `This sound is used by ${usage.count} button${usage.count === 1 ? '' : 's'} ("${buttons}"). Change those buttons first.`,
        );
      }

      const filePath = getSoundFilePath(db, soundId);
      deleteSoundRow(db, soundId);
      if (filePath && existsSync(filePath)) {
        await unlink(filePath).catch((error: unknown) => {
          logger.warn('Sound file could not be removed', {
            soundId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
      return { id: soundId };
    },

    async audio(soundId) {
      const sound = getSound(db, soundId);
      const filePath = getSoundFilePath(db, soundId);
      if (!sound || !filePath || !existsSync(filePath)) {
        throw new AppError('NOT_FOUND', 'The audio file is missing from the sound library.');
      }
      const bytes = await readFile(filePath);
      return {
        soundId,
        dataUrl: `data:${sound.mimeType};base64,${bytes.toString('base64')}`,
      };
    },

    play(soundId, mode) {
      const sound = getSound(db, soundId);
      if (!sound) {
        throw new AppError('NOT_FOUND', 'This button points to a sound that is no longer in the library.');
      }
      const filePath = getSoundFilePath(db, soundId);
      if (!filePath || !existsSync(filePath)) {
        throw new AppError('NOT_FOUND', `The audio file for "${sound.name}" is missing.`);
      }
      // Playback happens in the renderer, which owns the audio output device.
      broadcast('sound:play', { soundId, mode });
      return sound;
    },
  };
}
