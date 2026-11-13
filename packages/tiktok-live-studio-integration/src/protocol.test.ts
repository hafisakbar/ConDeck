import { describe, expect, it } from 'vitest';
import { checkVersion, decodeJsonPayload, normalizeState, parseVersion } from './protocol';

const rawSettings = {
  audio_mute: false,
  mic_mute: true,
  scene: 'Main',
  scene_list: [
    {
      name: 'Main',
      sources: [{ label: 'Camera', value: 'cam-1', extra: true }],
      visible_sources: [{ label: 'Camera', value: 'cam-1' }],
    },
  ],
  recording: false,
  stream_status: 2,
};

describe('normalizeState', () => {
  it('normalizes the documented settings payload', () => {
    const state = normalizeState(JSON.stringify(rawSettings));
    expect(state.sceneName).toBe('Main');
    expect(state.micMuted).toBe(true);
    expect(state.audioMuted).toBe(false);
    expect(state.streamStatus).toBe(2);
    expect(state.scenes[0]?.visibleSources[0]?.value).toBe('cam-1');
  });

  it('accepts an already-parsed object and fills optional fields', () => {
    const state = normalizeState({ scene: 'Only' });
    expect(state).toMatchObject({
      sceneName: 'Only',
      scenes: [],
      micMuted: false,
      recording: false,
      streamStatus: 0,
    });
  });

  it('rejects a payload it cannot read', () => {
    expect(() => normalizeState(JSON.stringify({ scene_list: 'nope' }))).toThrow(/could not read/i);
    expect(() => decodeJsonPayload('{oops')).toThrow(/malformed/i);
  });
});

describe('version compatibility', () => {
  it('reads Windows version strings', () => {
    expect(parseVersion('1.33.2.100')).toEqual({ major: 1, minor: 33, patch: 2 });
    expect(parseVersion('nope')).toBeNull();
  });

  it('verifies 1.33.x', () => {
    const result = checkVersion('1.33.2.100');
    expect(result.supported).toBe(true);
    expect(result.level).toBe('verified');
  });

  it('allows other 1.x versions with a warning', () => {
    const result = checkVersion('1.35.0');
    expect(result.supported).toBe(true);
    expect(result.level).toBe('untested');
  });

  it('refuses old or different major versions', () => {
    expect(checkVersion('1.20.0').supported).toBe(false);
    expect(checkVersion('2.0.0').supported).toBe(false);
    expect(checkVersion('1.20.0').level).toBe('unsupported');
  });

  it('tries the documented contract when the version is unknown', () => {
    const result = checkVersion(null);
    expect(result.supported).toBe(true);
    expect(result.level).toBe('unknown');
  });
});
