import { z } from 'zod';
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

/**
 * Curated icon identifiers. The database stores the identifier only; the renderer
 * maps it to a Lucide component (lib/button-icons.ts).
 */
export const buttonIconNames = [
  'bell',
  'cast',
  'circle',
  'clock',
  'film',
  'gamepad-2',
  'headphones',
  'image',
  'list-music',
  'message-square',
  'mic',
  'mic-off',
  'monitor',
  'music',
  'pause',
  'play',
  'power',
  'radio',
  'scissors',
  'settings',
  'skip-back',
  'skip-forward',
  'square',
  'star',
  'volume-2',
  'volume-x',
  'zap',
] as const;

export const buttonIconSchema = z.enum(buttonIconNames);
export type ButtonIconName = z.infer<typeof buttonIconSchema>;

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
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type DeckButton = z.infer<typeof deckButtonSchema>;

export const deckSummarySchema = deckSchema.extend({
  pageCount: z.number().int().nonnegative(),
  buttonCount: z.number().int().nonnegative(),
});
export type DeckSummary = z.infer<typeof deckSummarySchema>;

export const deckPageWithButtonsSchema = pageSchema.extend({
  buttons: z.array(deckButtonSchema),
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
  })
  .refine(
    (value) =>
      value.position !== undefined ||
      value.label !== undefined ||
      value.icon !== undefined ||
      value.backgroundColor !== undefined ||
      value.textColor !== undefined ||
      value.isEnabled !== undefined,
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
