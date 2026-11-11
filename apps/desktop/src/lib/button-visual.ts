/**
 * Interaction states a key can show.
 *
 * The four match the palette stored per button; Selected is not a palette of
 * its own but a frame around the key, so it never replaces the face colour.
 */
export type ButtonVisualState = 'normal' | 'hover' | 'active' | 'pressed';

export interface ButtonVisualInput {
  disabled: boolean;
  pressed: boolean;
  hovered: boolean;
  active: boolean;
  selected: boolean;
}

/**
 * Glow multiplier per state. Kept small on purpose: emissive values above ~1.5
 * clip to white and hide the stored colour, which reads as flicker on hover.
 */
export const BUTTON_GLOW_LIFT: Record<ButtonVisualState, number> = {
  normal: 0.9,
  hover: 1.08,
  active: 1.3,
  pressed: 1.16,
};

/**
 * Single priority ladder for the key face:
 *
 * disabled → pressed → active → (hover only when not selected) → normal.
 *
 * Pressed outranks active so a click is always visible on a live key, and a
 * selected key keeps its face while the pointer moves across it, leaving the
 * selection frame and halo untouched. Hover is only a styling of the face, so
 * releasing it always returns to whatever state the key really is in.
 */
export function resolveButtonVisualState(input: ButtonVisualInput): ButtonVisualState {
  if (input.disabled) {
    return 'normal';
  }
  if (input.pressed) {
    return 'pressed';
  }
  if (input.active) {
    return 'active';
  }
  if (input.hovered && !input.selected) {
    return 'hover';
  }
  return 'normal';
}

export function buttonGlowLift(state: ButtonVisualState): number {
  return BUTTON_GLOW_LIFT[state];
}
