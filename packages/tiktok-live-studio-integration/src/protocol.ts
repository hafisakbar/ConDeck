import { AppError, tiktokDefaults, tiktokStateSchema, type TikTokState } from '@condeck/shared';
import { z } from 'zod';

/** Raw `sync_settings` payload, exactly as LIVE Studio reports it. */
const rawSourceSchema = z
  .object({ label: z.string(), value: z.string() })
  .loose();
const rawSceneSchema = z
  .object({
    name: z.string(),
    sources: z.array(rawSourceSchema).default([]),
    visible_sources: z.array(rawSourceSchema).default([]),
  })
  .loose();

export const rawTikTokSettingsSchema = z
  .object({
    audio_mute: z.boolean().optional(),
    mic_mute: z.boolean().optional(),
    scene: z.string().optional(),
    scene_list: z.array(rawSceneSchema).default([]),
    recording: z.boolean().optional(),
    stream_status: z.number().int().optional(),
  })
  .loose();

export const actionResultSchema = z.object({ code: z.number().int() }).loose();

/** Decodes either a JSON string (the documented form) or a already-parsed object. */
export function decodeJsonPayload(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new AppError('ACTION_FAILED', 'TikTok LIVE Studio returned a malformed JSON payload.');
  }
}

export function normalizeState(payload: unknown): TikTokState {
  const decoded = decodeJsonPayload(payload);
  const parsed = rawTikTokSettingsSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new AppError(
      'ACTION_FAILED',
      'TikTok LIVE Studio returned a state StreamKey could not read. The LIVE Studio version may have changed.',
    );
  }

  const data = parsed.data;
  return tiktokStateSchema.parse({
    sceneName: data.scene ?? null,
    scenes: data.scene_list.map((scene) => ({
      name: scene.name,
      sources: scene.sources.map((source) => ({ label: source.label, value: source.value })),
      visibleSources: scene.visible_sources.map((source) => ({
        label: source.label,
        value: source.value,
      })),
    })),
    micMuted: data.mic_mute ?? false,
    audioMuted: data.audio_mute ?? false,
    recording: data.recording ?? false,
    streamStatus: data.stream_status ?? 0,
  });
}

export interface VersionCompatibility {
  supported: boolean;
  /** `verified` means 1.33.x, `untested` is another 1.x release. */
  level: 'verified' | 'untested' | 'unsupported' | 'unknown';
  version: string | null;
  message: string;
}

/** Reads a Windows file version such as "1.33.2.100". */
export function parseVersion(value: string | null | undefined): {
  major: number;
  minor: number;
  patch: number;
} | null {
  if (!value) {
    return null;
  }
  const match = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(value);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] ?? 0),
  };
}

export function checkVersion(version: string | null | undefined): VersionCompatibility {
  const parsed = parseVersion(version);
  if (!parsed) {
    return {
      supported: true,
      level: 'unknown',
      version: version ?? null,
      message:
        'The LIVE Studio version could not be read. StreamKey will try the documented 1.33 protocol.',
    };
  }

  if (parsed.major !== tiktokDefaults.verifiedMajor || parsed.minor < tiktokDefaults.verifiedMinor - 3) {
    return {
      supported: false,
      level: 'unsupported',
      version: version ?? null,
      message: `TikTok LIVE Studio ${version} is not supported. StreamKey was verified against 1.33.x; update LIVE Studio or StreamKey.`,
    };
  }

  if (parsed.minor === tiktokDefaults.verifiedMinor) {
    return {
      supported: true,
      level: 'verified',
      version: version ?? null,
      message: `TikTok LIVE Studio ${version} is supported.`,
    };
  }

  return {
    supported: true,
    level: 'untested',
    version: version ?? null,
    message: `TikTok LIVE Studio ${version} uses an untested protocol revision. StreamKey will try the 1.33 contract.`,
  };
}
