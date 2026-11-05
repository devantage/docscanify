import {
  type Canvas,
  createCanvas,
  type Image,
  loadImage,
} from '@napi-rs/canvas';

import { createDocumentPhoto } from '../../test-helpers';
import { CanvasImage } from '../canvas/canvas-image.class';
import { JpegImageEncoder } from './jpeg-image-encoder.class';

describe('JpegImageEncoder', (): void => {
  const canvas: Canvas = createCanvas(60, 40);

  it('declares its format', (): void => {
    expect(new JpegImageEncoder().mimeType).toBe('image/jpeg');
    expect(new JpegImageEncoder().fileExtension).toBe('jpg');
  });

  it('converts a PNG, keeping its dimensions', async (): Promise<void> => {
    const output: Uint8Array = await new JpegImageEncoder().encode(
      new CanvasImage(canvas).toPng(),
    );
    const image: Image = await loadImage(output);

    expect(Array.from(output.subarray(0, 2))).toEqual([0xff, 0xd8]);
    expect({ width: image.width, height: image.height }).toEqual({
      width: 60,
      height: 40,
    });
  });

  it('encodes with the given quality', async (): Promise<void> => {
    const { buffer } = createDocumentPhoto();
    const low: Uint8Array = await new JpegImageEncoder({
      quality: 10,
    }).encode(buffer);
    const high: Uint8Array = await new JpegImageEncoder({
      quality: 100,
    }).encode(buffer);

    expect(low.length).toBeLessThan(high.length);
  });

  it('uses a quality of 85 by default', async (): Promise<void> => {
    const toJpeg: jest.SpyInstance = jest.spyOn(
      CanvasImage.prototype,
      'toJpeg',
    );

    await new JpegImageEncoder().encode(new CanvasImage(canvas).toPng());

    expect(toJpeg).toHaveBeenCalledWith(85);
    toJpeg.mockRestore();
  });

  it.each([
    [500, 100],
    [-5, 1],
  ])(
    'clamps the quality %d to %d',
    async (quality: number, clamped: number): Promise<void> => {
      const toJpeg: jest.SpyInstance = jest.spyOn(
        CanvasImage.prototype,
        'toJpeg',
      );

      await new JpegImageEncoder({ quality }).encode(
        new CanvasImage(canvas).toPng(),
      );

      expect(toJpeg).toHaveBeenCalledWith(clamped);
      toJpeg.mockRestore();
    },
  );

  it('rejects a quality that is not a number', (): void => {
    expect((): void => {
      new JpegImageEncoder({ quality: NaN });
    }).toThrow('The JPEG quality must be a number');
  });
});
