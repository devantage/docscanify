import {
  type Canvas,
  createCanvas,
  type Image,
  loadImage,
  type SKRSContext2D,
} from '@napi-rs/canvas';

import { createDocumentPhoto, decodeToCanvas } from '../../test-helpers';
import { CanvasImage } from '../canvas/canvas-image.class';
import { OpenCvGrayscaleFilter } from './opencv-grayscale-filter.class';

describe('OpenCvGrayscaleFilter', (): void => {
  const photo: Buffer = createDocumentPhoto().buffer;

  it('converts the image to grayscale', async (): Promise<void> => {
    const output: Uint8Array = await new OpenCvGrayscaleFilter().filter(photo);
    const { width, height } = await loadImage(photo);
    const pixels: Uint8ClampedArray = (await decodeToCanvas(output))
      .getContext('2d')
      .getImageData(0, 0, width, height).data;

    let colored: number = 0;

    for (let i: number = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== pixels[i + 1] || pixels[i] !== pixels[i + 2]) {
        colored++;
      }
    }

    expect(colored).toBe(0);
  });

  it('keeps the dimensions of the image', async (): Promise<void> => {
    const input: Image = await loadImage(photo);
    const output: Image = await loadImage(
      await new OpenCvGrayscaleFilter().filter(photo),
    );

    expect({ width: output.width, height: output.height }).toEqual({
      width: input.width,
      height: input.height,
    });
  });

  it('encodes as PNG', async (): Promise<void> => {
    const output: Uint8Array = await new OpenCvGrayscaleFilter().filter(photo);

    expect(Buffer.from(output).subarray(1, 4).toString()).toBe('PNG');
  });

  it('stretches the contrast to the whole range', async (): Promise<void> => {
    const canvas: Canvas = createCanvas(60, 40);
    const context: SKRSContext2D = canvas.getContext('2d');

    context.fillStyle = '#646464';
    context.fillRect(0, 0, 30, 40);
    context.fillStyle = '#c8c8c8';
    context.fillRect(30, 0, 30, 40);

    const pixels: SKRSContext2D = (
      await decodeToCanvas(
        await new OpenCvGrayscaleFilter().filter(
          new CanvasImage(canvas).toPng(),
        ),
      )
    ).getContext('2d');

    expect(pixels.getImageData(10, 20, 1, 1).data[0]).toBe(0);
    expect(pixels.getImageData(50, 20, 1, 1).data[0]).toBe(255);
  });

  it('keeps a blank page white', async (): Promise<void> => {
    const canvas: Canvas = createCanvas(60, 40);
    const context: SKRSContext2D = canvas.getContext('2d');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 60, 40);

    const pixels: SKRSContext2D = (
      await decodeToCanvas(
        await new OpenCvGrayscaleFilter().filter(
          new CanvasImage(canvas).toPng(),
        ),
      )
    ).getContext('2d');

    expect(pixels.getImageData(30, 20, 1, 1).data[0]).toBe(255);
  });
});
