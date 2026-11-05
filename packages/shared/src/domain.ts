import { z } from 'zod';

/** ISO-8601 UTC timestamp, e.g. 2026-01-01T10:00:00.000Z (DATABASE_DESIGN.md §2). */
export const isoTimestampSchema = z.iso.datetime();

/** Zustand of an OBS integration as far as the desktop knows it (Phase 1: no live client yet). */
export const obsConnectionStates = ['NOT_CONFIGURED', 'DISABLED', 'DISCONNECTED', 'CONNECTED'] as const;
export const obsStatusSchema = z.object({
  state: z.enum(obsConnectionStates),
  message: z.string().nullable(),
});
export type ObsStatus = z.infer<typeof obsStatusSchema>;

export const profileSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type Profile = z.infer<typeof profileSchema>;

export const createProfileInputSchema = z.object({
  name: z.string().trim().min(1, 'Profile name is required.').max(60, 'Profile name is too long.'),
  description: z.string().trim().max(240, 'Description is too long.').optional(),
});
export type CreateProfileInput = z.infer<typeof createProfileInputSchema>;

export const setActiveProfileInputSchema = z.object({
  profileId: z.uuid(),
});
export type SetActiveProfileInput = z.infer<typeof setActiveProfileInputSchema>;

export const deviceSchema = z.object({
  id: z.uuid(),
  deviceName: z.string(),
  deviceType: z.string(),
  lastSeenAt: isoTimestampSchema.nullable(),
  isAuthorized: z.boolean(),
  createdAt: isoTimestampSchema,
});
export type Device = z.infer<typeof deviceSchema>;

export const activityLogSchema = z.object({
  id: z.uuid(),
  deviceId: z.uuid().nullable(),
  eventType: z.string(),
  description: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoTimestampSchema,
});
export type ActivityLog = z.infer<typeof activityLogSchema>;

export const listActivityInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
});
export type ListActivityInput = z.infer<typeof listActivityInputSchema>;

export const appInfoSchema = z.object({
  name: z.literal('ConDeck'),
  version: z.string(),
  platform: z.string(),
  isPackaged: z.boolean(),
  databasePath: z.string(),
  logPath: z.string(),
});
export type AppInfo = z.infer<typeof appInfoSchema>;

export const dashboardSummarySchema = z.object({
  app: appInfoSchema,
  profile: z.object({
    active: profileSchema.nullable(),
    total: z.number().int().nonnegative(),
  }),
  deck: z.object({
    total: z.number().int().nonnegative(),
  }),
  devices: z.object({
    paired: z.number().int().nonnegative(),
    online: z.number().int().nonnegative(),
  }),
  obs: obsStatusSchema,
  activity: z.array(activityLogSchema),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
