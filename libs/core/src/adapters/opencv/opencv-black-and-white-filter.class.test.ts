import type { Canvas } from '@napi-rs/canvas';

import { createDocumentPhoto, decodeToCanvas } from '../../test-helpers';
import { OpenCvBlackAndWhiteFilter } from './opencv-black-and-white-filter.class';

describe('OpenCvBlackAndWhiteFilter', (): void => {
  const photo: Buffer = createDocumentPhoto().buffer;

  it('converts the image to black and white', async (): Promise<void> => {
    const output: Uint8Array = await new OpenCvBlackAndWhiteFilter().filter(
      photo,
    );
    const canvas: Canvas = await decodeToCanvas(output);
    const pixels: Uint8ClampedArray = canvas
      .getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height).data;

    expect(
      pixels.every((value: number): boolean => value === 0 || value === 255),
    ).toBe(true);
  });

  it('encodes as PNG', async (): Promise<void> => {
    const output: Uint8Array = await new OpenCvBlackAndWhiteFilter().filter(
      photo,
    );

    expect(Buffer.from(output).subarray(1, 4).toString()).toBe('PNG');
  });
});
