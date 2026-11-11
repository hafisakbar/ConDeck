import type { DeckPageWithButtons } from '@condeck/shared';
import { describe, expect, it } from 'vitest';
import { buttonLayout, fitScale, planGridShrink, slotPosition } from './grid-layout';

function pageFixture(id: string, name: string, positions: number[]): DeckPageWithButtons {
  return {
    id,
    deckId: 'deck-1',
    name,
    position: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    buttons: positions.map((position) => ({
      id: `${id}-${position}`,
      pageId: id,
      position,
      label: `Button ${position + 1}`,
      icon: null,
      backgroundColor: '#1b2030',
      textColor: '#e8ebf2',
      isEnabled: true,
    appearance: null,
      action: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })),
  };
}

describe('planGridShrink', () => {
  it('keeps buttons inside the new capacity', () => {
    const pages = [pageFixture('page-1', 'Main', [0, 1, 2, 3])];
    expect(planGridShrink(pages, 2, 2)).toEqual([]);
  });

  it('reports every occupied slot that would be removed, across pages', () => {
    const pages = [
      pageFixture('page-1', 'Main', [0, 4, 5]),
      pageFixture('page-2', 'Audio', [8]),
    ];

    const removed = planGridShrink(pages, 2, 2);

    expect(removed.map((entry) => entry.label)).toEqual(['Button 5', 'Button 6', 'Button 9']);
    expect(removed.map((entry) => entry.pageName)).toEqual(['Main', 'Main', 'Audio']);
    expect(removed.map((entry) => entry.position)).toEqual([4, 5, 8]);
  });

  it('treats a 1 × 1 grid as one slot', () => {
    const pages = [pageFixture('page-1', 'Main', [0, 1])];
    expect(planGridShrink(pages, 1, 1)).toHaveLength(1);
  });
});

describe('fitScale', () => {
  it('fills the frame for the reference 5 × 3 deck and a smaller 3 × 3 deck', () => {
    expect(fitScale(5, 3)).toBe(1);
    expect(fitScale(3, 3)).toBe(1);
  });

  it('scales larger grids down but never below the readable floor', () => {
    expect(fitScale(4, 4)).toBeCloseTo(0.75, 5);
    expect(fitScale(8, 8)).toBeCloseTo(0.45, 5);
  });
});

describe('buttonLayout', () => {
  it('derives pitch, width and depth from the button size and gap', () => {
    const layout = buttonLayout(4, 2, 1, 0.16);

    expect(layout.size).toBe(1);
    expect(layout.gap).toBeCloseTo(0.16, 5);
    expect(layout.pitch).toBeCloseTo(1.16, 5);
    expect(layout.width).toBeCloseTo(4 + 3 * 0.16, 5);
    expect(layout.depth).toBeCloseTo(2 + 0.16, 5);
  });

  it('centres slots on the chassis', () => {
    const layout = buttonLayout(3, 3, 1, 0.16);
    expect(slotPosition(0, 3, 3, layout).x).toBeCloseTo(-layout.pitch, 5);
    expect(slotPosition(0, 3, 3, layout).z).toBeCloseTo(-layout.pitch, 5);
    expect(slotPosition(4, 3, 3, layout)).toEqual({ x: 0, z: 0 });
  });
});
