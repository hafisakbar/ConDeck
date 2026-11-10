import type { DeckPageWithButtons } from '@condeck/shared';

/** A button that would fall outside the grid if the deck were resized. */
export interface RemovedButton {
  pageId: string;
  pageName: string;
  buttonId: string;
  label: string;
  position: number;
}

export const BUTTON_SIZE_LIMITS = { min: 0.82, max: 1.16 } as const;
export const BUTTON_GAP_LIMITS = { min: 0.05, max: 0.42 } as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function gridCapacity(columns: number, rows: number): number {
  return Math.max(1, Math.floor(columns)) * Math.max(1, Math.floor(rows));
}

/**
 * Every button whose slot disappears when the deck shrinks. The renderer must
 * ask before applying the change; the caller deletes exactly these buttons.
 */
export function planGridShrink(
  pages: readonly DeckPageWithButtons[],
  columns: number,
  rows: number,
): RemovedButton[] {
  const capacity = gridCapacity(columns, rows);
  return pages.flatMap((page) =>
    page.buttons
      .filter((button) => button.position >= capacity)
      .map((button) => ({
        pageId: page.id,
        pageName: page.name,
        buttonId: button.id,
        label: button.label,
        position: button.position,
      })),
  );
}

/**
 * Device scale for a grid. A 3 × 3 deck fills the designed frame; bigger grids
 * shrink to a floor instead of becoming unreadably small, and the stage lets
 * the user zoom out further or pan.
 */
export function fitScale(columns: number, rows: number): number {
  // The stage is framed for the reference 5 × 3 device; wider or taller decks
  // scale down to a readable floor instead of shrinking forever.
  return clamp(Math.min(5 / Math.max(columns, 1), 3 / Math.max(rows, 1)), 0.45, 1);
}

export interface ButtonLayout {
  size: number;
  gap: number;
  pitch: number;
  width: number;
  depth: number;
}

/** Geometry of one button cell, shared by the chassis and the button meshes. */
export function buttonLayout(
  columns: number,
  rows: number,
  buttonScale: number,
  gapScale: number,
): ButtonLayout {
  const size = clamp(buttonScale, BUTTON_SIZE_LIMITS.min, BUTTON_SIZE_LIMITS.max);
  const gap = size * clamp(gapScale, BUTTON_GAP_LIMITS.min, BUTTON_GAP_LIMITS.max);
  const pitch = size + gap;
  return {
    size,
    gap,
    pitch,
    width: columns * size + (columns - 1) * gap,
    depth: rows * size + (rows - 1) * gap,
  };
}

/** Slot position on the device face, in world units, centred on the chassis. */
export function slotPosition(
  position: number,
  columns: number,
  rows: number,
  layout: ButtonLayout,
): { x: number; z: number } {
  const column = position % columns;
  const row = Math.floor(position / columns);
  return {
    x: (column - (columns - 1) / 2) * layout.pitch,
    z: (row - (rows - 1) / 2) * layout.pitch,
  };
}
