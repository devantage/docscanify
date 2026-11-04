import { type FileMetadata, type ImageDimensions, MIME_TYPE } from '../models';

/** The start of the signature of a PNG */
const PNG_SIGNATURE: number[] = [0x89, 0x50, 0x4e, 0x47];

/** The signature (8 bytes) and the start of the IHDR chunk, up to its width and height */
const PNG_HEADER_SIZE: number = 24;

const PNG_WIDTH_OFFSET: number = 16;

const PNG_HEIGHT_OFFSET: number = 20;

/** What a file is created with. */
export interface FileContentProperties {
  /** The bytes of the file */
  buffer: Uint8Array;

  /** For example, `image/png` */
  mimeType: string;

  /** Dimensions of the image, in pixels */
  dimensions: ImageDimensions;

  /** Default: null */
  name?: string | null;
}

/**
 * A file the document holds: its bytes and its characteristics. It never shares
 * its bytes, so nothing outside of it can change them.
 */
export class FileContent {
  private readonly _buffer: Uint8Array;

  private readonly _name: string | null;

  private readonly _mimeType: string;

  private readonly _dimensions: ImageDimensions;

  /**
   * Keeps a copy of the bytes and of the dimensions.
   *
   * @param properties the bytes and the characteristics of the file
   */
  public constructor(properties: FileContentProperties) {
    this._buffer = new Uint8Array(properties.buffer);
    this._name = properties.name ?? null;
    this._mimeType = properties.mimeType;
    this._dimensions = { ...properties.dimensions };
  }

  /**
   * Creates a file from a PNG, reading its dimensions from the header.
   *
   * @param buffer the bytes of the PNG
   * @returns the file
   * @throws if the buffer is not a PNG
   */
  public static fromPng(buffer: Uint8Array): FileContent {
    if (
      buffer.length < PNG_HEADER_SIZE ||
      !PNG_SIGNATURE.every(
        (byte: number, index: number): boolean => buffer[index] === byte,
      )
    ) {
      throw new Error('Invalid image, expected a PNG');
    }

    const view: DataView = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );

    return new FileContent({
      buffer,
      mimeType: MIME_TYPE.PNG,
      dimensions: {
        width: view.getUint32(PNG_WIDTH_OFFSET),
        height: view.getUint32(PNG_HEIGHT_OFFSET),
      },
    });
  }

  /**
   * Gets the bytes of the file.
   *
   * @returns a copy of the bytes
   */
  public toBuffer(): Uint8Array {
    return new Uint8Array(this._buffer);
  }

  /**
   * Compares the bytes of two files.
   *
   * @param file the file to compare to
   * @returns whether the bytes are the same
   */
  public hasSameBytes(file: FileContent): boolean {
    return (
      this._buffer.length === file._buffer.length &&
      this._buffer.every(
        (byte: number, index: number): boolean => byte === file._buffer[index],
      )
    );
  }

  /**
   * Gets the dimensions of the image.
   *
   * @returns a copy of the dimensions
   */
  public getDimensions(): ImageDimensions {
    return { ...this._dimensions };
  }

  /**
   * Describes the file.
   *
   * @returns the characteristics of the file
   */
  public toMetadata(): FileMetadata {
    return {
      name: this._name,
      mimeType: this._mimeType,
      dimensions: this.getDimensions(),
      size: this._buffer.length,
    };
  }
}
