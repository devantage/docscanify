import type { Corner } from '@devantage/docscanify';

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

/** Unit vector from `a` to `b`. */
export function direction(a: Corner, b: Corner): Corner {
  const len: number = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

/**
 * Position of a square loupe in a `w` × `h` area: above the pointer (x, y) or, without room,
 * beside it, always inside the area.
 *
 * @param gap Distance between the loupe and the pointer.
 * @param size Side of the loupe.
 * @returns Top-left corner of the loupe.
 */
export function placeLoupe(
  x: number,
  y: number,
  w: number,
  h: number,
  gap: number,
  size: number,
): Corner {
  const maxX: number = w - size;
  const maxY: number = h - size;
  const above: number = y - gap - size;
  if (above >= 0) return { x: clamp(x - size / 2, 0, maxX), y: above };
  const right: number = x + gap;
  return {
    x: clamp(right <= maxX ? right : x - gap - size, 0, maxX),
    y: clamp(y - size / 2, 0, maxY),
  };
}
