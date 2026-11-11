import { describe, expect, it } from 'vitest';
import { createProfileInputSchema, dashboardSummarySchema, setActiveProfileInputSchema } from './domain';
import { ipcChannels, ipcInputSchemas } from './ipc';

describe('profile input validation', () => {
  it('accepts a valid profile and trims the name', () => {
    const parsed = createProfileInputSchema.parse({ name: '  Streaming  ' });
    expect(parsed.name).toBe('Streaming');
  });

  it('rejects an empty name', () => {
    expect(createProfileInputSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('rejects a name longer than 60 characters', () => {
    expect(createProfileInputSchema.safeParse({ name: 'a'.repeat(61) }).success).toBe(false);
  });

  it('requires a UUID for the profile id', () => {
    expect(setActiveProfileInputSchema.safeParse({ profileId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('ipc contract', () => {
  it('declares an input schema for every channel and no extra entries', () => {
    expect(Object.keys(ipcInputSchemas).sort()).toEqual([...ipcChannels].sort());
  });
});

describe('dashboard summary schema', () => {
  it('rejects a summary whose profile total is negative', () => {
    const result = dashboardSummarySchema.safeParse({
      app: {
        name: 'StreamKey',
        version: '0.1.0',
        platform: 'win32',
        isPackaged: false,
        databasePath: 'C:/data/condeck.db',
        logPath: 'C:/data/logs/app.log',
      },
      profile: { active: null, total: -1 },
      deck: { total: 0 },
      devices: { paired: 0, online: 0 },
      obs: { state: 'NOT_CONFIGURED', message: null },
      activity: [],
    });
    expect(result.success).toBe(false);
  });
});
