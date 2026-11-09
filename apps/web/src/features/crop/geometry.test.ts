import type { Corner } from '@devantage/docscanify';
import { describe, expect, it } from 'vitest';

import { clamp, direction, placeLoupe } from './geometry';

describe('clamp', (): void => {
  it('keeps a value that is already inside the range', (): void => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('raises a value below the range to the minimum', (): void => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('lowers a value above the range to the maximum', (): void => {
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it('keeps the bounds themselves', (): void => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('works with fractional and negative ranges', (): void => {
    expect(clamp(-7.5, -5.25, -1)).toBe(-5.25);
    expect(clamp(0.5, -5.25, -1)).toBe(-1);
  });
});

describe('direction', (): void => {
  it('returns the unit vector from the first point to the second', (): void => {
    const unit: Corner = direction({ x: 1, y: 1 }, { x: 4, y: 5 });
    expect(unit.x).toBeCloseTo(0.6);
    expect(unit.y).toBeCloseTo(0.8);
  });

  it('points backwards when the points are swapped', (): void => {
    const unit: Corner = direction({ x: 4, y: 5 }, { x: 1, y: 1 });
    expect(unit.x).toBeCloseTo(-0.6);
    expect(unit.y).toBeCloseTo(-0.8);
  });

  it('has length 1 whatever the distance between the points', (): void => {
    const unit: Corner = direction({ x: 0, y: 0 }, { x: -1000, y: 1000 });
    expect(Math.hypot(unit.x, unit.y)).toBeCloseTo(1);
    expect(unit.x).toBeCloseTo(-Math.SQRT1_2);
    expect(unit.y).toBeCloseTo(Math.SQRT1_2);
  });

  it('follows the axes for horizontal and vertical segments', (): void => {
    expect(direction({ x: 10, y: 10 }, { x: 90, y: 10 })).toEqual({
      x: 1,
      y: 0,
    });
    expect(direction({ x: 10, y: 90 }, { x: 10, y: 10 })).toEqual({
      x: 0,
      y: -1,
    });
  });

  it('returns a zero vector instead of NaN when both points are the same', (): void => {
    expect(direction({ x: 3, y: 3 }, { x: 3, y: 3 })).toEqual({ x: 0, y: 0 });
  });
});

describe('placeLoupe', (): void => {
  // An 800 × 600 editor, a 128 px loupe and a 32 px gap, as with a mouse
  const W: number = 800;
  const H: number = 600;
  const GAP: number = 32;
  const SIZE: number = 128;

  it('centers the loupe horizontally above the pointer when there is room', (): void => {
    expect(placeLoupe(200, 300, W, H, GAP, SIZE)).toEqual({ x: 136, y: 140 });
  });

  it('places it above when the room is exactly enough', (): void => {
    // 160 = gap + size: the loupe touches the top edge
    expect(placeLoupe(200, 160, W, H, GAP, SIZE)).toEqual({ x: 136, y: 0 });
  });

  it('keeps the loupe above inside the left and right edges', (): void => {
    expect(placeLoupe(10, 300, W, H, GAP, SIZE)).toEqual({ x: 0, y: 140 });
    expect(placeLoupe(790, 300, W, H, GAP, SIZE)).toEqual({
      x: W - SIZE,
      y: 140,
    });
  });

  it('moves the loupe to the right of the pointer, vertically centered, without room above', (): void => {
    expect(placeLoupe(200, 100, W, H, GAP, SIZE)).toEqual({ x: 232, y: 36 });
  });

  it('keeps it to the right when the room there is exactly enough', (): void => {
    // 640 + 32 = 672 = 800 - 128: the loupe touches the right edge
    expect(placeLoupe(640, 100, W, H, GAP, SIZE)).toEqual({ x: 672, y: 36 });
  });

  it('moves it to the left of the pointer when there is no room above nor to the right', (): void => {
    // 700 + 32 would overflow the 672 px limit, so it goes at 700 - 32 - 128
    expect(placeLoupe(700, 100, W, H, GAP, SIZE)).toEqual({ x: 540, y: 36 });
  });

  it('keeps the loupe beside the pointer inside the top edge', (): void => {
    expect(placeLoupe(200, 10, W, H, GAP, SIZE)).toEqual({ x: 232, y: 0 });
  });

  it('keeps the loupe beside the pointer inside the bottom edge of a short area', (): void => {
    // A 150 px tall area: no room above a pointer at its bottom, and the loupe must end at 150
    expect(placeLoupe(200, 150, W, 150, GAP, SIZE)).toEqual({ x: 232, y: 22 });
  });

  it('uses the gap it is given, so a finger gets a larger distance', (): void => {
    expect(placeLoupe(400, 500, W, H, 64, SIZE)).toEqual({ x: 336, y: 308 });
    expect(placeLoupe(200, 100, W, H, 64, SIZE)).toEqual({ x: 264, y: 36 });
  });
});
