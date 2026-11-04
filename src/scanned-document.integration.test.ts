import {
  type Canvas,
  createCanvas,
  type Image,
  loadImage,
} from '@napi-rs/canvas';
import { PDFDocument, type PDFPage } from 'pdf-lib';

import { CanvasImage } from './adapters/canvas/canvas-image.class';
import { JpegImageEncoder } from './adapters/encoders/jpeg-image-encoder.class';
import { PdfDocumentEncoder } from './adapters/encoders/pdf-document-encoder.class';
import { PngImageEncoder } from './adapters/encoders/png-image-encoder.class';
import { OpenCvBlackAndWhiteFilter } from './adapters/opencv/opencv-black-and-white-filter.class';
import { OpenCvGrayscaleFilter } from './adapters/opencv/opencv-grayscale-filter.class';
import { OpenCvNoiseReductionEnhancer } from './adapters/opencv/opencv-noise-reduction-enhancer.class';
import { OpenCvRotationEnhancer } from './adapters/opencv/opencv-rotation-enhancer.class';
import { OpenCvSharpnessEnhancer } from './adapters/opencv/opencv-sharpness-enhancer.class';
import { DEFAULT_ADAPTERS } from './default-adapters';
import {
  ScannedDocument,
  type ScannedDocumentOptions,
} from './domain/entities/scanned-document.class';
import type {
  Corners,
  DecodedImage,
  DocumentOutput,
  FileMetadata,
  ScanReport,
} from './domain/models';
import type {
  CornersDetector,
  ImageDecoder,
  ImageEncoder,
  ImageFilter,
  PdfEncoder,
} from './domain/ports';
import {
  createBlankPhoto,
  createDocumentPhoto,
  decodeToCanvas,
  type DocumentPhoto,
  getMaxCornerError,
} from './test-helpers';

function getPixels(canvas: Canvas): Uint8ClampedArray {
  return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
    .data;
}

function isBlackAndWhite(canvas: Canvas): boolean {
  return getPixels(canvas).every(
    (value: number): boolean => value === 0 || value === 255,
  );
}

class FakeImageEncoder implements ImageEncoder {
  public readonly mimeType: string = 'image/webp';

  public readonly fileExtension: string = 'webp';

  public constructor(
    public readonly encode: (buffer: Uint8Array) => Promise<Uint8Array>,
  ) {}
}

class FakePdfEncoder implements PdfEncoder {
  public readonly mimeType: string = 'application/x-fake-pdf';

  public readonly fileExtension: string = 'fakepdf';

  public constructor(
    public readonly encode: (buffer: Uint8Array) => Promise<Uint8Array>,
  ) {}
}

async function fromImage(
  input: Buffer,
  options?: ScannedDocumentOptions,
  decoder?: ImageDecoder,
): Promise<ScannedDocument> {
  return ScannedDocument.fromImage(
    input,
    decoder ? { ...DEFAULT_ADAPTERS, imageDecoder: decoder } : DEFAULT_ADAPTERS,
    options,
  );
}

type CanvasOutput = ScanReport & { canvas: Canvas };

async function toCanvas(document: ScannedDocument): Promise<CanvasOutput> {
  const { file, report } = await document.toImage();

  return { ...report, canvas: await decodeToCanvas(file.buffer) };
}

async function scan(input: Buffer): Promise<ScannedDocument> {
  const document: ScannedDocument = await fromImage(input);

  await document.detectCorners();

  return document;
}

describe('ScannedDocument', (): void => {
  const photo: DocumentPhoto = createDocumentPhoto();

  describe('fromImage', (): void => {
    it('keeps the whole image until the corners are detected', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      expect(await toCanvas(document)).toMatchObject({
        corners: null,
        dimensions: { width: 600, height: 400 },
      });
    });

    it('resizes the image', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(1200, 800),
        { maxDimension: 600 },
      );

      expect(await toCanvas(document)).toMatchObject({
        dimensions: { width: 600, height: 400 },
      });
    });
  });

  describe('input formats', (): void => {
    it.each<[string, string, string]>([
      ['GIF', 'image/gif', 'R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='],
      [
        'SVG',
        'image/svg+xml',
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
        ).toString('base64'),
      ],
    ])(
      'reads a %s file',
      async (
        _format: string,
        mimeType: string,
        file: string,
      ): Promise<void> => {
        const document: ScannedDocument = await fromImage(
          Buffer.from(file, 'base64'),
        );

        expect((await document.toImage()).report.originalFile).toMatchObject({
          mimeType,
          dimensions: { width: 1, height: 1 },
        });
      },
    );

    it.each<[string, () => Buffer]>([
      ['image/jpeg', (): Buffer => photo.canvas.toBuffer('image/jpeg', 95)],
      ['image/png', (): Buffer => photo.canvas.toBuffer('image/png')],
      ['image/webp', (): Buffer => photo.canvas.toBuffer('image/webp', 95)],
      ['image/avif', (): Buffer => photo.canvas.toBuffer('image/avif')],
    ])(
      'scans a %s file',
      async (mimeType: string, encode: () => Buffer): Promise<void> => {
        const document: ScannedDocument = await fromImage(encode());

        await document.detectCorners();

        const output: DocumentOutput = await document.toImage();

        expect(output.file.mimeType).toBe('image/png');
        expect(output.report.originalFile.mimeType).toBe(mimeType);
        expect(
          getMaxCornerError(output.report.corners as Corners, photo.corners),
        ).toBeLessThan(10);
      },
    );

    it.each<[string, () => Buffer]>([
      ['TIFF', (): Buffer => Buffer.from([0x49, 0x49, 0x2a, 0x00])],
      ['HEIC', (): Buffer => Buffer.from('\0\0\0\x18ftypheic')],
      ['random bytes', (): Buffer => Buffer.from([1, 2, 3, 4])],
      ['an empty file', (): Buffer => Buffer.alloc(0)],
    ])(
      'rejects a %s file',
      async (_format: string, encode: () => Buffer): Promise<void> => {
        await expect(fromImage(encode())).rejects.toThrow();
      },
    );

    it('rejects a corrupted file of an accepted format', async (): Promise<void> => {
      await expect(
        fromImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
      ).rejects.toThrow();
    });

    it('reads a format through the given decoder, which tells its type', async (): Promise<void> => {
      const file: Buffer = Buffer.from([1, 2, 3, 4]);
      const decoder: ImageDecoder = {
        decode: async (): Promise<DecodedImage> =>
          Promise.resolve({
            png: photo.buffer,
            originalMimeType: 'image/x-custom',
          }),
      };
      const document: ScannedDocument = await fromImage(file, {}, decoder);

      await document.detectCorners();

      const output: DocumentOutput = await document.toImage();

      expect(output.report.corners).not.toBeNull();
      expect(output.report.originalFile).toMatchObject({
        mimeType: 'image/x-custom',
        size: 4,
      });
      expect(Buffer.from(document.toOriginalBuffer()).equals(file)).toBe(true);
    });

    it('rejects when the decoder rejects', async (): Promise<void> => {
      await expect(
        fromImage(
          photo.buffer,
          {},
          {
            decode: async (): Promise<DecodedImage> =>
              Promise.reject(new Error('Failed')),
          },
        ),
      ).rejects.toThrow('Failed');
    });

    it('does not let the decoder change the original buffer', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        photo.buffer,
        {},
        {
          decode: async (buffer: Uint8Array): Promise<DecodedImage> => {
            const copy: Uint8Array = new Uint8Array(buffer);

            buffer.fill(0);

            return Promise.resolve({
              png: copy,
              originalMimeType: 'image/png',
            });
          },
        },
      );

      expect(
        Buffer.from(document.toOriginalBuffer()).equals(photo.buffer),
      ).toBe(true);
    });
  });

  describe('rendered document', (): void => {
    it.each<[string, () => Buffer]>([
      ['JPEG', (): Buffer => photo.canvas.toBuffer('image/jpeg')],
      ['PNG', (): Buffer => photo.canvas.toBuffer('image/png')],
    ])(
      'is a PNG from the ingestion of a %s file',
      async (_format: string, encode: () => Buffer): Promise<void> => {
        const document: ScannedDocument = await fromImage(encode());
        let received: Uint8Array = new Uint8Array();

        await document.toPdf(
          new FakePdfEncoder(
            async (buffer: Uint8Array): Promise<Uint8Array> => {
              received = buffer;

              return Promise.resolve(buffer);
            },
          ),
        );

        expect(Buffer.from(received).subarray(1, 4).toString()).toBe('PNG');
      },
    );

    it('is the result of the decoder when the image is not resized', async (): Promise<void> => {
      const png: Buffer = photo.canvas.toBuffer('image/png');
      const document: ScannedDocument = await fromImage(png);

      expect(
        Buffer.from((await document.toImage()).file.buffer).equals(png),
      ).toBe(true);
    });

    it('is a PNG of the resized image when the image is resized', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        photo.canvas.toBuffer('image/png'),
        { maxDimension: 300 },
      );
      const { file, report } = await document.toImage();
      const data: Uint8Array = file.buffer;
      const { width } = report.dimensions;
      const image: Image = await loadImage(data);

      expect(Buffer.from(data).subarray(1, 4).toString()).toBe('PNG');
      expect(image.width).toBe(width);
      expect(Math.max(image.width, image.height)).toBe(300);
    });

    it('is a PNG after a crop', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const data: Uint8Array = (await document.toImage()).file.buffer;

      expect(Buffer.from(data).subarray(1, 4).toString()).toBe('PNG');
    });
  });

  describe('originalFile', (): void => {
    it('describes the original file', async (): Promise<void> => {
      const input: Buffer = createBlankPhoto(1200, 800);
      const document: ScannedDocument = await fromImage(input, {
        name: 'photo.png',
        maxDimension: 600,
      });

      expect((await document.toImage()).report.originalFile).toEqual({
        name: 'photo.png',
        mimeType: 'image/png',
        dimensions: { width: 1200, height: 800 },
        size: input.length,
      });
    });

    it('does not repeat the buffer in the reports', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);

      expect((await document.toImage()).report.originalFile).not.toHaveProperty(
        'buffer',
      );
    });

    it('has no name by default', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      expect((await toCanvas(document)).originalFile.name).toBeNull();
    });

    it('stays the same after the document changes', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const before: FileMetadata = (await toCanvas(document)).originalFile;

      document.applyFilter(new OpenCvBlackAndWhiteFilter());
      document.corners = null;

      expect((await toCanvas(document)).originalFile).toEqual(before);
    });

    it('does not let the report change it', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const report: FileMetadata = (await toCanvas(document)).originalFile;

      report.dimensions.width = 0;
      report.name = 'changed';

      expect((await toCanvas(document)).originalFile).toMatchObject({
        name: null,
      });
      expect((await toCanvas(document)).originalFile.dimensions.width).not.toBe(
        0,
      );
    });
  });

  describe('detectCorners', (): void => {
    const corners: Corners = {
      topLeft: { x: 100, y: 50 },
      topRight: { x: 400, y: 50 },
      bottomLeft: { x: 100, y: 250 },
      bottomRight: { x: 400, y: 250 },
    };

    it('crops the document with the default corners detector', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(photo.buffer);

      await document.detectCorners();

      const output: CanvasOutput = await toCanvas(document);

      expect(output.corners).not.toBeNull();
      expect(
        getMaxCornerError(output.corners as Corners, photo.corners),
      ).toBeLessThan(8);
      expect(output.dimensions.width).toBeGreaterThan(500);
      expect(output.dimensions.width).toBeLessThan(600);
      expect(output.dimensions.height).toBeGreaterThan(600);
      expect(output.dimensions.height).toBeLessThan(700);
      expect(output.canvas.width).toBe(output.dimensions.width);
      expect(output.canvas.height).toBe(output.dimensions.height);
    });

    it('reports corners in the original image coordinates when resizing', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(photo.buffer, {
        maxDimension: 600,
      });

      await document.detectCorners();

      const output: CanvasOutput = await toCanvas(document);

      expect(output.corners).not.toBeNull();
      expect(
        getMaxCornerError(output.corners as Corners, photo.corners),
      ).toBeLessThan(12);
    });

    it('gives the corners detector a copy of the image to process, in its coordinates', async (): Promise<void> => {
      const detect: jest.Mock<Promise<Corners>, [Uint8Array]> = jest.fn<
        Promise<Corners>,
        [Uint8Array]
      >();

      detect.mockImplementation(async (png: Uint8Array): Promise<Corners> => {
        const image: Image = await loadImage(png);

        expect({ width: image.width, height: image.height }).toEqual({
          width: 600,
          height: 400,
        });
        png.fill(0);

        return corners;
      });

      const document: ScannedDocument = await fromImage(
        createBlankPhoto(1200, 800),
        { maxDimension: 600 },
      );

      await document.detectCorners({ detect });

      expect(await toCanvas(document)).toMatchObject({
        corners: {
          topLeft: { x: 200, y: 100 },
          bottomRight: { x: 800, y: 500 },
        },
        dimensions: { width: 300, height: 200 },
      });
    });

    it('uses the given corners detector', async (): Promise<void> => {
      const cornersDetector: CornersDetector = {
        detect: jest.fn().mockResolvedValue(corners),
      };
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      await document.detectCorners(cornersDetector);

      expect(await toCanvas(document)).toMatchObject({
        corners,
        dimensions: { width: 300, height: 200 },
      });
    });

    it('keeps the filter, applied over the crop', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(photo.buffer);

      document.applyFilter(new OpenCvBlackAndWhiteFilter());
      await document.detectCorners();

      const output: CanvasOutput = await toCanvas(document);

      expect(output.dimensions.width).toBeLessThan(photo.canvas.width);
      expect(isBlackAndWhite(output.canvas)).toBe(true);
    });

    it('rejects when no document is detected', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(createBlankPhoto());

      await expect(document.detectCorners()).rejects.toThrow(
        'No document detected in the image',
      );
    });

    it('keeps the crop when a later detection rejects', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      document.corners = corners;

      await expect(
        document.detectCorners({
          detect: async (): Promise<null> => Promise.resolve(null),
        }),
      ).rejects.toThrow('No document detected in the image');
      expect(await toCanvas(document)).toMatchObject({
        corners,
        dimensions: { width: 300 },
      });
    });

    it('goes back to the whole image when no document is detected and the fallback is enabled', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
        { onNotDetected: 'original' },
      );

      document.corners = corners;
      await document.detectCorners({
        detect: async (): Promise<null> => Promise.resolve(null),
      });

      expect(await toCanvas(document)).toMatchObject({
        corners: null,
        dimensions: { width: 600, height: 400 },
      });
    });
  });

  describe('buffers', (): void => {
    it('keeps the bytes of the original file through every change', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);

      document.applyFilter(new OpenCvBlackAndWhiteFilter());

      expect(
        Buffer.from(document.toOriginalBuffer()).equals(photo.buffer),
      ).toBe(true);
    });

    it('does not follow later changes to the given buffer', async (): Promise<void> => {
      const input: Buffer = Buffer.from(photo.buffer);
      const document: ScannedDocument = await fromImage(input);

      input.fill(0);

      expect(
        Buffer.from(document.toOriginalBuffer()).equals(photo.buffer),
      ).toBe(true);
    });

    it('does not let the returned buffers change the document', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);

      document.toOriginalBuffer().fill(0);
      (await document.toImage()).file.buffer.fill(0);

      expect(
        Buffer.from(document.toOriginalBuffer()).equals(photo.buffer),
      ).toBe(true);
      expect(
        Buffer.from((await document.toImage()).file.buffer)
          .subarray(1, 4)
          .toString(),
      ).toBe('PNG');
    });

    it('exports the document cropped by the corners', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(photo.buffer);
      const { width: fullWidth } = await loadImage(
        (await document.toImage()).file.buffer,
      );

      await document.detectCorners();

      const output: DocumentOutput = await document.toImage();
      const image: Image = await loadImage(output.file.buffer);

      expect(image.width).toBe(output.report.dimensions.width);
      expect(image.width).toBeLessThan(fullWidth);
    });
  });

  describe('applyFilter', (): void => {
    it('filters the cropped document', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);

      document.applyFilter(new OpenCvBlackAndWhiteFilter());

      expect(isBlackAndWhite((await toCanvas(document)).canvas)).toBe(true);
    });

    it('gives the filter the cropped document', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const current: Uint8Array = (await document.toImage()).file.buffer;
      const filter: jest.Mock<Promise<Uint8Array>, [Uint8Array]> = jest.fn<
        Promise<Uint8Array>,
        [Uint8Array]
      >();

      filter.mockResolvedValue(current);

      document.applyFilter({ filter });
      await document.toImage();

      expect(filter.mock.calls[0][0]).toEqual(current);
    });

    it('exports the filtered document', async (): Promise<void> => {
      const filtered: Uint8Array = new CanvasImage(
        createCanvas(30, 20),
      ).toPng();
      const filter: ImageFilter = {
        filter: async (): Promise<Uint8Array> => Promise.resolve(filtered),
      };
      const document: ScannedDocument = await scan(photo.buffer);

      document.applyFilter(filter);

      const output: DocumentOutput = await document.toImage();

      expect(Buffer.from(output.file.buffer).equals(filtered)).toBe(true);
      expect(output).toMatchObject({
        file: { mimeType: 'image/png', fileExtension: 'png' },
        report: { dimensions: { width: 30, height: 20 } },
      });
      expect((await toCanvas(document)).canvas.width).toBe(30);
    });

    it('replaces the previous filter', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const crop: Uint8Array = (await document.toImage()).file.buffer;
      const previous: jest.Mock<Promise<Uint8Array>, [Uint8Array]> = jest.fn<
        Promise<Uint8Array>,
        [Uint8Array]
      >();
      const filter: jest.Mock<Promise<Uint8Array>, [Uint8Array]> = jest.fn<
        Promise<Uint8Array>,
        [Uint8Array]
      >();

      filter.mockResolvedValue(crop);

      document.applyFilter({ filter: previous });
      document.applyFilter({ filter });
      await document.toImage();

      expect(previous).not.toHaveBeenCalled();
      expect(filter.mock.calls[0][0]).toEqual(crop);
    });

    it('runs the filter once per render, whatever changed before it', async (): Promise<void> => {
      const filter: jest.Mock<Promise<Uint8Array>, [Uint8Array]> = jest.fn<
        Promise<Uint8Array>,
        [Uint8Array]
      >();

      filter.mockImplementation(
        async (buffer: Uint8Array): Promise<Uint8Array> =>
          Promise.resolve(buffer),
      );

      const document: ScannedDocument = await scan(photo.buffer);

      document.applyFilter({ filter });
      document.corners = photo.corners;
      document.corners = photo.corners;

      expect(filter).not.toHaveBeenCalled();

      await document.render();

      expect(filter).toHaveBeenCalledTimes(1);
    });

    it('goes back to the crop when the filter is removed', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const crop: Uint8Array = (await document.toImage()).file.buffer;

      document.applyFilter(new OpenCvBlackAndWhiteFilter());
      document.applyFilter(null);

      expect((await document.toImage()).file.buffer).toEqual(crop);
    });

    it('reports a failed crop on the outputs until the corners change', async (): Promise<void> => {
      const document: ScannedDocument = await ScannedDocument.fromImage(
        photo.buffer,
        {
          ...DEFAULT_ADAPTERS,
          imageCropper: {
            crop: async (): Promise<Uint8Array> =>
              Promise.reject(new Error('Failed')),
          },
        },
      );

      document.corners = photo.corners;

      await expect(document.render()).rejects.toThrow('Failed');
      await expect(document.toImage()).rejects.toThrow('Failed');
      await expect(document.toPdf()).rejects.toThrow('Failed');

      document.corners = null;

      expect((await document.toImage()).report.corners).toBeNull();
    });

    it('does not let a filter change the image', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const before: Uint8Array = (await document.toImage()).file.buffer;

      document.applyFilter({
        filter: async (buffer: Uint8Array): Promise<Uint8Array> => {
          buffer.fill(0);

          return Promise.reject(new Error('Failed'));
        },
      });

      await expect(document.render()).rejects.toThrow('Failed');

      document.applyFilter(null);

      expect((await document.toImage()).file.buffer).toEqual(before);
    });

    it('reports a failed filter on the outputs until it is replaced', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const before: Uint8Array = (await document.toImage()).file.buffer;

      document.applyFilter({
        filter: async (): Promise<Uint8Array> =>
          Promise.reject(new Error('Failed')),
      });

      await expect(document.render()).rejects.toThrow('Failed');
      await expect(document.toImage()).rejects.toThrow('Failed');

      document.applyFilter(null);

      expect((await document.toImage()).file.buffer).toEqual(before);
    });

    it('rejects a result that is not a PNG', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);

      document.applyFilter({
        filter: async (): Promise<Uint8Array> =>
          Promise.resolve(createCanvas(30, 20).toBuffer('image/webp')),
      });

      await expect(document.render()).rejects.toThrow(
        'Invalid image, expected a PNG',
      );
    });
  });

  describe('corners', (): void => {
    it('crops the document when set', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );
      const corners: Corners = {
        topLeft: { x: 100, y: 50 },
        topRight: { x: 400, y: 50 },
        bottomLeft: { x: 100, y: 250 },
        bottomRight: { x: 400, y: 250 },
      };

      document.corners = corners;

      expect(await toCanvas(document)).toMatchObject({
        corners,
        dimensions: { width: 300, height: 200 },
      });
    });

    it('exports the crop when set', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      document.corners = {
        topLeft: { x: 100, y: 50 },
        topRight: { x: 400, y: 50 },
        bottomLeft: { x: 100, y: 250 },
        bottomRight: { x: 400, y: 250 },
      };

      const image: Image = await loadImage(
        (await document.toImage()).file.buffer,
      );

      expect({ width: image.width, height: image.height }).toEqual({
        width: 300,
        height: 200,
      });
    });

    it('goes back to the whole image when set to null', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);

      document.corners = null;

      const output: DocumentOutput = await document.toImage();
      const image: Image = await loadImage(output.file.buffer);

      expect(output).toMatchObject({ report: { corners: null } });
      expect(image.width).toBe(photo.canvas.width);
    });

    it('takes corners in the original image coordinates when resizing', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(1200, 800),
        { maxDimension: 600 },
      );
      const corners: Corners = {
        topLeft: { x: 200, y: 100 },
        topRight: { x: 800, y: 100 },
        bottomLeft: { x: 200, y: 500 },
        bottomRight: { x: 800, y: 500 },
      };

      document.corners = corners;

      expect(await toCanvas(document)).toMatchObject({
        corners,
        dimensions: { width: 300, height: 200 },
      });
    });

    it('gives the filter the new crop', async (): Promise<void> => {
      const filter: jest.Mock<Promise<Uint8Array>, [Uint8Array]> = jest.fn<
        Promise<Uint8Array>,
        [Uint8Array]
      >();

      filter.mockImplementation(
        async (buffer: Uint8Array): Promise<Uint8Array> =>
          Promise.resolve(buffer),
      );

      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      document.applyFilter({ filter });

      document.corners = {
        topLeft: { x: 100, y: 50 },
        topRight: { x: 400, y: 50 },
        bottomLeft: { x: 100, y: 250 },
        bottomRight: { x: 400, y: 250 },
      };

      await document.toImage();

      const received: Image = await loadImage(filter.mock.calls[0][0]);

      expect({ width: received.width, height: received.height }).toEqual({
        width: 300,
        height: 200,
      });
    });

    it('uses the corners and the filter in any order they were set', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      document.applyFilter(new OpenCvBlackAndWhiteFilter());
      document.corners = {
        topLeft: { x: 100, y: 50 },
        topRight: { x: 400, y: 50 },
        bottomLeft: { x: 100, y: 250 },
        bottomRight: { x: 400, y: 250 },
      };

      const output: CanvasOutput = await toCanvas(document);

      expect(output.dimensions.width).toBe(300);
      expect(isBlackAndWhite(output.canvas)).toBe(true);
    });
  });

  describe('toImage', (): void => {
    it('returns a PNG image by default', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const output: DocumentOutput = await document.toImage();
      const image: Image = await loadImage(output.file.buffer);

      expect(output.file.mimeType).toBe('image/png');
      expect(output.file.fileExtension).toBe('png');
      expect(output).not.toHaveProperty('canvas');
      expect(Buffer.from(output.file.buffer).subarray(1, 4).toString()).toBe(
        'PNG',
      );
      expect(image.width).toBe(output.report.dimensions.width);
      expect(image.height).toBe(output.report.dimensions.height);
    });

    it('reports a document that was not cropped', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      document.applyFilter(new OpenCvGrayscaleFilter());

      expect(await document.toImage()).toMatchObject({
        report: { corners: null, dimensions: { width: 600, height: 400 } },
      });
    });
  });

  describe('corners validation', (): void => {
    const crossed: Corners = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 100, y: 50 },
      bottomRight: { x: 100, y: 0 },
      bottomLeft: { x: 0, y: 50 },
    };

    it('rejects corners that do not form a quadrilateral when set', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      expect((): void => {
        document.corners = crossed;
      }).toThrow('The corners do not form a quadrilateral');
      expect(await document.toImage()).toMatchObject({
        report: { corners: null },
      });
    });

    it('rejects corners outside of the image', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      expect((): void => {
        document.corners = {
          topLeft: { x: 100, y: 50 },
          topRight: { x: 601, y: 50 },
          bottomRight: { x: 400, y: 250 },
          bottomLeft: { x: 100, y: 250 },
        };
      }).toThrow('The corners are outside of the image');
    });

    it('rejects a detector that returns corners outside of the image', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      await expect(
        document.detectCorners({
          detect: async (): Promise<Corners> =>
            Promise.resolve({
              topLeft: { x: -100, y: -100 },
              topRight: { x: 5000, y: -100 },
              bottomRight: { x: 5000, y: 5000 },
              bottomLeft: { x: -100, y: 5000 },
            }),
        }),
      ).rejects.toThrow('The corners are outside of the image');
    });

    it('rejects a detector whose corners collapse when rounded', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      await expect(
        document.detectCorners({
          detect: async (): Promise<Corners> =>
            Promise.resolve({
              topLeft: { x: 0.1, y: 0.1 },
              topRight: { x: 0.2, y: 0.1 },
              bottomRight: { x: 0.2, y: 0.2 },
              bottomLeft: { x: 0.1, y: 0.2 },
            }),
        }),
      ).rejects.toThrow('The corners do not form a quadrilateral');
    });

    it('rejects corners that collapse when resized', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(1600, 2000),
        { maxDimension: 100 },
      );

      expect((): void => {
        document.corners = {
          topLeft: { x: 100, y: 100 },
          topRight: { x: 105, y: 100 },
          bottomRight: { x: 105, y: 105 },
          bottomLeft: { x: 100, y: 105 },
        };
      }).toThrow('The corners do not form a quadrilateral');
    });

    it('does not follow later changes to the corners of a detector', async (): Promise<void> => {
      const held: Corners = {
        topLeft: { x: 100, y: 50 },
        topRight: { x: 400, y: 50 },
        bottomRight: { x: 400, y: 250 },
        bottomLeft: { x: 100, y: 250 },
      };
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      await document.detectCorners({
        detect: async (): Promise<Corners> => Promise.resolve(held),
      });

      held.topLeft.x = 0;

      expect((await document.toImage()).report.corners?.topLeft.x).toBe(100);
    });

    it('does not let a cropper change the corners', async (): Promise<void> => {
      const document: ScannedDocument = await ScannedDocument.fromImage(
        createBlankPhoto(600, 400),
        {
          ...DEFAULT_ADAPTERS,
          imageCropper: {
            crop: async (
              buffer: Uint8Array,
              corners: Corners,
            ): Promise<Uint8Array> => {
              corners.topLeft.x = 0;

              return Promise.resolve(buffer);
            },
          },
        },
      );

      document.corners = {
        topLeft: { x: 100, y: 50 },
        topRight: { x: 400, y: 50 },
        bottomRight: { x: 400, y: 250 },
        bottomLeft: { x: 100, y: 250 },
      };

      expect((await document.toImage()).report.corners?.topLeft.x).toBe(100);
    });

    it('rejects a detector that does not return a quadrilateral', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      await expect(
        document.detectCorners({
          detect: async (): Promise<Corners> => Promise.resolve(crossed),
        }),
      ).rejects.toThrow('The corners do not form a quadrilateral');
      expect(await document.toImage()).toMatchObject({
        report: { corners: null },
      });
    });
  });

  describe('very thin images', (): void => {
    it('keeps at least 1 px when resized', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(4000, 10),
        { maxDimension: 100 },
      );

      expect(await document.toImage()).toMatchObject({
        report: {
          corners: null,
          dimensions: { width: 100, height: 1 },
          originalFile: { dimensions: { width: 4000, height: 10 } },
        },
      });
    });

    it('finds no document in an image that is too thin for the detection', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(4000, 2),
      );

      await expect(document.detectCorners()).rejects.toThrow(
        'No document detected in the image',
      );
    });

    it('rejects corners that collapse in the resized image', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(4000, 10),
        { maxDimension: 100 },
      );

      expect((): void => {
        document.corners = {
          topLeft: { x: 0, y: 0 },
          topRight: { x: 4000, y: 0 },
          bottomRight: { x: 4000, y: 10 },
          bottomLeft: { x: 0, y: 10 },
        };
      }).toThrow('The corners do not form a quadrilateral');
    });
  });

  describe('applyEnhancements', (): void => {
    it('runs the enhancers of this package between the crop and the filter', async (): Promise<void> => {
      const corners: Corners = {
        topLeft: { x: 100, y: 50 },
        topRight: { x: 400, y: 50 },
        bottomRight: { x: 400, y: 250 },
        bottomLeft: { x: 100, y: 250 },
      };
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      document.corners = corners;
      document.applyEnhancements([
        new OpenCvNoiseReductionEnhancer(),
        new OpenCvSharpnessEnhancer({ level: 'strong' }),
        new OpenCvRotationEnhancer({ quarterTurns: 1 }),
      ]);
      document.applyFilter(new OpenCvBlackAndWhiteFilter());

      const output: CanvasOutput = await toCanvas(document);

      expect(output).toMatchObject({
        corners,
        dimensions: { width: 200, height: 300 },
      });
      expect(isBlackAndWhite(output.canvas)).toBe(true);
    });
  });

  describe('render', (): void => {
    const corners: Corners = {
      topLeft: { x: 100, y: 50 },
      topRight: { x: 400, y: 50 },
      bottomRight: { x: 400, y: 250 },
      bottomLeft: { x: 100, y: 250 },
    };

    it('returns the input as a PNG when nothing was asked for', async (): Promise<void> => {
      const input: Buffer = createBlankPhoto(600, 400);
      const document: ScannedDocument = await fromImage(input);

      expect(Buffer.from(await document.render()).equals(input)).toBe(true);
    });

    it('returns the same document the export receives', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      document.corners = corners;
      document.applyFilter(new OpenCvGrayscaleFilter());

      const preview: Uint8Array = await document.render();

      expect((await decodeToCanvas(preview)).width).toBe(300);
      expect((await document.toImage()).file.buffer).toEqual(preview);
    });

    it('does not let its result change the document', async (): Promise<void> => {
      const input: Buffer = createBlankPhoto(600, 400);
      const document: ScannedDocument = await fromImage(input);

      (await document.render()).fill(0);

      expect(Buffer.from(await document.render()).equals(input)).toBe(true);
    });

    it('does not crop while detecting', async (): Promise<void> => {
      const crop: jest.Mock<
        Promise<Uint8Array>,
        [Uint8Array, Corners]
      > = jest.fn<Promise<Uint8Array>, [Uint8Array, Corners]>();
      const document: ScannedDocument = await ScannedDocument.fromImage(
        createBlankPhoto(600, 400),
        { ...DEFAULT_ADAPTERS, imageCropper: { crop } },
      );

      await document.detectCorners({
        detect: async (): Promise<Corners> => Promise.resolve(corners),
      });

      expect(crop).not.toHaveBeenCalled();
    });

    it('renders again on every call', async (): Promise<void> => {
      const filter: jest.Mock<Promise<Uint8Array>, [Uint8Array]> = jest.fn<
        Promise<Uint8Array>,
        [Uint8Array]
      >();

      filter.mockImplementation(
        async (buffer: Uint8Array): Promise<Uint8Array> =>
          Promise.resolve(buffer),
      );

      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      document.applyFilter({ filter });
      await document.render();
      await document.toImage();

      expect(filter).toHaveBeenCalledTimes(2);
    });
  });

  describe('output', (): void => {
    const corners: Corners = {
      topLeft: { x: 100, y: 50 },
      topRight: { x: 400, y: 50 },
      bottomRight: { x: 400, y: 250 },
      bottomLeft: { x: 100, y: 250 },
    };

    it('exports what was asked for up to the call', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );
      const exporting: Promise<DocumentOutput> = document.toImage();

      document.corners = corners;

      const output: DocumentOutput = await exporting;
      const image: Canvas = await decodeToCanvas(output.file.buffer);

      expect(output.report.corners).toBeNull();
      expect(output.report.dimensions).toEqual({
        width: image.width,
        height: image.height,
      });
      expect(image.width).toBe(600);
      expect((await document.toImage()).report.corners).toEqual(corners);
    });

    it('does not report corners set while the encoder runs', async (): Promise<void> => {
      const document: ScannedDocument = await fromImage(
        createBlankPhoto(600, 400),
      );

      const during: Promise<DocumentOutput> = document.toImage({
        mimeType: 'image/png',
        fileExtension: 'png',
        encode: async (buffer: Uint8Array): Promise<Uint8Array> => {
          document.corners = corners;

          return Promise.resolve(buffer);
        },
      });

      expect((await during).report.corners).toBeNull();
    });

    it('separates the exported file from the report of the document', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const { file, report } = await document.toPdf();

      expect(Object.keys(file).sort()).toEqual([
        'buffer',
        'fileExtension',
        'mimeType',
      ]);
      expect(file.mimeType).toBe('application/pdf');
      expect(Object.keys(report).sort()).toEqual([
        'corners',
        'dimensions',
        'originalFile',
      ]);
    });

    it('accepts a plain object as an encoder', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const data: Uint8Array = new Uint8Array([1, 2, 3]);
      const { file } = await document.toImage({
        mimeType: 'image/plain',
        fileExtension: 'plain',
        encode: async (): Promise<Uint8Array> => Promise.resolve(data),
      });

      expect(file).toEqual({
        buffer: data,
        mimeType: 'image/plain',
        fileExtension: 'plain',
      });
    });
  });

  describe('toImage with an encoder', (): void => {
    const encoded: Uint8Array = new Uint8Array([1, 2, 3, 4]);

    it('returns the buffer and the format of the given encoder', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const output: DocumentOutput = await document.toImage(
        new FakeImageEncoder(async (): Promise<Uint8Array> =>
          Promise.resolve(encoded),
        ),
      );

      expect(output.file.buffer).toEqual(encoded);
      expect(output).toMatchObject({
        file: { mimeType: 'image/webp', fileExtension: 'webp' },
        report: { corners: expect.anything() as Corners },
      });
    });

    it('gives the encoder a copy of the rendered document', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const before: Uint8Array = (await document.toImage()).file.buffer;

      await document.toImage(
        new FakeImageEncoder(
          async (buffer: Uint8Array): Promise<Uint8Array> => {
            expect(buffer).toEqual(before);
            buffer.fill(0);

            return Promise.resolve(buffer);
          },
        ),
      );

      expect((await document.toImage()).file.buffer).toEqual(before);
    });

    it('rejects when the encoder rejects', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);

      await expect(
        document.toImage(
          new FakeImageEncoder(async (): Promise<Uint8Array> =>
            Promise.reject(new Error('Failed')),
          ),
        ),
      ).rejects.toThrow('Failed');
    });

    it('converts the document with the JPEG encoder', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);

      document.applyFilter(new OpenCvBlackAndWhiteFilter());

      const output: DocumentOutput = await document.toImage(
        new JpegImageEncoder(),
      );

      expect(output.file.mimeType).toBe('image/jpeg');
      expect(output.file.fileExtension).toBe('jpg');
      expect(Array.from(output.file.buffer.subarray(0, 2))).toEqual([
        0xff, 0xd8,
      ]);
    });

    it('converts the document with the PNG encoder', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const output: DocumentOutput = await document.toImage(
        new PngImageEncoder(),
      );

      expect(output.file.mimeType).toBe('image/png');
      expect(output.file.fileExtension).toBe('png');
      expect(Buffer.from(output.file.buffer).subarray(1, 4).toString()).toBe(
        'PNG',
      );
    });
  });

  describe('toPdf with an encoder', (): void => {
    it('returns the buffer and the format of the given encoder', async (): Promise<void> => {
      const pdf: Uint8Array = new TextEncoder().encode('%PDF-custom');
      const document: ScannedDocument = await scan(photo.buffer);
      const output: DocumentOutput = await document.toPdf(
        new FakePdfEncoder(async (): Promise<Uint8Array> =>
          Promise.resolve(pdf),
        ),
      );

      expect(output.file.buffer).toEqual(pdf);
      expect(output).toMatchObject({
        file: { mimeType: 'application/x-fake-pdf', fileExtension: 'fakepdf' },
        report: { corners: expect.anything() as Corners },
      });
    });

    it('gives the encoder a copy of the rendered document', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const before: Uint8Array = (await document.toImage()).file.buffer;
      const output: DocumentOutput = await document.toPdf(
        new FakePdfEncoder(async (buffer: Uint8Array): Promise<Uint8Array> => {
          const received: Uint8Array = new Uint8Array(buffer);

          buffer.fill(0);

          return Promise.resolve(received);
        }),
      );

      expect(output.file.buffer).toEqual(before);
      expect((await document.toImage()).file.buffer).toEqual(before);
    });
  });

  describe('toPdf', (): void => {
    it('returns an A4 PDF by default', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const output: DocumentOutput = await document.toPdf();
      const pdf: PDFDocument = await PDFDocument.load(output.file.buffer);
      const page: PDFPage = pdf.getPage(0);

      expect(output.file.mimeType).toBe('application/pdf');
      expect(output.file.fileExtension).toBe('pdf');
      expect(output.report.corners).not.toBeNull();
      expect(pdf.getPageCount()).toBe(1);
      expect(page.getSize()).toEqual({ width: 595.28, height: 841.89 });
    });

    it('applies the page format and the margin', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const output: DocumentOutput = await document.toPdf(
        new PdfDocumentEncoder({
          pageFormat: 'image',
          margin: 10,
        }),
      );
      const page: PDFPage = (
        await PDFDocument.load(output.file.buffer)
      ).getPage(0);

      expect(page.getWidth()).toBeCloseTo(
        (output.report.dimensions.width * 72) / 150 + 20,
      );
      expect(page.getHeight()).toBeCloseTo(
        (output.report.dimensions.height * 72) / 150 + 20,
      );
    });

    it('applies the image DPI', async (): Promise<void> => {
      const document: ScannedDocument = await scan(photo.buffer);
      const output: DocumentOutput = await document.toPdf(
        new PdfDocumentEncoder({
          pageFormat: 'image',
          imageDpi: 300,
        }),
      );
      const page: PDFPage = (
        await PDFDocument.load(output.file.buffer)
      ).getPage(0);

      expect(page.getWidth()).toBeCloseTo(
        (output.report.dimensions.width * 72) / 300,
      );
    });
  });
});
