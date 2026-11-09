import { DEFAULT_ADAPTERS } from './default-adapters';
import { DocumentScanner } from './document-scanner.class';
import type { Corners, DocumentOutput } from './domain/models';
import {
  createBlankPhoto,
  createDocumentPhoto,
  DOCUMENT_PHOTO_CORNERS,
  getMaxCornerError,
} from './test-helpers';

const PDF_HEADER: string = '%PDF-';

const PNG_SIGNATURE: Buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const JPEG_SIGNATURE: Buffer = Buffer.from([0xff, 0xd8, 0xff]);

/**
 * Checks the first bytes of a file.
 *
 * @param data the file
 * @param signature the bytes it must start with
 * @returns whether the file starts with the signature
 */
function startsWith(data: Uint8Array, signature: Buffer): boolean {
  return Buffer.from(data.subarray(0, signature.length)).equals(signature);
}

describe('DocumentScanner', (): void => {
  const scanner: DocumentScanner = new DocumentScanner();
  const photo: Buffer = createDocumentPhoto().buffer;

  it('detects the document and outputs an A4 PDF by default', async (): Promise<void> => {
    const { file, report }: DocumentOutput = await scanner.scan(photo);

    expect(Buffer.from(file.buffer.subarray(0, 5)).toString()).toBe(PDF_HEADER);
    expect(file.mimeType).toBe('application/pdf');
    expect(file.fileExtension).toBe('pdf');
    expect(report.corners).not.toBeNull();
    expect(
      getMaxCornerError(
        report.corners ?? DOCUMENT_PHOTO_CORNERS,
        DOCUMENT_PHOTO_CORNERS,
      ),
    ).toBeLessThan(10);
  });

  it('keeps the name of the original file in the report', async (): Promise<void> => {
    const { report }: DocumentOutput = await scanner.scan(photo, {
      name: 'photo.png',
    });

    expect(report.originalFile.name).toBe('photo.png');
  });

  it('outputs a JPEG image', async (): Promise<void> => {
    const { file }: DocumentOutput = await scanner.scan(photo, {
      outputFormat: 'image',
    });

    expect(startsWith(file.buffer, JPEG_SIGNATURE)).toBe(true);
    expect(file.mimeType).toBe('image/jpeg');
    expect(file.fileExtension).toBe('jpg');
  });

  it('outputs a PNG image with the black and white filter', async (): Promise<void> => {
    const { file }: DocumentOutput = await scanner.scan(photo, {
      outputFormat: 'image',
      filter: 'bw',
    });

    expect(startsWith(file.buffer, PNG_SIGNATURE)).toBe(true);
    expect(file.mimeType).toBe('image/png');
    expect(file.fileExtension).toBe('png');
  });

  it('applies the grayscale filter', async (): Promise<void> => {
    const { file }: DocumentOutput = await scanner.scan(photo, {
      outputFormat: 'image',
      filter: 'grayscale',
    });

    expect(file.mimeType).toBe('image/jpeg');
  });

  it('rotates the document, swapping its dimensions on a quarter turn', async (): Promise<void> => {
    const straight: DocumentOutput = await scanner.scan(photo, {
      outputFormat: 'image',
    });
    const rotated: DocumentOutput = await scanner.scan(photo, {
      outputFormat: 'image',
      rotation: 90,
    });

    expect(rotated.report.dimensions).toEqual({
      width: straight.report.dimensions.height,
      height: straight.report.dimensions.width,
    });
    // The corners stay in the original image
    expect(rotated.report.corners).toEqual(straight.report.corners);
  });

  it('keeps the dimensions on a half turn', async (): Promise<void> => {
    const straight: DocumentOutput = await scanner.scan(photo, {
      outputFormat: 'image',
    });
    const rotated: DocumentOutput = await scanner.scan(photo, {
      outputFormat: 'image',
      rotation: 180,
    });

    expect(rotated.report.dimensions).toEqual(straight.report.dimensions);
  });

  it('reduces the noise and sharpens the document', async (): Promise<void> => {
    const { file, report }: DocumentOutput = await scanner.scan(photo, {
      outputFormat: 'image',
      noiseReduction: true,
      sharpness: 'strong',
    });

    expect(report.corners).not.toBeNull();
    expect(startsWith(file.buffer, JPEG_SIGNATURE)).toBe(true);
  });

  it.each(['letter', 'image'] as const)(
    'outputs a PDF with the %s page size and a margin',
    async (pageSize: 'letter' | 'image'): Promise<void> => {
      const { file }: DocumentOutput = await scanner.scan(photo, {
        pageSize,
        margin: 36,
      });

      expect(Buffer.from(file.buffer.subarray(0, 5)).toString()).toBe(
        PDF_HEADER,
      );
    },
  );

  it('downscales the image to the max dimension, keeping the corners in the original image', async (): Promise<void> => {
    const { report }: DocumentOutput = await scanner.scan(photo, {
      outputFormat: 'image',
      maxDimension: 500,
    });

    expect(
      Math.max(report.dimensions.width, report.dimensions.height),
    ).toBeLessThanOrEqual(500);
    expect(
      getMaxCornerError(
        report.corners ?? DOCUMENT_PHOTO_CORNERS,
        DOCUMENT_PHOTO_CORNERS,
      ),
    ).toBeLessThan(15);
  });

  it('uses the given adapters', async (): Promise<void> => {
    const corners: Corners = {
      topLeft: { x: 100, y: 100 },
      topRight: { x: 500, y: 100 },
      bottomRight: { x: 500, y: 600 },
      bottomLeft: { x: 100, y: 600 },
    };
    const detect: jest.Mock = jest.fn().mockResolvedValue(corners);
    const { report }: DocumentOutput = await new DocumentScanner({
      ...DEFAULT_ADAPTERS,
      cornersDetector: { detect },
    }).scan(photo);

    expect(detect).toHaveBeenCalledTimes(1);
    expect(report.corners).toEqual(corners);
  });

  it('throws when no document is detected', async (): Promise<void> => {
    await expect(scanner.scan(createBlankPhoto())).rejects.toThrow(
      'No document detected in the image',
    );
  });

  it('uses the whole image when no document is detected and onNotDetected is original', async (): Promise<void> => {
    const { report }: DocumentOutput = await scanner.scan(
      createBlankPhoto(600, 400),
      { outputFormat: 'image', onNotDetected: 'original' },
    );

    expect(report.corners).toBeNull();
    expect(report.dimensions).toEqual({ width: 600, height: 400 });
  });
});
