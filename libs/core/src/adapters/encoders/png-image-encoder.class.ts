import { MIME_TYPE } from '../../domain/models';
import type { ImageEncoder } from '../../domain/ports';

/**
 * The default image encoder: exports the document as it is, because its buffer
 * is always a PNG.
 */
export class PngImageEncoder implements ImageEncoder {
  public readonly mimeType: string = MIME_TYPE.PNG;

  public readonly fileExtension: string = 'png';

  /**
   * Exports the document as it is.
   *
   * @param buffer the document, as a PNG
   * @returns the same buffer
   */
  public async encode(buffer: Uint8Array): Promise<Uint8Array> {
    return Promise.resolve(buffer);
  }
}
