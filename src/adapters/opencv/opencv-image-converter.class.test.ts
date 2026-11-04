import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

import { CanvasImage } from '../canvas/canvas-image.class';
import type { OpenCv, OpenCvMat } from './opencv.interface';
import { OpenCvImageConverter } from './opencv-image-converter.class';
import { OpenCvLoader } from './opencv-loader.class';

function getPixels(image: CanvasImage): number[] {
  return Array.from(image.getImageData().data);
}

describe('OpenCvImageConverter', (): void => {
  let cv: OpenCv;

  beforeAll(async (): Promise<void> => {
    cv = await OpenCvLoader.load();
  });

  it('draws single channel Mats as RGBA', (): void => {
    const gray: OpenCvMat = cv.matFromArray(1, 2, 0, [10, 200]);
    const image: CanvasImage = OpenCvImageConverter.toCanvasImage(cv, gray);

    expect(image.getDimensions()).toEqual({ width: 2, height: 1 });
    expect(getPixels(image)).toEqual([10, 10, 10, 255, 200, 200, 200, 255]);

    gray.delete();
  });

  it('keeps RGBA Mats untouched', (): void => {
    const rgba: OpenCvMat = cv.matFromImageData({
      data: new Uint8ClampedArray([1, 2, 3, 255]),
      width: 1,
      height: 1,
    });

    expect(getPixels(OpenCvImageConverter.toCanvasImage(cv, rgba))).toEqual([
      1, 2, 3, 255,
    ]);

    rgba.delete();
  });

  it('copies the pixels to a RGBA Mat', (): void => {
    const canvas: Canvas = createCanvas(2, 1);
    const context: SKRSContext2D = canvas.getContext('2d');

    context.fillStyle = '#ff0000';
    context.fillRect(0, 0, 2, 1);

    const mat: OpenCvMat = OpenCvImageConverter.toMat(
      cv,
      new CanvasImage(canvas),
    );

    expect(mat.cols).toBe(2);
    expect(mat.rows).toBe(1);
    expect(mat.channels()).toBe(4);
    expect(Array.from(mat.data)).toEqual([255, 0, 0, 255, 255, 0, 0, 255]);

    mat.delete();
  });
});
