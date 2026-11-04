import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

import type { Corners } from '../../domain/models';
import {
  createDocumentPhoto,
  type DocumentPhoto,
  getMaxCornerError,
} from '../../test-helpers';
import { CanvasImage } from '../canvas/canvas-image.class';
import { OpenCvLargestContourCornersDetector } from './opencv-largest-contour-corners-detector.class';

function createFlatCanvas(): Canvas {
  const canvas: Canvas = createCanvas(300, 300);
  const context: SKRSContext2D = canvas.getContext('2d');

  context.fillStyle = '#808080';
  context.fillRect(0, 0, 300, 300);

  return canvas;
}

describe('OpenCvLargestContourCornersDetector', (): void => {
  const cornersDetector: OpenCvLargestContourCornersDetector =
    new OpenCvLargestContourCornersDetector();

  it('finds the document corners', async (): Promise<void> => {
    const photo: DocumentPhoto = createDocumentPhoto();
    const corners: Corners | null = await cornersDetector.detect(photo.buffer);

    expect(corners).not.toBeNull();
    expect(getMaxCornerError(corners as Corners, photo.corners)).toBeLessThan(
      8,
    );
  });

  it('resolves null when there is no contour', async (): Promise<void> => {
    await expect(
      cornersDetector.detect(new CanvasImage(createFlatCanvas()).toPng()),
    ).resolves.toBeNull();
  });

  it('resolves null when the largest contour is too small', async (): Promise<void> => {
    const canvas: Canvas = createFlatCanvas();
    const context: SKRSContext2D = canvas.getContext('2d');

    context.fillStyle = '#ffffff';
    context.fillRect(140, 140, 20, 20);

    await expect(
      cornersDetector.detect(new CanvasImage(canvas).toPng()),
    ).resolves.toBeNull();
  });
});
