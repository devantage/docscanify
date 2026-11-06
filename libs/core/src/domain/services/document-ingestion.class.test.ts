import { createBlankPhoto } from '../../test-helpers';
import { type DecodedImage, MIME_TYPE } from '../models';
import type { ImageDecoder, ImageResizer } from '../ports';
import {
  DocumentIngestion,
  type IngestedDocument,
} from './document-ingestion.class';

const PNG: Buffer = createBlankPhoto(60, 40);
const OTHER_PNG: Buffer = createBlankPhoto(30, 20);
const JPEG: Buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

const DECODER: ImageDecoder = {
  decode: async (buffer: Uint8Array): Promise<DecodedImage> =>
    Promise.resolve({ png: buffer, originalMimeType: MIME_TYPE.PNG }),
};

const RESIZER: ImageResizer = {
  resize: async (): Promise<Uint8Array> => Promise.resolve(OTHER_PNG),
};

describe('DocumentIngestion', (): void => {
  const ingestion: DocumentIngestion = new DocumentIngestion(DECODER, RESIZER);

  it('uses a single file when the input is already what the document works on', async (): Promise<void> => {
    const { originalFile, workingFile }: IngestedDocument =
      await ingestion.ingest(PNG);

    expect(workingFile).toBe(originalFile);
  });

  it('keeps two files when the decoder changes the bytes', async (): Promise<void> => {
    const { originalFile, workingFile }: IngestedDocument =
      await new DocumentIngestion(
        {
          decode: async (): Promise<DecodedImage> =>
            Promise.resolve({
              png: OTHER_PNG,
              originalMimeType: MIME_TYPE.PNG,
            }),
        },
        RESIZER,
      ).ingest(PNG);

    expect(workingFile).not.toBe(originalFile);
    expect(Buffer.from(workingFile.toBuffer()).equals(OTHER_PNG)).toBe(true);
  });

  it('keeps two files when the image is resized', async (): Promise<void> => {
    const { originalFile, workingFile }: IngestedDocument =
      await ingestion.ingest(PNG, { maxDimension: 30 });

    expect(workingFile).not.toBe(originalFile);
    expect(workingFile.getDimensions()).toEqual({ width: 30, height: 20 });
  });

  it('describes the received file', async (): Promise<void> => {
    const { originalFile }: IngestedDocument = await new DocumentIngestion(
      {
        decode: async (): Promise<DecodedImage> =>
          Promise.resolve({ png: PNG, originalMimeType: MIME_TYPE.JPEG }),
      },
      RESIZER,
    ).ingest(JPEG, { name: 'photo.jpg' });

    expect(originalFile.toMetadata()).toEqual({
      name: 'photo.jpg',
      mimeType: MIME_TYPE.JPEG,
      dimensions: { width: 60, height: 40 },
      size: JPEG.length,
    });
  });

  it('leaves to the decoder which files it accepts', async (): Promise<void> => {
    await expect(
      new DocumentIngestion(
        {
          decode: async (): Promise<DecodedImage> =>
            Promise.reject(new Error('Unreadable file')),
        },
        RESIZER,
      ).ingest(PNG),
    ).rejects.toThrow('Unreadable file');
  });

  it('rejects a decoded image that is not a PNG', async (): Promise<void> => {
    await expect(
      new DocumentIngestion(
        {
          decode: async (): Promise<DecodedImage> =>
            Promise.resolve({ png: JPEG, originalMimeType: MIME_TYPE.JPEG }),
        },
        RESIZER,
      ).ingest(JPEG),
    ).rejects.toThrow('Invalid image, expected a PNG');
  });

  it.each([0, -5, NaN, 0.4])(
    'rejects a maxDimension of %d',
    async (maxDimension: number): Promise<void> => {
      await expect(ingestion.ingest(PNG, { maxDimension })).rejects.toThrow(
        'maxDimension must be at least 1',
      );
    },
  );

  it('keeps the bytes received, even if the caller changes them while decoding', async (): Promise<void> => {
    const received: Uint8Array = new Uint8Array(PNG);
    const ingesting: Promise<IngestedDocument> = ingestion.ingest(received);

    received.fill(0);

    const { originalFile }: IngestedDocument = await ingesting;

    expect(Buffer.from(originalFile.toBuffer()).equals(PNG)).toBe(true);
  });
});
