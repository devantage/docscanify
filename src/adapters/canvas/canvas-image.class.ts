import type { ImageDimensions } from '../../domain/models';
import { Runtime } from '../runtime.class';
import { BrowserCanvasEnvironment } from './browser-canvas-environment.class';
import type { CanvasEnvironment } from './canvas-environment.interface';
import type {
  CanvasContextLike,
  CanvasImageDataLike,
  CanvasLike,
} from './canvas-like.interface';
import { NodeCanvasEnvironment } from './node-canvas-environment.class';
import type { RawImage } from './raw-image.interface';

/**
 * An image in memory: a @napi-rs/canvas `Canvas` on Node.js or an
 * `HTMLCanvasElement` on browsers.
 */
export class CanvasImage {
  private readonly _canvas: CanvasLike;

  /**
   * Wraps a canvas.
   *
   * @param canvas the canvas with the image
   */
  public constructor(canvas: CanvasLike) {
    this._canvas = canvas;
  }

  /**
   * Decodes an encoded image (JPEG, PNG...).
   *
   * @param buffer the file
   * @returns the image
   * @throws if the environment cannot read the file
   */
  public static async fromBuffer(buffer: Uint8Array): Promise<CanvasImage> {
    return new CanvasImage(await CanvasImage.getEnvironment().decode(buffer));
  }

  /**
   * Draws RGBA pixels on a new image.
   *
   * @param raw the pixels and their dimensions
   * @returns the image
   */
  public static fromRaw(raw: RawImage): CanvasImage {
    const { width, height } = raw.dimensions;
    const canvasImage: CanvasImage = CanvasImage.create(width, height);
    const context: CanvasContextLike = canvasImage.getContext();
    const imageData: CanvasImageDataLike = context.createImageData(
      width,
      height,
    );

    imageData.data.set(raw.data);
    context.putImageData(imageData as never, 0, 0);

    return canvasImage;
  }

  /**
   * Creates an empty image.
   *
   * @param width in pixels
   * @param height in pixels
   * @returns the image
   */
  private static create(width: number, height: number): CanvasImage {
    return new CanvasImage(
      CanvasImage.getEnvironment().createCanvas(width, height),
    );
  }

  /**
   * Picks the canvas implementation of the current environment.
   *
   * @returns the environment
   */
  private static getEnvironment(): CanvasEnvironment {
    return Runtime.isNode()
      ? new NodeCanvasEnvironment()
      : new BrowserCanvasEnvironment();
  }

  /**
   * Gets the dimensions of the image.
   *
   * @returns the dimensions, in pixels
   */
  public getDimensions(): ImageDimensions {
    return { width: this._canvas.width, height: this._canvas.height };
  }

  /**
   * Reads the pixels of the image.
   *
   * @returns the RGBA pixels
   */
  public getImageData(): CanvasImageDataLike {
    const { width, height } = this.getDimensions();

    return this.getContext().getImageData(0, 0, width, height);
  }

  /**
   * Encodes the image as a PNG.
   *
   * @returns the PNG
   */
  public toPng(): Uint8Array {
    return CanvasImage.getEnvironment().encodePng(this._canvas);
  }

  /**
   * Encodes the image as a JPEG.
   *
   * @param quality from 1 to 100
   * @returns the JPEG
   */
  public toJpeg(quality: number): Uint8Array {
    return CanvasImage.getEnvironment().encodeJpeg(this._canvas, quality);
  }

  /**
   * Gets the 2D context of the canvas.
   *
   * @returns the context
   */
  private getContext(): CanvasContextLike {
    return this._canvas.getContext('2d') as CanvasContextLike;
  }
}
