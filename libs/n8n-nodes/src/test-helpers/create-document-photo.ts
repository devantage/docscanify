import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

import type { ScanCorners, ScanPoint } from '../resources/document/shared';

export interface DocumentPhoto {
  canvas: Canvas;

  buffer: Buffer;

  corners: ScanCorners;
}

export const DOCUMENT_PHOTO_CORNERS: ScanCorners = {
  topLeftCorner: { x: 140, y: 90 },
  topRightCorner: { x: 640, y: 120 },
  bottomRightCorner: { x: 670, y: 760 },
  bottomLeftCorner: { x: 110, y: 730 },
};

/**
 * Draws a synthetic photo: a white sheet with text lines over a dark
 * background, with known corners.
 */
export function createDocumentPhoto(
  width: number = 800,
  height: number = 900,
  corners: ScanCorners = DOCUMENT_PHOTO_CORNERS,
): DocumentPhoto {
  const canvas: Canvas = createCanvas(width, height);
  const context: SKRSContext2D = canvas.getContext('2d');
  const points: ScanPoint[] = [
    corners.topLeftCorner,
    corners.topRightCorner,
    corners.bottomRightCorner,
    corners.bottomLeftCorner,
  ];

  context.fillStyle = '#3a3a3a';
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#f5f5f5';
  context.beginPath();
  points.forEach((point: ScanPoint, index: number): void => {
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

/** Draws a photo with no document in it (flat gray). */
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

/** Largest distance between matching corners of `a` and `b`. */
export function getMaxCornerError(a: ScanCorners, b: ScanCorners): number {
  const keys: (keyof ScanCorners)[] = [
    'topLeftCorner',
    'topRightCorner',
    'bottomRightCorner',
    'bottomLeftCorner',
  ];

  return Math.max(
    ...keys.map((key: keyof ScanCorners): number =>
      Math.hypot(a[key].x - b[key].x, a[key].y - b[key].y),
    ),
  );
}
