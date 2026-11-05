import { createBlankPhoto } from '../../test-helpers';
import type { Corners, DecodedImage, DocumentOutput } from '../models';
import type {
  ImageCropper,
  ImageDecoder,
  ImageEncoder,
  ImageEnhancer,
  ImageResizer,
  PdfEncoder,
  ScannedDocumentAdapters,
} from '../ports';
import { ScannedDocument } from './scanned-document.class';

const CORNERS: Corners = {
  topLeft: { x: 1, y: 2 },
  topRight: { x: 11, y: 2 },
  bottomRight: { x: 11, y: 12 },
  bottomLeft: { x: 1, y: 12 },
};

const DECODED: Buffer = createBlankPhoto(60, 40);
const RESIZED: Buffer = createBlankPhoto(30, 20);
const CROPPED: Buffer = createBlankPhoto(10, 10);
const FILTERED: Buffer = createBlankPhoto(9, 9);
const ENHANCED: Buffer = createBlankPhoto(8, 8);

class FakeImageEncoder implements ImageEncoder {
  public readonly mimeType: string = 'image/fake';

  public readonly fileExtension: string = 'fake';

  public async encode(png: Uint8Array): Promise<Uint8Array> {
    return Promise.resolve(png);
  }
}

class FakePdfEncoder implements PdfEncoder {
  public readonly mimeType: string = 'application/fake';

  public readonly fileExtension: string = 'fakepdf';

  public async encode(png: Uint8Array): Promise<Uint8Array> {
    return Promise.resolve(png);
  }
}

function createAdapters(): {
  adapters: ScannedDocumentAdapters;
  decode: jest.MockedFunction<ImageDecoder['decode']>;
  resize: jest.MockedFunction<ImageResizer['resize']>;
  crop: jest.MockedFunction<ImageCropper['crop']>;
} {
  const decode: jest.MockedFunction<ImageDecoder['decode']> = jest
    .fn<Promise<DecodedImage>, [Uint8Array]>()
    .mockResolvedValue({ png: DECODED, originalMimeType: 'image/jpeg' });
  const resize: jest.MockedFunction<ImageResizer['resize']> = jest
    .fn<Promise<Uint8Array>, Parameters<ImageResizer['resize']>>()
    .mockResolvedValue(RESIZED);
  const crop: jest.MockedFunction<ImageCropper['crop']> = jest
    .fn<Promise<Uint8Array>, Parameters<ImageCropper['crop']>>()
    .mockResolvedValue(CROPPED);

  return {
    adapters: {
      imageDecoder: { decode },
      imageResizer: { resize },
      cornersDetector: { detect: jest.fn().mockResolvedValue(CORNERS) },
      imageCropper: { crop },
      imageEncoder: new FakeImageEncoder(),
      pdfEncoder: new FakePdfEncoder(),
    },
    decode,
    resize,
    crop,
  };
}

const JPEG_INPUT: Buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

describe('ScannedDocument with fake adapters', (): void => {
  it('runs the whole flow without any image library', async (): Promise<void> => {
    const { adapters, crop } = createAdapters();
    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      adapters,
    );

    await document.detectCorners();
    document.applyFilter({
      filter: async (): Promise<Uint8Array> => Promise.resolve(FILTERED),
    });

    const image: DocumentOutput = await document.toImage();
    const pdf: DocumentOutput = await document.toPdf();

    expect(crop).toHaveBeenCalled();
    expect(Buffer.from(image.file.buffer).equals(FILTERED)).toBe(true);
    expect(image).toMatchObject({
      file: { mimeType: 'image/fake', fileExtension: 'fake' },
      report: { corners: CORNERS, dimensions: { width: 9, height: 9 } },
    });
    expect(pdf).toMatchObject({
      file: { mimeType: 'application/fake', fileExtension: 'fakepdf' },
    });
  });

  it('always applies the crop before the filter, from the decoded image', async (): Promise<void> => {
    const { adapters, crop } = createAdapters();
    const filter: jest.Mock<Promise<Uint8Array>, [Uint8Array]> = jest.fn<
      Promise<Uint8Array>,
      [Uint8Array]
    >();

    filter.mockResolvedValue(FILTERED);

    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      adapters,
    );

    document.applyFilter({ filter });
    document.corners = CORNERS;
    await document.toImage();

    expect(Buffer.from(crop.mock.calls[0][0]).equals(DECODED)).toBe(true);
    expect(Buffer.from(filter.mock.calls[0][0]).equals(CROPPED)).toBe(true);
  });

  it('exposes the corners set or detected, or null for the whole image', async (): Promise<void> => {
    const { adapters } = createAdapters();
    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      adapters,
    );

    expect(document.corners).toBeNull();

    document.corners = CORNERS;
    expect(document.corners).toEqual(CORNERS);

    document.corners = null;
    expect(document.corners).toBeNull();

    await document.detectCorners();
    expect(document.corners).not.toBeNull();
  });

  it('does not use the cropper or the filter until something asks for the result', async (): Promise<void> => {
    const { adapters, crop } = createAdapters();
    const filter: jest.Mock<Promise<Uint8Array>, [Uint8Array]> = jest.fn<
      Promise<Uint8Array>,
      [Uint8Array]
    >();

    filter.mockResolvedValue(FILTERED);

    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      adapters,
    );

    await document.detectCorners();
    document.corners = CORNERS;
    document.applyFilter({ filter });

    expect(crop).not.toHaveBeenCalled();
    expect(filter).not.toHaveBeenCalled();

    await document.render();

    expect(crop).toHaveBeenCalledTimes(1);
    expect(filter).toHaveBeenCalledTimes(1);
  });

  it('runs the enhancers between the crop and the filter, in the given order', async (): Promise<void> => {
    const { adapters, crop } = createAdapters();
    const first: jest.Mock<Promise<Uint8Array>, [Uint8Array]> = jest
      .fn<Promise<Uint8Array>, [Uint8Array]>()
      .mockResolvedValue(ENHANCED);
    const second: jest.Mock<Promise<Uint8Array>, [Uint8Array]> = jest
      .fn<Promise<Uint8Array>, [Uint8Array]>()
      .mockResolvedValue(RESIZED);
    const filter: jest.Mock<Promise<Uint8Array>, [Uint8Array]> = jest
      .fn<Promise<Uint8Array>, [Uint8Array]>()
      .mockResolvedValue(FILTERED);
    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      adapters,
    );

    document.applyFilter({ filter });
    document.corners = CORNERS;
    document.applyEnhancements([{ enhance: first }, { enhance: second }]);

    expect(first).not.toHaveBeenCalled();

    const output: Uint8Array = await document.render();

    expect(crop).toHaveBeenCalledTimes(1);
    expect(Buffer.from(first.mock.calls[0][0]).equals(CROPPED)).toBe(true);
    expect(Buffer.from(second.mock.calls[0][0]).equals(ENHANCED)).toBe(true);
    expect(Buffer.from(filter.mock.calls[0][0]).equals(RESIZED)).toBe(true);
    expect(Buffer.from(output).equals(FILTERED)).toBe(true);
  });

  it('runs the enhancers without corners or a filter', async (): Promise<void> => {
    const { adapters } = createAdapters();
    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      adapters,
    );

    document.applyEnhancements([
      {
        enhance: async (): Promise<Uint8Array> => Promise.resolve(ENHANCED),
      },
    ]);

    expect(Buffer.from(await document.render()).equals(ENHANCED)).toBe(true);
  });

  it('replaces the enhancers, and removes them with an empty list', async (): Promise<void> => {
    const { adapters } = createAdapters();
    const previous: jest.Mock<Promise<Uint8Array>, [Uint8Array]> = jest
      .fn<Promise<Uint8Array>, [Uint8Array]>()
      .mockResolvedValue(ENHANCED);
    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      adapters,
    );

    document.applyEnhancements([{ enhance: previous }]);
    document.applyEnhancements([]);

    expect(Buffer.from(await document.render()).equals(DECODED)).toBe(true);
    expect(previous).not.toHaveBeenCalled();
  });

  it('does not follow later changes to the list of enhancers', async (): Promise<void> => {
    const { adapters } = createAdapters();
    const enhancers: ImageEnhancer[] = [];
    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      adapters,
    );

    document.applyEnhancements(enhancers);
    enhancers.push({
      enhance: async (): Promise<Uint8Array> => Promise.resolve(ENHANCED),
    });

    expect(Buffer.from(await document.render()).equals(DECODED)).toBe(true);
  });

  it('exports with the enhancers asked for up to the call', async (): Promise<void> => {
    const { adapters } = createAdapters();
    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      adapters,
    );
    const exporting: Promise<DocumentOutput> = document.toImage();

    document.applyEnhancements([
      {
        enhance: async (): Promise<Uint8Array> => Promise.resolve(ENHANCED),
      },
    ]);

    expect(Buffer.from((await exporting).file.buffer).equals(DECODED)).toBe(
      true,
    );
  });

  it('rejects an enhancer that fails or does not return a PNG', async (): Promise<void> => {
    const { adapters } = createAdapters();
    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      adapters,
    );

    document.applyEnhancements([
      {
        enhance: async (): Promise<Uint8Array> =>
          Promise.reject(new Error('Failed')),
      },
    ]);

    await expect(document.render()).rejects.toThrow('Failed');

    document.applyEnhancements([
      {
        enhance: async (): Promise<Uint8Array> => Promise.resolve(JPEG_INPUT),
      },
    ]);

    await expect(document.toImage()).rejects.toThrow(
      'Invalid image, expected a PNG',
    );

    document.applyEnhancements([]);

    expect(Buffer.from(await document.render()).equals(DECODED)).toBe(true);
  });

  it('asks the resizer only when the image is larger than the limit', async (): Promise<void> => {
    const small: ReturnType<typeof createAdapters> = createAdapters();

    await ScannedDocument.fromImage(JPEG_INPUT, small.adapters);

    expect(small.resize).not.toHaveBeenCalled();

    const large: ReturnType<typeof createAdapters> = createAdapters();
    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      large.adapters,
      { maxDimension: 30 },
    );

    expect(large.resize.mock.calls[0][1]).toEqual({ width: 30, height: 20 });
    expect(await document.toImage()).toMatchObject({
      report: {
        originalFile: { dimensions: { width: 60, height: 40 } },
        dimensions: { width: 30, height: 20 },
      },
    });
  });

  it('uses corners in the coordinate system of the resized image with the adapters', async (): Promise<void> => {
    const { adapters, crop } = createAdapters();
    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      adapters,
      { maxDimension: 30 },
    );

    document.corners = {
      topLeft: { x: 20, y: 20 },
      topRight: { x: 40, y: 20 },
      bottomRight: { x: 40, y: 40 },
      bottomLeft: { x: 20, y: 40 },
    };

    const output: DocumentOutput = await document.toImage();

    expect(crop.mock.calls[0][1].topRight).toEqual({ x: 20, y: 10 });
    expect(output.report.corners?.topRight).toEqual({ x: 40, y: 20 });
  });

  it.each<[string, (adapters: ScannedDocumentAdapters) => void]>([
    [
      'decoder',
      (adapters: ScannedDocumentAdapters): void => {
        adapters.imageDecoder = {
          decode: async (): Promise<DecodedImage> =>
            Promise.resolve({
              png: JPEG_INPUT,
              originalMimeType: 'image/jpeg',
            }),
        };
      },
    ],
  ])(
    'rejects a %s that does not return a PNG',
    async (
      _name: string,
      breakIt: (adapters: ScannedDocumentAdapters) => void,
    ): Promise<void> => {
      const { adapters } = createAdapters();

      breakIt(adapters);

      await expect(
        ScannedDocument.fromImage(JPEG_INPUT, adapters),
      ).rejects.toThrow('Invalid image, expected a PNG');
    },
  );

  it('rejects a cropper that does not return a PNG', async (): Promise<void> => {
    const { adapters } = createAdapters();

    adapters.imageCropper = {
      crop: async (): Promise<Uint8Array> => Promise.resolve(JPEG_INPUT),
    };

    const document: ScannedDocument = await ScannedDocument.fromImage(
      JPEG_INPUT,
      adapters,
    );

    document.corners = CORNERS;

    await expect(document.toImage()).rejects.toThrow(
      'Invalid image, expected a PNG',
    );
  });
});
