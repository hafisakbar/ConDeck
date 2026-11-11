import { z } from 'zod';
import { isoTimestampSchema } from './domain';

/**
 * Soundboard library. Files live in the application's user-data folder and the
 * database keeps only metadata plus the absolute path, so a sound survives
 * restarts and profile switches without being stored as a blob.
 */
export const soundFormats = ['mp3', 'wav', 'ogg', 'm4a', 'flac'] as const;
export const soundFormatSchema = z.enum(soundFormats);
export type SoundFormat = z.infer<typeof soundFormatSchema>;

/** 15 MB keeps playback responsive and well below an IPC payload that freezes the UI. */
export const SOUND_MAX_BYTES = 15 * 1024 * 1024;

export const soundMimeTypes: Record<SoundFormat, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
};

export const soundSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  fileName: z.string().min(1),
  format: soundFormatSchema,
  mimeType: z.string().min(1),
  byteSize: z.number().int().positive(),
  createdAt: isoTimestampSchema,
});
export type Sound = z.infer<typeof soundSchema>;

/** Playback policy when the same sound is triggered again while it runs. */
export const soundPlayModes = ['restart', 'ignore'] as const;
export const soundPlayModeSchema = z.enum(soundPlayModes);
export type SoundPlayMode = z.infer<typeof soundPlayModeSchema>;

export const soundPlayEventSchema = z.object({
  soundId: z.uuid(),
  mode: soundPlayModeSchema,
});
export type SoundPlayEvent = z.infer<typeof soundPlayEventSchema>;

export const deleteSoundInputSchema = z.object({ soundId: z.uuid() });
export type DeleteSoundInput = z.infer<typeof deleteSoundInputSchema>;

export const getSoundAudioInputSchema = z.object({ soundId: z.uuid() });
export type GetSoundAudioInput = z.infer<typeof getSoundAudioInputSchema>;

export interface SoundAudio {
  soundId: string;
  dataUrl: string;
}

/** Lower-case extension of a file name, or null when it is not supported. */
export function soundFormatFromFileName(fileName: string): SoundFormat | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  const extension = match?.[1]?.toLowerCase();
  return extension && (soundFormats as readonly string[]).includes(extension)
    ? (extension as SoundFormat)
    : null;
}

/**
 * Magic-byte check used by the main process. Extensions alone are not trusted:
 * a renamed executable must not reach the audio decoder.
 */
export function soundBytesMatchFormat(bytes: Uint8Array, format: SoundFormat): boolean {
  const ascii = (start: number, end: number): string =>
    String.fromCharCode(...bytes.subarray(start, end));
  const b0 = bytes[0] ?? 0;
  const b1 = bytes[1] ?? 0;

  switch (format) {
    case 'mp3':
      return ascii(0, 3) === 'ID3' || (b0 === 0xff && (b1 & 0xe0) === 0xe0);
    case 'wav':
      return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE';
    case 'ogg':
      return ascii(0, 4) === 'OggS';
    case 'flac':
      return ascii(0, 4) === 'fLaC';
    case 'm4a':
      return ascii(4, 8) === 'ftyp';
    default:
      return false;
  }
}
