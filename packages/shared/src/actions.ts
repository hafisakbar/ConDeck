import { z } from 'zod';

/**
 * Action types for MVP, taken from PRD §5.4 (Action Engine).
 * Execution is implemented in Phase 3; the list lives here so the database
 * schema and (later) the desktop UI share one source of truth.
 */
export const actionTypes = [
  'OBS_SWITCH_SCENE',
  'OBS_START_STREAMING',
  'OBS_STOP_STREAMING',
  'OBS_START_RECORDING',
  'OBS_STOP_RECORDING',
  'OBS_TOGGLE_MUTE',
  'OBS_SET_MUTE',
  'SYSTEM_OPEN_APP',
  'SYSTEM_OPEN_URL',
  'NAV_NEXT_PAGE',
  'NAV_PREV_PAGE',
] as const;

export const actionTypeSchema = z.enum(actionTypes);
export type ActionType = z.infer<typeof actionTypeSchema>;
