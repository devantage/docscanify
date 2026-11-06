import { type DecodedImage, MIME_TYPE } from '../../domain/models';
import type { ImageDecoder } from '../../domain/ports';
import { CanvasImage } from '../canvas/canvas-image.class';

/** How to recognize a format by the first bytes of a file. */
interface ImageSignature {
  mimeType: string;

  /** The text each part of the signature has, by its position in the file */
  parts: [number, string][];
}

/** The canvas does not tell what it read, so the first bytes of the file do. */
const IMAGE_SIGNATURES: ImageSignature[] = [
  { mimeType: MIME_TYPE.JPEG, parts: [[0, '\xff\xd8']] },
  { mimeType: MIME_TYPE.PNG, parts: [[0, '\x89PNG']] },
  {
    mimeType: 'image/webp',
    parts: [
      [0, 'RIFF'],
      [8, 'WEBP'],
    ],
  },
  { mimeType: 'image/avif', parts: [[4, 'ftypavif']] },
  { mimeType: 'image/avif', parts: [[4, 'ftypavis']] },
  { mimeType: 'image/gif', parts: [[0, 'GIF8']] },
  { mimeType: 'image/bmp', parts: [[0, 'BM']] },
  { mimeType: 'image/x-icon', parts: [[0, '\x00\x00\x01\x00']] },
  { mimeType: 'image/svg+xml', parts: [[0, '<svg']] },
  { mimeType: 'image/svg+xml', parts: [[0, '<?xml']] },
];

/**
 * The default image decoder: decodes everything to PNG, even a PNG. It accepts
 * what the canvas can read, which on browsers depends on the browser.
 */
export class CanvasImageDecoder implements ImageDecoder {
  /**
   * Reads the received file.
   *
   * @param buffer the received file
   * @returns the image as a PNG and the format of the received file
   * @throws if the canvas cannot read the file
   */
  public async decode(buffer: Uint8Array): Promise<DecodedImage> {
    const canvasImage: CanvasImage = await CanvasImage.fromBuffer(buffer);

    return {
      png: canvasImage.toPng(),
      originalMimeType: this.getMimeType(buffer),
    };
  }

  /**
   * Recognizes the format of a file by its first bytes.
   *
   * @param buffer the file
   * @returns the MIME type, or `MIME_TYPE.UNKNOWN` if no signature matches
   */
  private getMimeType(buffer: Uint8Array): string {
    const signature: ImageSignature | undefined = IMAGE_SIGNATURES.find(
      ({ parts }: ImageSignature): boolean =>
        parts.every(([offset, text]: [number, string]): boolean =>
          Array.from(text).every(
            (character: string, index: number): boolean =>
              buffer[offset + index] === character.charCodeAt(0),
          ),
        ),
    );

    return signature?.mimeType ?? MIME_TYPE.UNKNOWN;
  }
}
