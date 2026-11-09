import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

/**
 * Draws a synthetic photo: a white sheet with text lines over a dark
 * background, with its corners at about (140, 90), (640, 120), (670, 760)
 * and (110, 730).
 *
 * @returns the photo, as a PNG
 */
export function createDocumentPhoto(): Buffer {
  const canvas: Canvas = createCanvas(800, 900);
  const context: SKRSContext2D = canvas.getContext('2d');

  context.fillStyle = '#3a3a3a';
  context.fillRect(0, 0, 800, 900);

  context.fillStyle = '#f5f5f5';
  context.beginPath();
  context.moveTo(140, 90);
  context.lineTo(640, 120);
  context.lineTo(670, 760);
  context.lineTo(110, 730);
  context.closePath();
  context.fill();

  context.fillStyle = '#222222';

  for (let line: number = 0; line < 12; line++) {
    context.fillRect(200, 200 + line * 40, 380, 8);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Draws a photo with no document in it (flat gray).
 *
 * @returns the photo, as a PNG
 */
export function createBlankPhoto(): Buffer {
  const canvas: Canvas = createCanvas(600, 400);
  const context: SKRSContext2D = canvas.getContext('2d');

  context.fillStyle = '#808080';
  context.fillRect(0, 0, 600, 400);

  return canvas.toBuffer('image/png');
}
