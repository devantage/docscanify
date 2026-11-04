import {
  type Canvas,
  createCanvas,
  type Image,
  loadImage,
} from '@napi-rs/canvas';

import { MIME_TYPE } from '../../domain/models';
import type { CanvasEnvironment } from './canvas-environment.interface';
import type { CanvasLike } from './canvas-like.interface';

/** Canvas on Node.js, with @napi-rs/canvas. */
export class NodeCanvasEnvironment implements CanvasEnvironment {
  /**
   * Creates an empty canvas.
   *
   * @param width in pixels
   * @param height in pixels
   * @returns the canvas
   */
  public createCanvas(width: number, height: number): CanvasLike {
    return createCanvas(width, height);
  }

  /**
   * Draws an encoded image on a new canvas.
   *
   * @param buffer the file, in any format @napi-rs/canvas reads
   * @returns the canvas
   * @throws if @napi-rs/canvas cannot read the file
   */
  public async decode(buffer: Uint8Array): Promise<CanvasLike> {
    const decoded: Image = await loadImage(buffer);
    const canvas: Canvas = createCanvas(decoded.width, decoded.height);

    canvas.getContext('2d').drawImage(decoded, 0, 0);

    return canvas;
  }

  /**
   * Encodes a canvas as a PNG.
   *
   * @param canvas the canvas to encode
   * @returns the PNG
   */
  public encodePng(canvas: CanvasLike): Uint8Array {
    return (canvas as unknown as Canvas).toBuffer(MIME_TYPE.PNG);
  }

  /**
   * Encodes a canvas as a JPEG.
   *
   * @param canvas the canvas to encode
   * @param quality from 1 to 100
   * @returns the JPEG
   */
  public encodeJpeg(canvas: CanvasLike, quality: number): Uint8Array {
    return (canvas as unknown as Canvas).toBuffer(MIME_TYPE.JPEG, quality);
  }
}
