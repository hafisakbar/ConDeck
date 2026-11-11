import { z } from 'zod';
import { isoTimestampSchema } from './domain';

/**
 * Custom icons uploaded by the user. The bytes live in the local database, so
 * they survive restarts and profile switches without depending on a temp folder;
 * a button stores only `custom:<uuid>`.
 */
export const customIconMimeTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const customIconMimeSchema = z.enum(customIconMimeTypes);
export type CustomIconMimeType = z.infer<typeof customIconMimeSchema>;

export const CUSTOM_ICON_MAX_BYTES = 300 * 1024;
/** 300 KB of bytes is at most 400 000 base64 characters. */
export const CUSTOM_ICON_MAX_DATA_URL = 420_000;

export const customIconSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(40),
  mimeType: customIconMimeSchema,
  byteSize: z.number().int().positive(),
  createdAt: isoTimestampSchema,
  /** Ready to use as an <img> source. */
  dataUrl: z.string(),
});
export type CustomIcon = z.infer<typeof customIconSchema>;

export const createCustomIconInputSchema = z.object({
  name: z.string().trim().min(1, 'Icon name is required.').max(40, 'Icon name is too long.'),
  dataUrl: z.string().max(CUSTOM_ICON_MAX_DATA_URL, 'That image is too large.'),
});
export type CreateCustomIconInput = z.infer<typeof createCustomIconInputSchema>;

export const deleteCustomIconInputSchema = z.object({ iconId: z.uuid() });
export type DeleteCustomIconInput = z.infer<typeof deleteCustomIconInputSchema>;

export interface DecodedCustomIcon {
  mimeType: CustomIconMimeType;
  base64: string;
  byteSize: number;
  dataUrl: string;
}

/** Decodes base64 without Node types so the schema stays usable in any process. */
function base64Bytes(base64: string): Uint8Array {
  const decode = (globalThis as { atob?: (input: string) => string }).atob;
  if (!decode) {
    return new Uint8Array();
  }
  const binary = decode(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Validates a data URL by its declared MIME type, its magic bytes and its size.
 * SVG is deliberately rejected: an uploaded vector can carry script and the
 * renderer only needs raster images.
 */
export function decodeCustomIcon(dataUrl: string): DecodedCustomIcon | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) {
    return null;
  }
  const mimeType = match[1] as CustomIconMimeType;
  const base64 = match[2] ?? '';
  const bytes = base64Bytes(base64);
  if (bytes.byteLength === 0 || bytes.byteLength > CUSTOM_ICON_MAX_BYTES) {
    return null;
  }

  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const riff = String.fromCharCode(...bytes.subarray(0, 4));
  const webp = String.fromCharCode(...bytes.subarray(8, 12));
  const isWebp = riff === 'RIFF' && webp === 'WEBP';
  const magicMatches =
    (mimeType === 'image/png' && isPng) ||
    (mimeType === 'image/jpeg' && isJpeg) ||
    (mimeType === 'image/webp' && isWebp);

  if (!magicMatches) {
    return null;
  }

  return { mimeType, base64, byteSize: bytes.byteLength, dataUrl: `data:${mimeType};base64,${base64}` };
}

/** `custom:<uuid>` → `<uuid>`, or null for built-in icon names. */
export function customIconId(icon: string | null | undefined): string | null {
  return typeof icon === 'string' && icon.startsWith('custom:') ? icon.slice('custom:'.length) : null;
}
