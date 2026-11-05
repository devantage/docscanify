import {
  createBlankPhoto,
  createDocumentPhoto,
  DOCUMENT_PHOTO_CORNERS,
  getMaxCornerError,
} from '../../../test-helpers';
import { DocumentScanner, type ScanResult } from './document-scanner.class';

const PDF_HEADER: string = '%PDF-';

const PNG_SIGNATURE: Buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const JPEG_SIGNATURE: Buffer = Buffer.from([0xff, 0xd8, 0xff]);

function startsWith(data: Buffer, signature: Buffer): boolean {
  return data.subarray(0, signature.length).equals(signature);
}

describe('DocumentScanner', (): void => {
  const scanner: DocumentScanner = new DocumentScanner();
  const photo: Buffer = createDocumentPhoto().buffer;

  it('detects the document and outputs an A4 PDF by default', async (): Promise<void> => {
    const result: ScanResult = await scanner.scan(photo);

    expect(result.data.subarray(0, 5).toString()).toBe(PDF_HEADER);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.fileExtension).toBe('pdf');
    expect(result.detected).toBe(true);
    expect(result.corners).not.toBeNull();
    expect(
      getMaxCornerError(
        result.corners ?? DOCUMENT_PHOTO_CORNERS,
        DOCUMENT_PHOTO_CORNERS,
      ),
    ).toBeLessThan(10);
  });

  it('outputs a JPEG image', async (): Promise<void> => {
    const result: ScanResult = await scanner.scan(photo, {
      outputFormat: 'image',
    });

    expect(startsWith(result.data, JPEG_SIGNATURE)).toBe(true);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.fileExtension).toBe('jpg');
  });

  it('outputs a PNG image with the black and white filter', async (): Promise<void> => {
    const result: ScanResult = await scanner.scan(photo, {
      outputFormat: 'image',
      filter: 'bw',
    });

    expect(startsWith(result.data, PNG_SIGNATURE)).toBe(true);
    expect(result.mimeType).toBe('image/png');
    expect(result.fileExtension).toBe('png');
  });

  it('applies the grayscale filter', async (): Promise<void> => {
    const result: ScanResult = await scanner.scan(photo, {
      outputFormat: 'image',
      filter: 'grayscale',
    });

    expect(result.mimeType).toBe('image/jpeg');
  });

  it('rotates the document, swapping its dimensions on a quarter turn', async (): Promise<void> => {
    const straight: ScanResult = await scanner.scan(photo, {
      outputFormat: 'image',
    });
    const rotated: ScanResult = await scanner.scan(photo, {
      outputFormat: 'image',
      rotation: 90,
    });

    expect(rotated.width).toBe(straight.height);
    expect(rotated.height).toBe(straight.width);
    // The corners stay in the original image
    expect(rotated.corners).toEqual(straight.corners);
  });

  it('keeps the dimensions on a half turn', async (): Promise<void> => {
    const straight: ScanResult = await scanner.scan(photo, {
      outputFormat: 'image',
    });
    const rotated: ScanResult = await scanner.scan(photo, {
      outputFormat: 'image',
      rotation: 180,
    });

    expect([rotated.width, rotated.height]).toEqual([
      straight.width,
      straight.height,
    ]);
  });

  it('reduces the noise and sharpens the document', async (): Promise<void> => {
    const result: ScanResult = await scanner.scan(photo, {
      outputFormat: 'image',
      noiseReduction: true,
      sharpness: 'strong',
    });

    expect(result.detected).toBe(true);
    expect(startsWith(result.data, JPEG_SIGNATURE)).toBe(true);
  });

  it.each(['letter', 'image'] as const)(
    'outputs a PDF with the %s page size and a margin',
    async (pageSize: 'letter' | 'image'): Promise<void> => {
      const result: ScanResult = await scanner.scan(photo, {
        pageSize,
        margin: 36,
      });

      expect(result.data.subarray(0, 5).toString()).toBe(PDF_HEADER);
    },
  );

  it('downscales the image to the max dimension, keeping the corners in the original image', async (): Promise<void> => {
    const result: ScanResult = await scanner.scan(photo, {
      outputFormat: 'image',
      maxDimension: 500,
    });

    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(500);
    expect(
      getMaxCornerError(
        result.corners ?? DOCUMENT_PHOTO_CORNERS,
        DOCUMENT_PHOTO_CORNERS,
      ),
    ).toBeLessThan(15);
  });

  it('logs the candidate quadrilaterals with DEBUG_SCAN', async (): Promise<void> => {
    const error: jest.SpyInstance<void, unknown[]> = jest
      .spyOn(console, 'error')
      .mockImplementation((): void => undefined);
    let messages: unknown[][];

    process.env.DEBUG_SCAN = '1';

    try {
      await new DocumentScanner().scan(photo);
    } finally {
      messages = [...error.mock.calls];
      delete process.env.DEBUG_SCAN;
      error.mockRestore();
    }

    const candidates: Record<string, unknown>[] = JSON.parse(
      String(messages[0][0]),
    ) as Record<string, unknown>[];

    expect(candidates.length).toBeGreaterThan(0);
    expect(Object.keys(candidates[0])).toEqual([
      'topLeftCorner',
      'topRightCorner',
      'bottomLeftCorner',
      'bottomRightCorner',
      'area',
      'support',
    ]);
    expect(typeof candidates[0].support).toBe('number');
  });

  it('logs nothing without DEBUG_SCAN', async (): Promise<void> => {
    const error: jest.SpyInstance = jest.spyOn(console, 'error');

    await new DocumentScanner().scan(photo);

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('throws when no document is detected', async (): Promise<void> => {
    await expect(scanner.scan(createBlankPhoto())).rejects.toThrow(
      'No document detected in the image',
    );
  });

  it('uses the whole image when no document is detected and onNotDetected is original', async (): Promise<void> => {
    const result: ScanResult = await scanner.scan(createBlankPhoto(600, 400), {
      outputFormat: 'image',
      onNotDetected: 'original',
    });

    expect(result.detected).toBe(false);
    expect(result.corners).toBeNull();
    expect([result.width, result.height]).toEqual([600, 400]);
  });
});
