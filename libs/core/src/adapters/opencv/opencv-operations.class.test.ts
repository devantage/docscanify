import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

import { CanvasImage } from '../canvas/canvas-image.class';
import type { OpenCv, OpenCvMat } from './opencv.interface';
import { OpenCvImageConverter } from './opencv-image-converter.class';
import { OpenCvLoader } from './opencv-loader.class';
import { OpenCvOperations } from './opencv-operations.class';
import { OpenCvResources } from './opencv-resources.class';

describe('OpenCvOperations', (): void => {
  let cv: OpenCv;
  let resources: OpenCvResources;
  let operations: OpenCvOperations;
  let mat: OpenCvMat;

  beforeAll(async (): Promise<void> => {
    cv = await OpenCvLoader.load();
  });

  beforeEach((): void => {
    const canvas: Canvas = createCanvas(100, 100);
    const context: SKRSContext2D = canvas.getContext('2d');

    context.fillStyle = '#000000';
    context.fillRect(0, 0, 100, 100);
    context.fillStyle = '#ffffff';
    context.fillRect(20, 20, 60, 60);

    resources = new OpenCvResources(cv);
    operations = new OpenCvOperations(cv, resources);
    mat = resources.track(
      OpenCvImageConverter.toMat(cv, new CanvasImage(canvas)),
    );
  });

  afterEach((): void => {
    resources.release();
  });

  it('converts to a single channel', (): void => {
    expect(operations.toGray(mat).channels()).toBe(1);
  });

  it('blurs into a new Mat of the same dimensions', (): void => {
    const gray: OpenCvMat = operations.toGray(mat);
    const blurred: OpenCvMat = operations.blur(gray, 3);

    expect(blurred).not.toBe(gray);
    expect({ cols: blurred.cols, rows: blurred.rows }).toEqual({
      cols: gray.cols,
      rows: gray.rows,
    });
  });

  it('resizes to the given dimensions', (): void => {
    const resized: OpenCvMat = operations.resize(mat, {
      width: 50,
      height: 25,
    });

    expect({ cols: resized.cols, rows: resized.rows }).toEqual({
      cols: 50,
      rows: 25,
    });
  });

  it('creates a binary mask', (): void => {
    const mask: OpenCvMat = operations.applyOtsu(
      operations.toGray(mat),
      cv.THRESH_BINARY,
    );

    expect(
      Array.from(mask.data).every(
        (value: number): boolean => value === 0 || value === 255,
      ),
    ).toBe(true);
  });

  it('finds the contours of a mask', (): void => {
    const mask: OpenCvMat = operations.applyOtsu(
      operations.toGray(mat),
      cv.THRESH_BINARY,
    );

    expect(operations.findContours(mask, cv.RETR_LIST)).toHaveLength(1);
  });
});
