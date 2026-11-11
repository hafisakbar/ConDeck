import type { ObsSnapshot } from '@condeck/shared';
import { describe, expect, it } from 'vitest';
import { isButtonActive } from './button-status';

const baseSnapshot: ObsSnapshot = {
  state: 'CONNECTED',
  message: null,
  host: '127.0.0.1',
  port: 4455,
  isEnabled: true,
  hasPassword: false,
  sceneName: 'Main',
  scenes: ['Main', 'BRB'],
  isStreaming: false,
  isRecording: false,
  mutedInputs: {},
};

function button(actionType: string, config: Record<string, unknown> = {}) {
  return {
    action: {
      id: 'a',
      buttonId: 'b',
      actionType,
      config,
      position: 0,
      createdAt: '',
      updatedAt: '',
    },
  } as never;
}

describe('isButtonActive', () => {
  it('lights streaming keys only while OBS is streaming', () => {
    const buttonEntry = button('OBS_START_STREAMING');
    expect(isButtonActive(buttonEntry, baseSnapshot)).toBe(false);
    expect(isButtonActive(buttonEntry, { ...baseSnapshot, isStreaming: true })).toBe(true);
  });

  it('lights recording keys only while OBS is recording', () => {
    const buttonEntry = button('OBS_STOP_RECORDING');
    expect(isButtonActive(buttonEntry, { ...baseSnapshot, isRecording: true })).toBe(true);
  });

  it('lights the scene key that matches the live scene', () => {
    expect(isButtonActive(button('OBS_SWITCH_SCENE', { sceneName: 'Main' }), baseSnapshot)).toBe(true);
    expect(isButtonActive(button('OBS_SWITCH_SCENE', { sceneName: 'BRB' }), baseSnapshot)).toBe(false);
  });

  it('lights mute keys from the muted input map', () => {
    const muted = { ...baseSnapshot, mutedInputs: { 'Mic/Aux': true } };
    expect(isButtonActive(button('OBS_TOGGLE_MUTE', { inputName: 'Mic/Aux' }), muted)).toBe(true);
    expect(isButtonActive(button('OBS_TOGGLE_MUTE', { inputName: 'Music' }), muted)).toBe(false);
  });

  it('never stays active when OBS is disconnected', () => {
    const streaming = { ...baseSnapshot, state: 'DISCONNECTED' as const, isStreaming: true };
    expect(isButtonActive(button('OBS_START_STREAMING'), streaming)).toBe(false);
    expect(isButtonActive(button('OBS_START_STREAMING'), null)).toBe(false);
  });

  it('leaves actions without a persistent state normal', () => {
    expect(isButtonActive(button('NAV_NEXT_PAGE'), baseSnapshot)).toBe(false);
    expect(isButtonActive(button('SYSTEM_OPEN_URL', { url: 'https://example.com' }), baseSnapshot)).toBe(false);
    expect(isButtonActive({ action: null } as never, baseSnapshot)).toBe(false);
  });
});
