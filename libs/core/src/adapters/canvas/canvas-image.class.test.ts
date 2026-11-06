import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

import { createBlankPhoto } from '../../test-helpers';
import { CanvasImage } from './canvas-image.class';

type Browser = { document?: unknown; createImageBitmap?: unknown };

const browser: Browser = globalThis;

describe('CanvasImage', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
    delete browser.document;
    delete browser.createImageBitmap;
  });

  describe('fromBuffer', (): void => {
    it('decodes the image on Node.js', async (): Promise<void> => {
      const image: CanvasImage = await CanvasImage.fromBuffer(
        createBlankPhoto(60, 40),
      );

      expect(image.getDimensions()).toEqual({ width: 60, height: 40 });
    });

    it('decodes the image on browsers', async (): Promise<void> => {
      const close: jest.Mock = jest.fn();
      const bitmap: { width: number; height: number; close: jest.Mock } = {
        width: 60,
        height: 40,
        close,
      };
      const drawImage: jest.Mock = jest.fn();
      const element: { width: number; height: number; getContext: jest.Mock } =
        {
          width: 0,
          height: 0,
          getContext: jest.fn().mockReturnValue({ drawImage }),
        };

      browser.document = { createElement: jest.fn().mockReturnValue(element) };
      browser.createImageBitmap = jest.fn().mockResolvedValue(bitmap);

      const image: CanvasImage = await CanvasImage.fromBuffer(
        new Uint8Array([1, 2, 3]),
      );

      expect(image.getDimensions()).toEqual({ width: 60, height: 40 });
      expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
      expect(close).toHaveBeenCalled();
    });
  });

  describe('fromRaw', (): void => {
    it('creates a DOM canvas on browsers', (): void => {
      const context: { createImageData: jest.Mock; putImageData: jest.Mock } = {
        createImageData: jest.fn().mockReturnValue({ data: new Uint8Array(4) }),
        putImageData: jest.fn(),
      };
      const element: { width: number; height: number; getContext: jest.Mock } =
        {
          width: 0,
          height: 0,
          getContext: jest.fn().mockReturnValue(context),
        };
      const createElement: jest.Mock = jest.fn().mockReturnValue(element);

      browser.document = { createElement };

      const image: CanvasImage = CanvasImage.fromRaw({
        dimensions: { width: 1, height: 2 },
        data: new Uint8Array(4),
      });

      expect(createElement).toHaveBeenCalledWith('canvas');
      expect(context.putImageData).toHaveBeenCalled();
      expect(image.getDimensions()).toEqual({ width: 1, height: 2 });
    });

    it('draws RGBA pixels', (): void => {
      const image: CanvasImage = CanvasImage.fromRaw({
        dimensions: { width: 1, height: 1 },
        data: new Uint8Array([1, 2, 3, 255]),
      });

      expect(Array.from(image.getImageData().data)).toEqual([1, 2, 3, 255]);
    });
  });

  describe('getImageData', (): void => {
    it('gives the RGBA pixels', (): void => {
      const canvas: Canvas = createCanvas(1, 1);
      const context: SKRSContext2D = canvas.getContext('2d');

      context.fillStyle = '#ff0000';
      context.fillRect(0, 0, 1, 1);

      expect(Array.from(new CanvasImage(canvas).getImageData().data)).toEqual([
        255, 0, 0, 255,
      ]);
    });
  });

  describe('toPng', (): void => {
    it('encodes as PNG', (): void => {
      const png: Uint8Array = new CanvasImage(createCanvas(40, 30)).toPng();

      expect(Buffer.from(png).subarray(1, 4).toString()).toBe('PNG');
    });

    it('encodes through a data URL on browsers', (): void => {
      const toDataURL: jest.Mock = jest
        .fn()
        .mockReturnValue('data:image/png;base64,iVBO');

      browser.document = {};

      const png: Uint8Array = new CanvasImage({
        toDataURL,
      } as unknown as HTMLCanvasElement).toPng();

      expect(toDataURL).toHaveBeenCalledWith('image/png');
      expect(Array.from(png.subarray(0, 2))).toEqual([0x89, 0x50]);
    });
  });

  describe('toJpeg', (): void => {
    const canvas: Canvas = createCanvas(40, 30);

    it('encodes with the given quality', (): void => {
      const toBufferSpy: jest.SpyInstance = jest.spyOn(canvas, 'toBuffer');
      const jpeg: Uint8Array = new CanvasImage(canvas).toJpeg(60);

      expect(toBufferSpy).toHaveBeenCalledWith('image/jpeg', 60);
      expect(Array.from(jpeg.subarray(0, 2))).toEqual([0xff, 0xd8]);
    });

    it('encodes through a data URL on browsers', (): void => {
      const toDataURL: jest.Mock = jest
        .fn()
        .mockReturnValue('data:image/jpeg;base64,/9g=');

      browser.document = {};

      const jpeg: Uint8Array = new CanvasImage({
        toDataURL,
      } as unknown as HTMLCanvasElement).toJpeg(60);

      expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.6);
      expect(Array.from(jpeg)).toEqual([0xff, 0xd8]);
    });
  });
});
