import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { actionTypes } from '@condeck/shared';

const nowIso = (): string => new Date().toISOString();

const createdAt = text('created_at')
  .notNull()
  .$defaultFn(nowIso);
const updatedAt = text('updated_at')
  .notNull()
  .$defaultFn(nowIso)
  .$onUpdate(nowIso);

/**
 * profiles — DATABASE_DESIGN.md §4.1
 */
export const profiles = sqliteTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [index('profiles_is_active_idx').on(table.isActive)],
);

/**
 * decks — DATABASE_DESIGN.md §4.2
 */
export const decks = sqliteTable(
  'decks',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    columns: integer('columns').notNull(),
    rows: integer('rows').notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [index('decks_profile_id_idx').on(table.profileId)],
);

/**
 * pages — DATABASE_DESIGN.md §4.3
 */
export const pages = sqliteTable(
  'pages',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('pages_deck_id_idx').on(table.deckId),
    uniqueIndex('pages_deck_position_unique').on(table.deckId, table.position),
  ],
);

/**
 * media_assets — DATABASE_DESIGN.md §4.9
 * Declared before buttons because buttons reference it.
 */
export const mediaAssets = sqliteTable('media_assets', {
  id: text('id').primaryKey(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  createdAt,
});

/**
 * buttons — DATABASE_DESIGN.md §4.4
 */
export const buttons = sqliteTable(
  'buttons',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    label: text('label').notNull(),
    icon: text('icon'),
    imageAssetId: text('image_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
    backgroundColor: text('background_color').notNull(),
    textColor: text('text_color').notNull(),
    /** JSON of the per-state colours/glow (ButtonAppearance); null derives defaults. */
    appearanceJson: text('appearance_json'),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('buttons_page_id_idx').on(table.pageId),
    uniqueIndex('buttons_page_position_unique').on(table.pageId, table.position),
  ],
);

/**
 * actions — DATABASE_DESIGN.md §4.5
 */
export const actions = sqliteTable(
  'actions',
  {
    id: text('id').primaryKey(),
    buttonId: text('button_id')
      .notNull()
      .references(() => buttons.id, { onDelete: 'cascade' }),
    actionType: text('action_type', { enum: actionTypes }).notNull(),
    configJson: text('config_json').notNull().default('{}'),
    position: integer('position').notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index('actions_button_id_idx').on(table.buttonId),
    uniqueIndex('actions_button_position_unique').on(table.buttonId, table.position),
  ],
);

/**
 * integrations — DATABASE_DESIGN.md §4.6
 * Credentials are NOT stored here: only a reference to the safeStorage-protected secret.
 */
export const integrations = sqliteTable(
  'integrations',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    displayName: text('display_name').notNull(),
    host: text('host'),
    port: integer('port'),
    credentialReference: text('credential_reference'),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex('integrations_provider_unique').on(table.provider)],
);

/**
 * devices — DATABASE_DESIGN.md §4.7
 */
export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  deviceName: text('device_name').notNull(),
  deviceType: text('device_type').notNull(),
  credentialHash: text('credential_hash').notNull(),
  lastSeenAt: text('last_seen_at'),
  isAuthorized: integer('is_authorized', { mode: 'boolean' }).notNull().default(false),
  createdAt,
});

/**
 * device_sessions — DATABASE_DESIGN.md §4.8
 */
export const deviceSessions = sqliteTable(
  'device_sessions',
  {
    id: text('id').primaryKey(),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    sessionStatus: text('session_status', { enum: ['connected', 'disconnected'] }).notNull(),
    connectedAt: text('connected_at').notNull(),
    disconnectedAt: text('disconnected_at'),
    lastActivityAt: text('last_activity_at').notNull(),
  },
  (table) => [index('device_sessions_device_id_idx').on(table.deviceId)],
);

/**
 * activity_logs — DATABASE_DESIGN.md §4.10
 */
export const activityLogs = sqliteTable(
  'activity_logs',
  {
    id: text('id').primaryKey(),
    deviceId: text('device_id').references(() => devices.id, { onDelete: 'set null' }),
    eventType: text('event_type').notNull(),
    description: text('description').notNull(),
    metadataJson: text('metadata_json'),
    createdAt,
  },
  (table) => [
    index('activity_logs_device_id_idx').on(table.deviceId),
    index('activity_logs_created_at_idx').on(table.createdAt),
  ],
);

export type ProfileRow = typeof profiles.$inferSelect;
export type DeckRow = typeof decks.$inferSelect;
export type PageRow = typeof pages.$inferSelect;
export type ButtonRow = typeof buttons.$inferSelect;
export type ActionRow = typeof actions.$inferSelect;
export type IntegrationRow = typeof integrations.$inferSelect;
export type DeviceRow = typeof devices.$inferSelect;
export type DeviceSessionRow = typeof deviceSessions.$inferSelect;
export type MediaAssetRow = typeof mediaAssets.$inferSelect;
export type ActivityLogRow = typeof activityLogs.$inferSelect;
