import {
  type Canvas,
  createCanvas,
  type Image,
  loadImage,
} from '@napi-rs/canvas';

/**
 * Decodes a file to a canvas, to look at its pixels.
 *
 * @param buffer the file
 * @returns the canvas
 */
export async function decodeToCanvas(buffer: Uint8Array): Promise<Canvas> {
  const image: Image = await loadImage(buffer);
  const canvas: Canvas = createCanvas(image.width, image.height);

  canvas.getContext('2d').drawImage(image, 0, 0);

  return canvas;
}
