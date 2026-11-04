import type { CanvasLike } from './canvas-like.interface';

/** What changes in working with a canvas from one environment to another. */
export interface CanvasEnvironment {
  /**
   * Creates an empty canvas.
   *
   * @param width in pixels
   * @param height in pixels
   * @returns the canvas
   */
  createCanvas(width: number, height: number): CanvasLike;

  /**
   * Draws an encoded image on a new canvas.
   *
   * @param buffer the file
   * @returns the canvas
   * @throws if the environment cannot read the file
   */
  decode(buffer: Uint8Array): Promise<CanvasLike>;

  /**
   * Encodes a canvas as a PNG.
   *
   * @param canvas the canvas to encode
   * @returns the PNG
   */
  encodePng(canvas: CanvasLike): Uint8Array;

  /**
   * Encodes a canvas as a JPEG.
   *
   * @param canvas the canvas to encode
   * @param quality from 1 to 100
   * @returns the JPEG
   */
  encodeJpeg(canvas: CanvasLike, quality: number): Uint8Array;
}
