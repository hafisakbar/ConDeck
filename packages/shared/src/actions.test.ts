import { describe, expect, it } from 'vitest';
import {
  actionCatalog,
  actionConfigIssue,
  actionConfigSchemas,
  actionTypes,
  defaultActionConfig,
  getActionCatalogEntry,
  navigationRequestSchema,
  parseActionConfig,
  setActionInputSchema,
} from './actions';

describe('action contract', () => {
  it('describes every action type in the catalog and in the schema map', () => {
    expect(actionCatalog.map((entry) => entry.type).sort()).toEqual([...actionTypes].sort());
    expect(Object.keys(actionConfigSchemas).sort()).toEqual([...actionTypes].sort());
  });

  it('keeps catalog fields aligned with the validation schema', () => {
    for (const type of actionTypes) {
      const entry = getActionCatalogEntry(type);
      const config = defaultActionConfig(type);
      expect(Object.keys(config).sort()).toEqual(entry.fields.map((field) => field.key).sort());

      const issue = actionConfigIssue(type, config);
      // Text fields start empty, which the schema rejects until the user fills them in.
      const hasTextFields = entry.fields.some((field) => field.type === 'text');
      expect(issue === null).toBe(!hasTextFields);
    }
  });

  it('accepts the configuration of each action when its fields are filled', () => {
    const valid: Record<string, unknown> = {
      OBS_SWITCH_SCENE: { sceneName: 'Starting soon' },
      OBS_TOGGLE_MUTE: { inputName: 'Mic/Aux' },
      OBS_SET_MUTE: { inputName: 'Mic/Aux', muted: true },
      TIKTOK_SWITCH_SCENE: { sceneName: 'Main' },
      TIKTOK_SET_SOURCE_VISIBILITY: { sceneName: 'Main', sourceId: 'cam-1', visible: false },
      TIKTOK_TOGGLE_SOURCE: { sceneName: 'Main', sourceId: 'cam-1' },
      TIKTOK_SET_MIC_MUTED: { muted: true },
      TIKTOK_SET_AUDIO_MUTED: { muted: true },
      SYSTEM_OPEN_APP: { applicationPath: 'C:\\Tools\\app.exe' },
      SYSTEM_OPEN_URL: { url: 'https://example.com' },
      SOUNDBOARD_PLAY: { soundId: '5f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b' },
    };

    for (const type of actionTypes) {
      const config = valid[type] ?? {};
      expect(actionConfigIssue(type, config)).toBeNull();
      expect(parseActionConfig(type, config)).toEqual(config);
    }
  });

  it('rejects unknown keys and unsafe URLs or paths', () => {
    expect(actionConfigIssue('OBS_SWITCH_SCENE', { sceneName: 'Main', extra: 1 })).not.toBeNull();
    expect(actionConfigIssue('SYSTEM_OPEN_URL', { url: 'file:///C:/Windows/system32' })).not.toBeNull();
    expect(actionConfigIssue('SYSTEM_OPEN_APP', { applicationPath: 'app.exe' })).not.toBeNull();
    expect(actionConfigIssue('SYSTEM_OPEN_APP', { applicationPath: 'C:\\a.exe -flag' })).toBeNull();
  });

  it('validates action input payloads through the IPC schema', () => {
    expect(
      setActionInputSchema.safeParse({
        buttonId: '5f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
        actionType: 'NAV_NEXT_PAGE',
      }).success,
    ).toBe(true);
    expect(
      setActionInputSchema.safeParse({
        buttonId: 'nope',
        actionType: 'NAV_NEXT_PAGE',
        config: {},
      }).success,
    ).toBe(false);
    expect(setActionInputSchema.safeParse({ buttonId: '5f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b' }).success).toBe(false);
  });

  it('validates navigation events coming from the main process', () => {
    expect(
      navigationRequestSchema.safeParse({
        direction: 'next',
        buttonId: '5f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
      }).success,
    ).toBe(true);
    expect(navigationRequestSchema.safeParse({ direction: 'up', buttonId: 'x' }).success).toBe(false);
  });
});
