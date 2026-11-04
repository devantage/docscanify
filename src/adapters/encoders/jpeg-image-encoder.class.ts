import { MIME_TYPE } from '../../domain/models';
import type { ImageEncoder } from '../../domain/ports';
import { CanvasImage } from '../canvas/canvas-image.class';

const DEFAULT_JPEG_QUALITY: number = 85;

const MIN_JPEG_QUALITY: number = 1;

const MAX_JPEG_QUALITY: number = 100;

/** What can be chosen for a JPEG. */
export interface JpegImageEncoderOptions {
  /** JPEG quality, limited to 1 to 100. Default: 85 */
  quality?: number;
}

/** Exports the document as a JPEG image. */
export class JpegImageEncoder implements ImageEncoder {
  public readonly mimeType: string = MIME_TYPE.JPEG;

  public readonly fileExtension: string = 'jpg';

  private readonly _quality: number;

  /**
   * Creates the encoder.
   *
   * @param options what can be chosen for the JPEG
   * @throws if the quality is not a number
   */
  public constructor(options: JpegImageEncoderOptions = {}) {
    const quality: number = options.quality ?? DEFAULT_JPEG_QUALITY;

    if (!Number.isFinite(quality)) {
      throw new Error('The JPEG quality must be a number');
    }

    this._quality = Math.min(
      MAX_JPEG_QUALITY,
      Math.max(MIN_JPEG_QUALITY, quality),
    );
  }

  /**
   * Encodes the document as a JPEG.
   *
   * @param buffer the document, as a PNG
   * @returns the JPEG
   */
  public async encode(buffer: Uint8Array): Promise<Uint8Array> {
    const canvasImage: CanvasImage = await CanvasImage.fromBuffer(buffer);

    return canvasImage.toJpeg(this._quality);
  }
}
