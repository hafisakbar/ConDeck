import { z } from 'zod';
import { actionRecordSchema } from './actions';
import { isoTimestampSchema } from './domain';

/**
 * Phase 2 domain — Deck Builder.
 * Sources: PRD §5.2 (Virtual Deck Editor), §5.3 (Button Customization),
 * §5.8 (Page Management), DATABASE_DESIGN.md §4.2–4.4 and §7–8.
 */

/** Safe bounds for a custom grid (PRD §5.2 allows custom columns/rows). */
export const gridLimits = {
  minColumns: 1,
  maxColumns: 8,
  minRows: 1,
  maxRows: 8,
} as const;

export interface GridPreset {
  id: string;
  label: string;
  columns: number;
  rows: number;
}

/** Default grid plus the presets required by PRD §5.2. */
export const defaultGrid = { columns: 3, rows: 3 } as const;

export const gridPresets: readonly GridPreset[] = [
  { id: '3x3', label: '3 × 3 (default)', columns: 3, rows: 3 },
  { id: '4x4', label: '4 × 4', columns: 4, rows: 4 },
  { id: '5x3', label: '5 × 3', columns: 5, rows: 3 },
  { id: '5x5', label: '5 × 5', columns: 5, rows: 5 },
];

const columnsSchema = z
  .number()
  .int()
  .min(gridLimits.minColumns, `At least ${gridLimits.minColumns} column is required.`)
  .max(gridLimits.maxColumns, `At most ${gridLimits.maxColumns} columns are supported.`);

const rowsSchema = z
  .number()
  .int()
  .min(gridLimits.minRows, `At least ${gridLimits.minRows} row is required.`)
  .max(gridLimits.maxRows, `At most ${gridLimits.maxRows} rows are supported.`);

/** Hex colour stored in buttons.background_color / text_color (DATABASE_DESIGN.md §4.4). */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use a hex colour such as #1b2030.');

export const DEFAULT_BUTTON_BACKGROUND = '#1b2030';
export const DEFAULT_BUTTON_TEXT_COLOR = '#e8ebf2';

export const buttonVisualStates = ['normal', 'hover', 'active', 'pressed'] as const;
export const buttonVisualStateSchema = z.enum(buttonVisualStates);
export type ButtonVisualState = z.infer<typeof buttonVisualStateSchema>;

/** Appearance of one key in one interaction state; every colour is a hex string. */
export const buttonAppearanceStateSchema = z.strictObject({
  backgroundColor: hexColorSchema,
  textColor: hexColorSchema,
  borderColor: hexColorSchema,
  glowColor: hexColorSchema,
  /** 0 = no glow, 1 = strongest glow the renderer allows. */
  glowIntensity: z.number().min(0).max(1),
});
export type ButtonAppearanceState = z.infer<typeof buttonAppearanceStateSchema>;

export const buttonAppearanceSchema = z.strictObject({
  normal: buttonAppearanceStateSchema,
  hover: buttonAppearanceStateSchema,
  active: buttonAppearanceStateSchema,
  pressed: buttonAppearanceStateSchema,
});
export type ButtonAppearance = z.infer<typeof buttonAppearanceSchema>;

/**
 * Appearance used when a button has none stored. It derives from the legacy
 * background/text colours so existing decks keep their look after the upgrade.
 */
export function defaultButtonAppearance(
  backgroundColor: string = DEFAULT_BUTTON_BACKGROUND,
  textColor: string = DEFAULT_BUTTON_TEXT_COLOR,
): ButtonAppearance {
  const base = { backgroundColor, textColor, glowColor: backgroundColor };
  return {
    normal: { ...base, borderColor: '#2a2f3a', glowIntensity: 0.35 },
    hover: { ...base, borderColor: '#4a4258', glowIntensity: 0.6 },
    active: { ...base, borderColor: '#8a70ff', glowIntensity: 0.9 },
    pressed: { ...base, borderColor: '#a996ff', glowIntensity: 1 },
  };
}

/** Reads a stored appearance, falling back to the derived default. */
export function parseButtonAppearance(
  value: unknown,
  backgroundColor: string,
  textColor: string,
): ButtonAppearance {
  const parsed = buttonAppearanceSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultButtonAppearance(backgroundColor, textColor);
}

/**
 * Curated icon identifiers. The database stores the identifier only; the renderer
 * maps it to a Lucide component (lib/button-icons.ts).
 */
export const buttonIconNames = [
  // General
  'bell',
  'heart',
  'star',
  'bookmark',
  'flag',
  'home',
  'layout-grid',
  'settings',
  'sun',
  'moon',
  'lightbulb',
  'rocket',
  'target',
  'trophy',
  'crown',
  'gift',
  'tag',
  'link',
  'clipboard',
  'file-text',
  'folder',
  'download',
  'upload',
  'share-2',
  'trash-2',
  'refresh-cw',
  'lock',
  'shield',
  'key',
  'user',
  'users',
  'smile',
  'palette',
  'brush',
  'sparkles',
  'camera',
  'calendar',
  'mail',
  'send',
  'map-pin',
  'compass',
  // Media
  'play',
  'pause',
  'square',
  'circle',
  'skip-back',
  'skip-forward',
  'rewind',
  'fast-forward',
  'repeat',
  'shuffle',
  'film',
  'clapperboard',
  'video',
  'video-off',
  'music',
  'list-music',
  'disc-3',
  'radio',
  'podcast',
  'tv',
  'monitor',
  'monitor-play',
  'projector',
  'cast',
  'airplay',
  'image',
  // Audio
  'volume-2',
  'volume-1',
  'volume-x',
  'mic',
  'mic-off',
  'headphones',
  'speaker',
  'audio-lines',
  'audio-waveform',
  // System
  'power',
  'settings-2',
  'wifi',
  'wifi-off',
  'bluetooth',
  'globe',
  'server',
  'database',
  'hard-drive',
  'cpu',
  'terminal',
  'code',
  'bug',
  'network',
  'app-window',
  'layout-dashboard',
  'grid-2x2',
  'scissors',
  'zap',
  // Gaming and extras
  'gamepad-2',
  'joystick',
  'keyboard',
  'mouse',
  'bot',
  'clock',
  'message-square',
  'activity',
  'eye',
  'eye-off',
  'flame',
  'leaf',
  'coffee',
  'pizza',
  'anchor',
  'car',
  'plane',
  'train',
  'bike',
  'footprints',
] as const;

export const builtInIconSchema = z.enum(buttonIconNames);
export type ButtonIconName = z.infer<typeof builtInIconSchema>;

/** Custom icons are stored in the database and referenced by their uuid. */
export const customIconRefPattern = /^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const customIconRefSchema = z.string().regex(customIconRefPattern, 'Unknown custom icon reference.');
export type CustomIconRef = z.infer<typeof customIconRefSchema>;

export const buttonIconSchema = z.union([builtInIconSchema, customIconRefSchema]);
export type ButtonIcon = z.infer<typeof buttonIconSchema>;

export function isCustomIconRef(icon: string | null | undefined): icon is CustomIconRef {
  return typeof icon === 'string' && customIconRefPattern.test(icon);
}

const deckNameSchema = z
  .string()
  .trim()
  .min(1, 'Deck name is required.')
  .max(60, 'Deck name is too long.');

const pageNameSchema = z
  .string()
  .trim()
  .min(1, 'Page name is required.')
  .max(40, 'Page name is too long.');

const buttonLabelSchema = z
  .string()
  .trim()
  .min(1, 'Button label is required.')
  .max(40, 'Button label is too long.');

const positionSchema = z.number().int().min(0, 'Position must be zero or greater.');

export const deckSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  name: deckNameSchema,
  columns: columnsSchema,
  rows: rowsSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type Deck = z.infer<typeof deckSchema>;

export const pageSchema = z.object({
  id: z.uuid(),
  deckId: z.uuid(),
  name: pageNameSchema,
  position: positionSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type DeckPage = z.infer<typeof pageSchema>;

export const deckButtonSchema = z.object({
  id: z.uuid(),
  pageId: z.uuid(),
  position: positionSchema,
  label: buttonLabelSchema,
  icon: buttonIconSchema.nullable(),
  backgroundColor: hexColorSchema,
  textColor: hexColorSchema,
  isEnabled: z.boolean(),
  /** Per-state colours; null means "derive from backgroundColor/textColor". */
  appearance: buttonAppearanceSchema.nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type DeckButton = z.infer<typeof deckButtonSchema>;

export const deckSummarySchema = deckSchema.extend({
  pageCount: z.number().int().nonnegative(),
  buttonCount: z.number().int().nonnegative(),
});
export type DeckSummary = z.infer<typeof deckSummarySchema>;

/** A button plus the action configured for it (Phase 3). */
export const deckButtonWithActionSchema = deckButtonSchema.extend({
  action: actionRecordSchema.nullable(),
});
export type DeckButtonWithAction = z.infer<typeof deckButtonWithActionSchema>;

export const deckPageWithButtonsSchema = pageSchema.extend({
  buttons: z.array(deckButtonWithActionSchema),
});
export type DeckPageWithButtons = z.infer<typeof deckPageWithButtonsSchema>;

/** Everything the Deck Editor needs for one deck, in a single IPC round trip. */
export const deckDetailSchema = z.object({
  deck: deckSchema,
  pages: z.array(deckPageWithButtonsSchema),
});
export type DeckDetail = z.infer<typeof deckDetailSchema>;

export const listDecksInputSchema = z.object({
  profileId: z.uuid(),
});
export type ListDecksInput = z.infer<typeof listDecksInputSchema>;

export const getDeckInputSchema = z.object({
  deckId: z.uuid(),
});
export type GetDeckInput = z.infer<typeof getDeckInputSchema>;

export const createDeckInputSchema = z.object({
  profileId: z.uuid(),
  name: deckNameSchema,
  columns: columnsSchema.default(defaultGrid.columns),
  rows: rowsSchema.default(defaultGrid.rows),
});
/** Input keeps the defaults optional; the parsed output always has them. */
export type CreateDeckInput = z.input<typeof createDeckInputSchema>;

export const updateDeckInputSchema = z
  .object({
    deckId: z.uuid(),
    name: deckNameSchema.optional(),
    columns: columnsSchema.optional(),
    rows: rowsSchema.optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.columns !== undefined || value.rows !== undefined,
    'Provide at least one field to update.',
  );
export type UpdateDeckInput = z.infer<typeof updateDeckInputSchema>;

export const deleteDeckInputSchema = z.object({
  deckId: z.uuid(),
});
export type DeleteDeckInput = z.infer<typeof deleteDeckInputSchema>;

export const createPageInputSchema = z.object({
  deckId: z.uuid(),
  name: pageNameSchema,
});
export type CreatePageInput = z.infer<typeof createPageInputSchema>;

export const updatePageInputSchema = z.object({
  pageId: z.uuid(),
  name: pageNameSchema,
});
export type UpdatePageInput = z.infer<typeof updatePageInputSchema>;

export const deletePageInputSchema = z.object({
  pageId: z.uuid(),
});
export type DeletePageInput = z.infer<typeof deletePageInputSchema>;

export const createButtonInputSchema = z.object({
  pageId: z.uuid(),
  position: positionSchema,
  label: buttonLabelSchema,
  icon: buttonIconSchema.optional(),
  backgroundColor: hexColorSchema.default(DEFAULT_BUTTON_BACKGROUND),
  textColor: hexColorSchema.default(DEFAULT_BUTTON_TEXT_COLOR),
  isEnabled: z.boolean().default(true),
  appearance: buttonAppearanceSchema.optional(),
});
export type CreateButtonInput = z.input<typeof createButtonInputSchema>;

export const updateButtonInputSchema = z
  .object({
    buttonId: z.uuid(),
    position: positionSchema.optional(),
    label: buttonLabelSchema.optional(),
    icon: buttonIconSchema.nullable().optional(),
    backgroundColor: hexColorSchema.optional(),
    textColor: hexColorSchema.optional(),
    isEnabled: z.boolean().optional(),
    appearance: buttonAppearanceSchema.nullable().optional(),
  })
  .refine(
    (value) =>
      value.position !== undefined ||
      value.label !== undefined ||
      value.icon !== undefined ||
      value.backgroundColor !== undefined ||
      value.textColor !== undefined ||
      value.isEnabled !== undefined ||
      value.appearance !== undefined,
    'Provide at least one field to update.',
  );
export type UpdateButtonInput = z.infer<typeof updateButtonInputSchema>;

export const deleteButtonInputSchema = z.object({
  buttonId: z.uuid(),
});
export type DeleteButtonInput = z.infer<typeof deleteButtonInputSchema>;

export const duplicateButtonInputSchema = z.object({
  buttonId: z.uuid(),
  position: positionSchema,
});
export type DuplicateButtonInput = z.infer<typeof duplicateButtonInputSchema>;

/** Row-major cell index for a grid cell (0-based). */
export function gridCellIndex(columns: number, row: number, column: number): number {
  return row * columns + column;
}

export function gridDimensionsLabel(columns: number, rows: number): string {
  return `${columns} × ${rows}`;
}
