import { describe, expect, it } from 'vitest';
import { BUTTON_GLOW_LIFT, resolveButtonVisualState, type ButtonVisualInput } from './button-visual';

const idle: ButtonVisualInput = {
  disabled: false,
  pressed: false,
  hovered: false,
  active: false,
  selected: false,
};

describe('resolveButtonVisualState', () => {
  it('shows hover only while the pointer is on the key', () => {
    expect(resolveButtonVisualState({ ...idle, hovered: true })).toBe('hover');
    expect(resolveButtonVisualState(idle)).toBe('normal');
  });

  it('lets a real active state outrank hover', () => {
    expect(resolveButtonVisualState({ ...idle, hovered: true, active: true })).toBe('active');
  });

  it('shows the press even on an active or hovered key', () => {
    expect(resolveButtonVisualState({ ...idle, hovered: true, active: true, pressed: true })).toBe('pressed');
  });

  it('keeps a selected key from being restyled by hover', () => {
    expect(resolveButtonVisualState({ ...idle, hovered: true, selected: true })).toBe('normal');
    expect(resolveButtonVisualState({ ...idle, hovered: true, selected: true, active: true })).toBe('active');
  });

  it('ignores every interaction state while the button is disabled', () => {
    expect(
      resolveButtonVisualState({ disabled: true, pressed: true, hovered: true, active: true, selected: true }),
    ).toBe('normal');
  });
});

describe('BUTTON_GLOW_LIFT', () => {
  it('never drives the cap past the clipping point', () => {
    for (const lift of Object.values(BUTTON_GLOW_LIFT)) {
      expect(lift).toBeLessThanOrEqual(1.3);
    }
  });

  it('orders hover below active so a live key stays the brightest', () => {
    expect(BUTTON_GLOW_LIFT.normal).toBeLessThan(BUTTON_GLOW_LIFT.hover);
    expect(BUTTON_GLOW_LIFT.hover).toBeLessThan(BUTTON_GLOW_LIFT.active);
  });
});
