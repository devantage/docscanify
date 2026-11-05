import { MIME_TYPE } from '../../domain/models';
import type { CanvasEnvironment } from './canvas-environment.interface';
import type { CanvasLike } from './canvas-like.interface';

/** Canvas on browsers, with the DOM. */
export class BrowserCanvasEnvironment implements CanvasEnvironment {
  /**
   * Creates an empty canvas element.
   *
   * @param width in pixels
   * @param height in pixels
   * @returns the canvas
   */
  public createCanvas(width: number, height: number): CanvasLike {
    const canvas: HTMLCanvasElement = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    return canvas;
  }

  /**
   * Draws an encoded image on a new canvas.
   *
   * @param buffer the file, in any format the browser reads
   * @returns the canvas
   * @throws if the browser cannot read the file
   */
  public async decode(buffer: Uint8Array): Promise<CanvasLike> {
    const bitmap: ImageBitmap = await createImageBitmap(
      new Blob([buffer as BlobPart]),
    );
    const canvas: CanvasLike = this.createCanvas(bitmap.width, bitmap.height);

    (canvas.getContext('2d') as unknown as CanvasRenderingContext2D).drawImage(
      bitmap,
      0,
      0,
    );
    bitmap.close();

    return canvas;
  }

  /**
   * Encodes a canvas as a PNG.
   *
   * @param canvas the canvas to encode
   * @returns the PNG
   */
  public encodePng(canvas: CanvasLike): Uint8Array {
    return this.fromDataUrl(
      (canvas as unknown as HTMLCanvasElement).toDataURL(MIME_TYPE.PNG),
    );
  }

  /**
   * Encodes a canvas as a JPEG.
   *
   * @param canvas the canvas to encode
   * @param quality from 1 to 100
   * @returns the JPEG
   */
  public encodeJpeg(canvas: CanvasLike, quality: number): Uint8Array {
    return this.fromDataUrl(
      (canvas as unknown as HTMLCanvasElement).toDataURL(
        MIME_TYPE.JPEG,
        quality / 100,
      ),
    );
  }

  /**
   * Reads the bytes of a base64 data URL.
   *
   * @param dataUrl the data URL
   * @returns the bytes
   */
  private fromDataUrl(dataUrl: string): Uint8Array {
    return Uint8Array.from(
      atob(dataUrl.slice(dataUrl.indexOf(',') + 1)),
      (character: string): number => character.charCodeAt(0),
    );
  }
}
