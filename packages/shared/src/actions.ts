import { z } from 'zod';
import { isoTimestampSchema } from './domain';
import { AppError, type ErrorCode } from './errors';
import { soundPlayModeSchema } from './sounds';

/**
 * Phase 3 domain — Action Engine.
 * Sources: PRD §5.4 (Action Engine), TECHNICAL_SPECIFICATION.md §6 and
 * DATABASE_DESIGN.md §4.5.
 *
 * Every action type has one strict configuration schema here. The database
 * repository, the IPC layer and the engine all validate against the same
 * schema, so a button can never be saved with a configuration that the engine
 * would not accept.
 */

export const actionTypes = [
  'OBS_SWITCH_SCENE',
  'OBS_START_STREAMING',
  'OBS_STOP_STREAMING',
  'OBS_START_RECORDING',
  'OBS_STOP_RECORDING',
  'OBS_TOGGLE_MUTE',
  'OBS_SET_MUTE',
  'TIKTOK_SWITCH_SCENE',
  'TIKTOK_SET_SOURCE_VISIBILITY',
  'TIKTOK_TOGGLE_SOURCE',
  'TIKTOK_SET_MIC_MUTED',
  'TIKTOK_TOGGLE_MIC',
  'TIKTOK_SET_AUDIO_MUTED',
  'TIKTOK_TOGGLE_AUDIO',
  'TIKTOK_START_RECORDING',
  'TIKTOK_STOP_RECORDING',
  'TIKTOK_GET_STATUS',
  'SYSTEM_OPEN_APP',
  'SYSTEM_OPEN_URL',
  'SOUNDBOARD_PLAY',
  'NAV_NEXT_PAGE',
  'NAV_PREV_PAGE',
] as const;

export const actionTypeSchema = z.enum(actionTypes);
export type ActionType = z.infer<typeof actionTypeSchema>;

export const actionCategories = ['OBS', 'TIKTOK', 'SYSTEM', 'SOUNDBOARD', 'NAVIGATION'] as const;
export const actionCategorySchema = z.enum(actionCategories);
export type ActionCategory = z.infer<typeof actionCategorySchema>;

export const navigationDirections = ['next', 'prev'] as const;
export const navigationDirectionSchema = z.enum(navigationDirections);
export type NavigationDirection = z.infer<typeof navigationDirectionSchema>;

const sceneNameSchema = z
  .string()
  .trim()
  .min(1, 'Scene name is required.')
  .max(120, 'Scene name is too long.');

const audioInputSchema = z
  .string()
  .trim()
  .min(1, 'Audio input name is required.')
  .max(120, 'Audio input name is too long.');

/**
 * Only absolute paths are accepted, and the desktop opens them with
 * `shell.openPath` — never through a shell, so no arguments or pipes can be
 * appended to the path.
 */
const applicationPathSchema = z
  .string()
  .trim()
  .min(1, 'Application path is required.')
  .max(1024, 'Application path is too long.')
  .refine(
    (value) => /^(?:[a-zA-Z]:[\\/]|[\\/])/.test(value),
    'Use an absolute path, for example C:\\Tools\\app.exe.',
  );

const urlSchema = z
  .string()
  .trim()
  .min(1, 'URL is required.')
  .max(2048, 'URL is too long.')
  .pipe(
    z.url({
      protocol: /^https?$/,
      error: 'Use an http:// or https:// URL.',
    }),
  );

/** Actions without options still validate against an empty strict object. */
const noConfigSchema = z.strictObject({});

export const actionConfigSchemas = {
  OBS_SWITCH_SCENE: z.strictObject({ sceneName: sceneNameSchema }),
  OBS_START_STREAMING: noConfigSchema,
  OBS_STOP_STREAMING: noConfigSchema,
  OBS_START_RECORDING: noConfigSchema,
  OBS_STOP_RECORDING: noConfigSchema,
  OBS_TOGGLE_MUTE: z.strictObject({ inputName: audioInputSchema }),
  OBS_SET_MUTE: z.strictObject({ inputName: audioInputSchema, muted: z.boolean() }),
  TIKTOK_SWITCH_SCENE: z.strictObject({ sceneName: sceneNameSchema }),
  TIKTOK_SET_SOURCE_VISIBILITY: z.strictObject({
    sceneName: sceneNameSchema,
    sourceId: z.string().trim().min(1, 'Choose a source.').max(200),
    visible: z.boolean(),
  }),
  TIKTOK_TOGGLE_SOURCE: z.strictObject({
    sceneName: sceneNameSchema,
    sourceId: z.string().trim().min(1, 'Choose a source.').max(200),
  }),
  TIKTOK_SET_MIC_MUTED: z.strictObject({ muted: z.boolean() }),
  TIKTOK_TOGGLE_MIC: noConfigSchema,
  TIKTOK_SET_AUDIO_MUTED: z.strictObject({ muted: z.boolean() }),
  TIKTOK_TOGGLE_AUDIO: noConfigSchema,
  TIKTOK_START_RECORDING: noConfigSchema,
  TIKTOK_STOP_RECORDING: noConfigSchema,
  TIKTOK_GET_STATUS: noConfigSchema,
  SYSTEM_OPEN_APP: z.strictObject({ applicationPath: applicationPathSchema }),
  SYSTEM_OPEN_URL: z.strictObject({ url: urlSchema }),
  SOUNDBOARD_PLAY: z.strictObject({
    soundId: z.uuid('Choose a sound from the sound library.'),
    mode: soundPlayModeSchema.default('restart'),
  }),
  NAV_NEXT_PAGE: noConfigSchema,
  NAV_PREV_PAGE: noConfigSchema,
} satisfies Record<ActionType, z.ZodType>;

export type ActionConfigFieldType = 'text' | 'boolean';

export interface ActionConfigField {
  key: string;
  label: string;
  type: ActionConfigFieldType;
  placeholder?: string;
  help?: string;
}

export type ActionProvider = 'OBS' | 'TIKTOK' | 'NONE';

export interface ActionCatalogEntry {
  type: ActionType;
  category: ActionCategory;
  label: string;
  description: string;
  /** OBS actions need a live OBS WebSocket connection to run. */
  requiresObs: boolean;
  /** Which local application the action talks to. */
  provider: ActionProvider;
  fields: ActionConfigField[];
}

/**
 * Catalog used by the renderer to build the action editor. It describes the
 * form; validation itself always goes through `actionConfigSchemas`.
 */
export const actionCatalog: readonly ActionCatalogEntry[] = [
  {
    type: 'OBS_SWITCH_SCENE',
    category: 'OBS',
    label: 'Switch scene',
    description: 'Switch OBS to an existing scene by name.',
    requiresObs: true,
    provider: 'OBS',
    fields: [
      {
        key: 'sceneName',
        label: 'Scene name',
        type: 'text',
        placeholder: 'Starting soon',
        help: 'Must match the scene name in OBS exactly.',
      },
    ],
  },
  {
    type: 'OBS_START_STREAMING',
    category: 'OBS',
    label: 'Start streaming',
    description: 'Start the OBS stream.',
    requiresObs: true,
    provider: 'OBS',
    fields: [],
  },
  {
    type: 'OBS_STOP_STREAMING',
    category: 'OBS',
    label: 'Stop streaming',
    description: 'Stop the OBS stream.',
    requiresObs: true,
    provider: 'OBS',
    fields: [],
  },
  {
    type: 'OBS_START_RECORDING',
    category: 'OBS',
    label: 'Start recording',
    description: 'Start recording in OBS.',
    requiresObs: true,
    provider: 'OBS',
    fields: [],
  },
  {
    type: 'OBS_STOP_RECORDING',
    category: 'OBS',
    label: 'Stop recording',
    description: 'Stop the OBS recording.',
    requiresObs: true,
    provider: 'OBS',
    fields: [],
  },
  {
    type: 'OBS_TOGGLE_MUTE',
    category: 'OBS',
    label: 'Toggle audio mute',
    description: 'Mute the input if it is unmuted, unmute it if it is muted.',
    requiresObs: true,
    provider: 'OBS',
    fields: [
      {
        key: 'inputName',
        label: 'Audio input',
        type: 'text',
        placeholder: 'Mic/Aux',
        help: 'Audio input name as listed in OBS.',
      },
    ],
  },
  {
    type: 'OBS_SET_MUTE',
    category: 'OBS',
    label: 'Set audio mute',
    description: 'Force an audio input to muted or unmuted.',
    requiresObs: true,
    provider: 'OBS',
    fields: [
      {
        key: 'inputName',
        label: 'Audio input',
        type: 'text',
        placeholder: 'Mic/Aux',
        help: 'Audio input name as listed in OBS.',
      },
      { key: 'muted', label: 'Muted', type: 'boolean' },
    ],
  },
  {
    type: 'SYSTEM_OPEN_APP',
    category: 'SYSTEM',
    label: 'Open application',
    description: 'Launch a local application with its default handler.',
    requiresObs: false,
    provider: 'NONE',
    fields: [
      {
        key: 'applicationPath',
        label: 'Application path',
        type: 'text',
        placeholder: 'C:\\Program Files\\App\\app.exe',
        help: 'Absolute path. The file is opened directly, never through a shell.',
      },
    ],
  },
  {
    type: 'SYSTEM_OPEN_URL',
    category: 'SYSTEM',
    label: 'Open URL',
    description: 'Open an http or https address in the default browser.',
    requiresObs: false,
    provider: 'NONE',
    fields: [
      {
        key: 'url',
        label: 'URL',
        type: 'text',
        placeholder: 'https://example.com',
      },
    ],
  },
  {
    type: 'SOUNDBOARD_PLAY',
    category: 'SOUNDBOARD',
    label: 'Play sound',
    description: 'Play an audio file from the sound library through the default output device.',
    requiresObs: false,
    provider: 'NONE',
    fields: [
      {
        key: 'soundId',
        label: 'Sound',
        type: 'text',
        help: 'Sounds are managed in the Sound Library.',
      },
    ],
  },
  {
    type: 'TIKTOK_SWITCH_SCENE',
    category: 'TIKTOK',
    label: 'Switch scene',
    description: 'Switch TikTok LIVE Studio to an existing scene.',
    requiresObs: false,
    provider: 'TIKTOK',
    fields: [
      {
        key: 'sceneName',
        label: 'Scene',
        type: 'text',
        placeholder: 'Main',
        help: 'Scenes are read from LIVE Studio while it is connected.',
      },
    ],
  },
  {
    type: 'TIKTOK_SET_SOURCE_VISIBILITY',
    category: 'TIKTOK',
    label: 'Show or hide source',
    description: 'Make a scene source visible or hidden.',
    requiresObs: false,
    provider: 'TIKTOK',
    fields: [
      { key: 'sceneName', label: 'Scene', type: 'text', help: 'The scene that owns the source.' },
      { key: 'sourceId', label: 'Source', type: 'text', help: 'Choose a source from that scene.' },
      { key: 'visible', label: 'Visible', type: 'boolean' },
    ],
  },
  {
    type: 'TIKTOK_TOGGLE_SOURCE',
    category: 'TIKTOK',
    label: 'Toggle source',
    description: 'Show the source if it is hidden, hide it if it is visible.',
    requiresObs: false,
    provider: 'TIKTOK',
    fields: [
      { key: 'sceneName', label: 'Scene', type: 'text', help: 'The scene that owns the source.' },
      { key: 'sourceId', label: 'Source', type: 'text', help: 'Choose a source from that scene.' },
    ],
  },
  {
    type: 'TIKTOK_SET_MIC_MUTED',
    category: 'TIKTOK',
    label: 'Set microphone mute',
    description: 'Force the LIVE Studio microphone to muted or unmuted.',
    requiresObs: false,
    provider: 'TIKTOK',
    fields: [{ key: 'muted', label: 'Muted', type: 'boolean' }],
  },
  {
    type: 'TIKTOK_TOGGLE_MIC',
    category: 'TIKTOK',
    label: 'Toggle microphone mute',
    description: 'Mute the microphone if it is live, unmute it if it is muted.',
    requiresObs: false,
    provider: 'TIKTOK',
    fields: [],
  },
  {
    type: 'TIKTOK_SET_AUDIO_MUTED',
    category: 'TIKTOK',
    label: 'Set audio mute',
    description: 'Force the LIVE Studio audio output to muted or unmuted.',
    requiresObs: false,
    provider: 'TIKTOK',
    fields: [{ key: 'muted', label: 'Muted', type: 'boolean' }],
  },
  {
    type: 'TIKTOK_TOGGLE_AUDIO',
    category: 'TIKTOK',
    label: 'Toggle audio mute',
    description: 'Mute the audio output if it is on, unmute it if it is muted.',
    requiresObs: false,
    provider: 'TIKTOK',
    fields: [],
  },
  {
    type: 'TIKTOK_START_RECORDING',
    category: 'TIKTOK',
    label: 'Start recording',
    description: 'Start recording in TikTok LIVE Studio.',
    requiresObs: false,
    provider: 'TIKTOK',
    fields: [],
  },
  {
    type: 'TIKTOK_STOP_RECORDING',
    category: 'TIKTOK',
    label: 'Stop recording',
    description: 'Stop the LIVE Studio recording.',
    requiresObs: false,
    provider: 'TIKTOK',
    fields: [],
  },
  {
    type: 'TIKTOK_GET_STATUS',
    category: 'TIKTOK',
    label: 'Report status',
    description: 'Show the current scene, microphone, recording and connection state.',
    requiresObs: false,
    provider: 'TIKTOK',
    fields: [],
  },
  {
    type: 'NAV_NEXT_PAGE',
    category: 'NAVIGATION',
    label: 'Next page',
    description: 'Move the desktop deck to the next page (wraps around).',
    requiresObs: false,
    provider: 'NONE',
    fields: [],
  },
  {
    type: 'NAV_PREV_PAGE',
    category: 'NAVIGATION',
    label: 'Previous page',
    description: 'Move the desktop deck to the previous page (wraps around).',
    requiresObs: false,
    provider: 'NONE',
    fields: [],
  },
];

export function getActionCatalogEntry(type: ActionType): ActionCatalogEntry {
  const entry = actionCatalog.find((item) => item.type === type);
  if (!entry) {
    throw new AppError('INVALID_INPUT', `Unknown action type: ${type}`);
  }
  return entry;
}

export function actionTypeLabel(type: ActionType): string {
  return getActionCatalogEntry(type).label;
}

/**
 * Validation used by the database repository, the IPC layer and the engine.
 * Returns a readable message instead of throwing so callers can decide how to
 * surface the problem.
 */
export function actionConfigIssue(type: ActionType, config: unknown): string | null {
  const parsed = actionConfigSchemas[type].safeParse(config ?? {});
  if (parsed.success) {
    return null;
  }
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
    .join('; ');
  return `${actionTypeLabel(type)} — ${details}`;
}

export function parseActionConfig(
  type: ActionType,
  config: unknown,
): Record<string, unknown> {
  const issue = actionConfigIssue(type, config);
  if (issue) {
    throw new AppError('INVALID_INPUT', issue);
  }
  return (config ?? {}) as Record<string, unknown>;
}

/** Starting values for the editor, derived from the declared fields. */
export function defaultActionConfig(type: ActionType): Record<string, unknown> {
  if (type === 'SOUNDBOARD_PLAY') {
    return { soundId: '' };
  }
  const config: Record<string, unknown> = {};
  for (const field of getActionCatalogEntry(type).fields) {
    config[field.key] = field.type === 'boolean' ? false : '';
  }
  return config;
}

export const actionRecordSchema = z.object({
  id: z.uuid(),
  buttonId: z.uuid(),
  actionType: actionTypeSchema,
  config: z.record(z.string(), z.unknown()),
  position: z.number().int().min(0),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type ActionRecord = z.infer<typeof actionRecordSchema>;

export const actionExecutionStatuses = ['SUCCESS', 'FAILED'] as const;
export const actionExecutionStatusSchema = z.enum(actionExecutionStatuses);
export type ActionExecutionStatus = z.infer<typeof actionExecutionStatusSchema>;

/**
 * Result of one execution attempt. A failed action is still a completed
 * execution: the UI shows `message` next to the button instead of throwing.
 */
export interface ActionExecutionResult {
  buttonId: string;
  actionType: ActionType;
  status: ActionExecutionStatus;
  /** Stable error code when `status` is FAILED, otherwise `null`. */
  code: ErrorCode | null;
  message: string;
  durationMs: number;
}

/** Sent from the main process to the renderer after a navigation action. */
export const navigationRequestSchema = z.object({
  direction: navigationDirectionSchema,
  buttonId: z.uuid(),
});
export type NavigationRequest = z.infer<typeof navigationRequestSchema>;

export const setActionInputSchema = z.object({
  buttonId: z.uuid(),
  actionType: actionTypeSchema,
  config: z.record(z.string(), z.unknown()).default({}),
});
export type SetActionInput = z.infer<typeof setActionInputSchema>;

export const deleteActionInputSchema = z.object({
  buttonId: z.uuid(),
});
export type DeleteActionInput = z.infer<typeof deleteActionInputSchema>;

/**
 * Execution is always addressed by button id. The renderer (and, from Phase 5,
 * the mobile remote) never sends an action configuration or a command.
 */
export const executeActionInputSchema = z.object({
  buttonId: z.uuid(),
});
export type ExecuteActionInput = z.infer<typeof executeActionInputSchema>;
