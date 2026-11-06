import type { DecodedImage, ImageDimensions } from '../models';
import type { ImageDecoder, ImageResizer } from '../ports';
import { FileContent } from '../value-objects/file-content.class';
import { ImageScale } from '../value-objects/image-scale.class';

const DEFAULT_MAX_DIMENSION: number = 3000;

const MIN_MAX_DIMENSION: number = 1;

/** What can be chosen when receiving a file. */
export interface DocumentIngestionOptions {
  /** Name of the original file, kept in `originalFile`. Default: null */
  name?: string;

  /** Longest side (px) of the image before processing. Default: 3000 */
  maxDimension?: number;
}

/** A received file, ready to work on. */
export interface IngestedDocument {
  /** The received file, as it came */
  originalFile: FileContent;

  /** The original file as a PNG, resized by `scale`: what the document works on. It is `originalFile` itself when they have the same bytes */
  workingFile: FileContent;

  /** How much `workingFile` was resized from the received file */
  scale: ImageScale;
}

/** Turns a received file into what a document works on. */
export class DocumentIngestion {
  private readonly _imageDecoder: ImageDecoder;

  private readonly _imageResizer: ImageResizer;

  /**
   * Receives what the ingestion depends on.
   *
   * @param imageDecoder reads the received file
   * @param imageResizer shrinks an image larger than `maxDimension`
   */
  public constructor(imageDecoder: ImageDecoder, imageResizer: ImageResizer) {
    this._imageDecoder = imageDecoder;
    this._imageResizer = imageResizer;
  }

  /**
   * Reads a received file and shrinks it if needed.
   *
   * @param buffer the received file, which is copied
   * @param options what can be chosen for this file
   * @returns the original file and the one to work on
   * @throws if the decoder cannot read the file, if an adapter does not return
   * a PNG, or if `maxDimension` is below 1
   */
  public async ingest(
    buffer: Uint8Array,
    options: DocumentIngestionOptions = {},
  ): Promise<IngestedDocument> {
    const maxDimension: number = options.maxDimension ?? DEFAULT_MAX_DIMENSION;

    if (!Number.isFinite(maxDimension) || maxDimension < MIN_MAX_DIMENSION) {
      throw new Error('maxDimension must be at least 1');
    }

    // Whoever called may change its buffer while the decoder runs
    const receivedBuffer: Uint8Array = new Uint8Array(buffer);
    const decodedImage: DecodedImage = await this._imageDecoder.decode(
      new Uint8Array(receivedBuffer),
    );
    const fullSizeFile: FileContent = FileContent.fromPng(decodedImage.png);
    const dimensions: ImageDimensions = fullSizeFile.getDimensions();
    const scale: ImageScale = ImageScale.toFit(dimensions, maxDimension);
    const originalFile: FileContent = new FileContent({
      buffer: receivedBuffer,
      name: options.name,
      mimeType: decodedImage.originalMimeType,
      dimensions,
    });

    if (!scale.keepsOriginal()) {
      return {
        originalFile,
        workingFile: FileContent.fromPng(
          await this._imageResizer.resize(
            fullSizeFile.toBuffer(),
            scale.dimensionsFromOriginal(dimensions),
          ),
        ),
        scale,
      };
    }

    return {
      originalFile,
      workingFile: originalFile.hasSameBytes(fullSizeFile)
        ? originalFile
        : fullSizeFile,
      scale,
    };
  }
}
