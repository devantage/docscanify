import type { ScannedDocument } from '@devantage/docscanify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  canvasFromPng,
  fileStamp,
  frameFromVideo,
  sourceFromFile,
  thumbnailFrom,
  thumbnailFromPng,
} from './image';
import { createScannedDocument } from './scan';
import type { SourceImage } from './types';

vi.mock('./scan', (): Record<string, unknown> => ({
  createScannedDocument: vi.fn(),
}));

interface FakeBitmap {
  width: number;
  height: number;
  close(): void;
}

interface FakeContext {
  canvas: HTMLCanvasElement;
  drawImage(...args: unknown[]): void;
}

/** Calls received by the fake browser APIs. */
let bitmapRequests: unknown[][];
let bitmaps: FakeBitmap[];
let contexts: FakeContext[];
let drawCalls: { canvas: HTMLCanvasElement; args: unknown[] }[];

function fakeBitmap(width: number, height: number): FakeBitmap {
  const bitmap: FakeBitmap = { width, height, close: vi.fn() };
  bitmaps.push(bitmap);
  return bitmap;
}

/** Makes createImageBitmap return bitmaps of the given sizes, in order. */
function stubCreateImageBitmap(...sizes: [number, number][]): void {
  vi.stubGlobal(
    'createImageBitmap',
    async (...args: unknown[]): Promise<FakeBitmap> => {
      bitmapRequests.push(args);
      const options: { resizeWidth?: number; resizeHeight?: number } =
        args[1] ?? {};
      const size: [number, number] | undefined = sizes.shift();
      return Promise.resolve(
        fakeBitmap(
          options.resizeWidth ?? size?.[0] ?? 1,
          options.resizeHeight ?? size?.[1] ?? 1,
        ),
      );
    },
  );
}

/** Gives every canvas a fake 2D context, or none when `available` is false. */
function stubCanvasContext(available: boolean = true): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement): RenderingContext | null {
      if (!available) return null;
      const context: FakeContext = {
        canvas: this,
        drawImage: (...args: unknown[]): void => {
          drawCalls.push({ canvas: this, args });
        },
      };
      contexts.push(context);
      return context as unknown as RenderingContext;
    },
  );
}

async function blobBytes(blob: Blob): Promise<number[]> {
  return [...new Uint8Array(await blob.arrayBuffer())];
}

beforeEach((): void => {
  bitmapRequests = [];
  bitmaps = [];
  contexts = [];
  drawCalls = [];
});

describe('fileStamp', (): void => {
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('formats the current UTC date and time as YYYYMMDDhhmm', (): void => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-02T03:04:59.999Z'));

    expect(fileStamp()).toBe('202601020304');
  });

  it('pads single-digit months, days, hours and minutes and ignores seconds', (): void => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-12-31T23:59:30Z'));

    expect(fileStamp()).toBe('202712312359');
  });
});

describe('canvasFromPng', (): void => {
  it('decodes the PNG bytes into a canvas of the image size, with the image drawn at the origin', async (): Promise<void> => {
    stubCreateImageBitmap([640, 480]);
    stubCanvasContext();

    const canvas: HTMLCanvasElement = await canvasFromPng(
      new Uint8Array([137, 80, 78, 71]),
    );

    expect(bitmapRequests).toHaveLength(1);
    const source: Blob = bitmapRequests[0][0] as Blob;
    expect(source).toBeInstanceOf(Blob);
    expect(source.type).toBe('image/png');
    expect(await blobBytes(source)).toEqual([137, 80, 78, 71]);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
    expect(drawCalls).toEqual([{ canvas, args: [bitmaps[0], 0, 0] }]);
    expect(bitmaps[0].close).toHaveBeenCalledOnce();
  });

  it('throws when the canvas has no 2D context', async (): Promise<void> => {
    stubCreateImageBitmap([10, 10]);
    stubCanvasContext(false);

    await expect(canvasFromPng(new Uint8Array([1]))).rejects.toThrow(
      'Could not get a 2D canvas context',
    );
  });
});

describe('thumbnailFrom', (): void => {
  beforeEach((): void => {
    stubCreateImageBitmap();
    stubCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,THUMB',
    );
  });

  function sourceCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  it.each([
    // Tall: limited by the height (144)
    [1000, 2000, 72, 144],
    // Wide: limited by the width (112)
    [2240, 1000, 112, 50],
    // Exactly the thumbnail ratio
    [560, 720, 112, 144],
    // Smaller than a thumbnail: never scaled up
    [50, 60, 50, 60],
    // Very thin: never below 1 px
    [10000, 3, 112, 1],
    // Very narrow: never below 1 px
    [3, 10000, 1, 144],
    // Fractional sizes round to the nearest pixel: 1010 * 0.072 = 72.72
    [1010, 2000, 73, 144],
    // 1005 * 0.112 = 112.56
    [1000, 1005, 112, 113],
  ])(
    'scales a %ix%i image to %ix%i, keeping the aspect ratio',
    async (
      width: number,
      height: number,
      thumbWidth: number,
      thumbHeight: number,
    ): Promise<void> => {
      const image: HTMLCanvasElement = sourceCanvas(width, height);

      await thumbnailFrom(image);

      expect(bitmapRequests).toEqual([
        [
          image,
          {
            resizeWidth: thumbWidth,
            resizeHeight: thumbHeight,
            resizeQuality: 'high',
          },
        ],
      ]);
      expect(contexts).toHaveLength(1);
      const canvas: HTMLCanvasElement = contexts[0].canvas;
      expect([canvas.width, canvas.height]).toEqual([thumbWidth, thumbHeight]);
    },
  );

  it('returns the resized bitmap drawn on a canvas as a JPEG data URL at quality 0.85', async (): Promise<void> => {
    const result: string = await thumbnailFrom(sourceCanvas(224, 288));

    expect(result).toBe('data:image/jpeg;base64,THUMB');
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith(
      'image/jpeg',
      0.85,
    );
    expect(drawCalls).toEqual([
      { canvas: contexts[0].canvas, args: [bitmaps[0], 0, 0] },
    ]);
    expect(bitmaps[0].close).toHaveBeenCalledOnce();
  });

  it('accepts an ImageBitmap as the source', async (): Promise<void> => {
    const source: FakeBitmap = { width: 300, height: 300, close: vi.fn() };

    await thumbnailFrom(source);

    expect(bitmapRequests[0]).toEqual([
      source,
      { resizeWidth: 112, resizeHeight: 112, resizeQuality: 'high' },
    ]);
    // The caller owns the source bitmap
    expect(source.close).not.toHaveBeenCalled();
  });
});

describe('thumbnailFromPng', (): void => {
  it('decodes the PNG, makes the thumbnail from it and closes the decoded bitmap', async (): Promise<void> => {
    stubCreateImageBitmap([1120, 1440]);
    stubCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,PNGTHUMB',
    );

    const result: string = await thumbnailFromPng(new Uint8Array([9, 8, 7]));

    expect(result).toBe('data:image/jpeg;base64,PNGTHUMB');
    const decoded: Blob = bitmapRequests[0][0] as Blob;
    expect(decoded.type).toBe('image/png');
    expect(await blobBytes(decoded)).toEqual([9, 8, 7]);
    // The thumbnail is resized from the decoded bitmap
    expect(bitmapRequests[1]).toEqual([
      bitmaps[0],
      { resizeWidth: 112, resizeHeight: 144, resizeQuality: 'high' },
    ]);
    expect(bitmaps[0].close).toHaveBeenCalledOnce();
  });

  it('closes the decoded bitmap even when the thumbnail fails', async (): Promise<void> => {
    stubCreateImageBitmap([100, 100]);
    stubCanvasContext(false);

    await expect(thumbnailFromPng(new Uint8Array([1]))).rejects.toThrow(
      'Could not get a 2D canvas context',
    );
    expect(bitmaps[0].close).toHaveBeenCalledOnce();
  });
});

describe('sourceFromFile', (): void => {
  const createObjectURL: typeof URL.createObjectURL = URL.createObjectURL;
  const revokeObjectURL: typeof URL.revokeObjectURL = URL.revokeObjectURL;
  const scannedDocument: ScannedDocument = {
    id: 'doc',
  } as unknown as ScannedDocument;
  let created: Blob[];
  let revoked: string[];
  let decode: () => Promise<void>;

  beforeEach((): void => {
    created = [];
    revoked = [];
    URL.createObjectURL = (blob: Blob | MediaSource): string => {
      created.push(blob as Blob);
      return 'blob:http://localhost/image-1';
    };
    URL.revokeObjectURL = (url: string): void => {
      revoked.push(url);
    };
    decode = async (): Promise<void> => Promise.resolve();
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: async function (this: HTMLImageElement): Promise<void> {
        return decode();
      },
    });
    vi.mocked(createScannedDocument).mockResolvedValue(scannedDocument);
  });

  afterEach((): void => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
  });

  it('creates the document from the file bytes and name, and shows the file through an object URL', async (): Promise<void> => {
    const file: File = new File([new Uint8Array([1, 2, 3])], 'receipt.jpg', {
      type: 'image/jpeg',
    });

    const source: SourceImage = await sourceFromFile(file, 'document');

    expect(createScannedDocument).toHaveBeenCalledOnce();
    const [bytes, name] = vi.mocked(createScannedDocument).mock.calls[0];
    expect([...bytes]).toEqual([1, 2, 3]);
    expect(name).toBe('receipt.jpg');
    expect(created).toEqual([file]);
    expect(source.url).toBe('blob:http://localhost/image-1');
    expect(source.image).toBeInstanceOf(HTMLImageElement);
    expect(source.image.src).toBe('blob:http://localhost/image-1');
    expect(source.name).toBe('receipt');
    expect(source.scannedDocument).toBe(scannedDocument);
    expect(revoked).toEqual([]);
  });

  it.each([
    ['scan.page.one.png', 'scan.page.one'],
    ['no-extension', 'no-extension'],
    ['photo.JPEG', 'photo'],
    ['.png', 'document'],
    ['', 'document'],
  ])(
    'names the source of %j as %j',
    async (fileName: string, expected: string): Promise<void> => {
      const source: SourceImage = await sourceFromFile(
        new File(['x'], fileName),
        'document',
      );

      expect(source.name).toBe(expected);
    },
  );

  it('revokes the object URL and reports the file when the image cannot be decoded', async (): Promise<void> => {
    const cause: Error = new Error('EncodingError');
    decode = async (): Promise<void> => Promise.reject(cause);

    const result: Promise<SourceImage> = sourceFromFile(
      new File(['x'], 'broken.heic'),
      'document',
    );

    await expect(result).rejects.toThrow('Could not open broken.heic');
    await expect(result).rejects.toMatchObject({ cause });
    expect(revoked).toEqual(['blob:http://localhost/image-1']);
  });

  it('creates no object URL when the document cannot be created', async (): Promise<void> => {
    const cause: Error = new Error('unsupported');
    vi.mocked(createScannedDocument).mockRejectedValue(cause);

    const result: Promise<SourceImage> = sourceFromFile(
      new File(['x'], 'notes.txt'),
      'document',
    );

    await expect(result).rejects.toThrow('Could not open notes.txt');
    await expect(result).rejects.toMatchObject({ cause });
    expect(created).toEqual([]);
    expect(revoked).toEqual([]);
  });
});

describe('frameFromVideo', (): void => {
  function fakeVideo(width: number, height: number): HTMLVideoElement {
    const video: HTMLVideoElement = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: width });
    Object.defineProperty(video, 'videoHeight', { value: height });
    return video;
  }

  function stubToBlob(blob: Blob | null): void {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: BlobCallback, type?: string): void => {
        expect(type).toBe('image/png');
        callback(blob);
      },
    );
  }

  it('draws the current frame at the camera resolution and returns it as a PNG file', async (): Promise<void> => {
    stubCanvasContext();
    stubToBlob(new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' }));
    const video: HTMLVideoElement = fakeVideo(1920, 1080);

    const file: File = await frameFromVideo(video, 'camera-1');

    expect(contexts).toHaveLength(1);
    const canvas: HTMLCanvasElement = contexts[0].canvas;
    expect([canvas.width, canvas.height]).toEqual([1920, 1080]);
    expect(drawCalls).toEqual([{ canvas, args: [video, 0, 0] }]);
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('camera-1.png');
    expect(file.type).toBe('image/png');
    expect(await blobBytes(file)).toEqual([4, 5, 6]);
  });

  it('fails when the frame cannot be encoded', async (): Promise<void> => {
    stubCanvasContext();
    stubToBlob(null);

    await expect(frameFromVideo(fakeVideo(10, 10), 'camera')).rejects.toThrow(
      'Could not encode the camera frame',
    );
  });

  it('fails when the canvas has no 2D context', async (): Promise<void> => {
    stubCanvasContext(false);

    await expect(frameFromVideo(fakeVideo(10, 10), 'camera')).rejects.toThrow(
      'Could not get a 2D canvas context',
    );
  });
});
