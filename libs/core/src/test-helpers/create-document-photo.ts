import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

import type { Corner, Corners } from '../domain/models';

/** A synthetic photo of a document. */
export interface DocumentPhoto {
  canvas: Canvas;

  buffer: Buffer;

  corners: Corners;
}

/** Where the sheet of the default photo is. */
export const DOCUMENT_PHOTO_CORNERS: Corners = {
  topLeft: { x: 140, y: 90 },
  topRight: { x: 640, y: 120 },
  bottomRight: { x: 670, y: 760 },
  bottomLeft: { x: 110, y: 730 },
};

/**
 * Draws a synthetic photo: a white sheet with text lines over a dark
 * background, with known corners.
 *
 * @param width in pixels
 * @param height in pixels
 * @param corners where to draw the sheet
 * @returns the photo
 */
export function createDocumentPhoto(
  width: number = 800,
  height: number = 900,
  corners: Corners = DOCUMENT_PHOTO_CORNERS,
): DocumentPhoto {
  const canvas: Canvas = createCanvas(width, height);
  const context: SKRSContext2D = canvas.getContext('2d');
  const points: Corner[] = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ];

  context.fillStyle = '#3a3a3a';
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#f5f5f5';
  context.beginPath();
  points.forEach((point: Corner, index: number): void => {
    if (index) {
      context.lineTo(point.x, point.y);
    } else {
      context.moveTo(point.x, point.y);
    }
  });
  context.closePath();
  context.fill();

  context.fillStyle = '#222222';

  for (let line: number = 0; line < 12; line++) {
    context.fillRect(200, 200 + line * 40, 380, 8);
  }

  return { canvas, buffer: canvas.toBuffer('image/png'), corners };
}

/**
 * Draws a photo with no document in it (flat gray).
 *
 * @param width in pixels
 * @param height in pixels
 * @returns the photo, as a PNG
 */
export function createBlankPhoto(
  width: number = 600,
  height: number = 600,
): Buffer {
  const canvas: Canvas = createCanvas(width, height);
  const context: SKRSContext2D = canvas.getContext('2d');

  context.fillStyle = '#808080';
  context.fillRect(0, 0, width, height);

  return canvas.toBuffer('image/png');
}

/**
 * Compares two sets of corners.
 *
 * @param a a set of corners
 * @param b the other set of corners
 * @returns the largest distance between matching corners
 */
export function getMaxCornerError(a: Corners, b: Corners): number {
  const keys: (keyof Corners)[] = [
    'topLeft',
    'topRight',
    'bottomRight',
    'bottomLeft',
  ];

  return Math.max(
    ...keys.map((key: keyof Corners): number =>
      Math.hypot(a[key].x - b[key].x, a[key].y - b[key].y),
    ),
  );
}
