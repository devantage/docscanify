import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

import { decodeToCanvas } from '../../test-helpers';
import { CanvasImage } from '../canvas/canvas-image.class';
import { OpenCvImageCropper } from './opencv-image-cropper.class';

describe('OpenCvImageCropper', (): void => {
  it('crops the quadrilateral to the dimensions that keep its detail', async (): Promise<void> => {
    const canvas: Canvas = createCanvas(100, 100);
    const context: SKRSContext2D = canvas.getContext('2d');

    context.fillStyle = '#000000';
    context.fillRect(0, 0, 100, 100);
    context.fillStyle = '#ffffff';
    context.fillRect(20, 30, 40, 20);

    const output: Canvas = await decodeToCanvas(
      await new OpenCvImageCropper().crop(new CanvasImage(canvas).toPng(), {
        topLeft: { x: 20, y: 30 },
        topRight: { x: 60, y: 30 },
        bottomRight: { x: 60, y: 50 },
        bottomLeft: { x: 20, y: 50 },
      }),
    );
    const center: Uint8ClampedArray = output
      .getContext('2d')
      .getImageData(20, 10, 1, 1).data;

    expect({ width: output.width, height: output.height }).toEqual({
      width: 40,
      height: 20,
    });
    expect(Array.from(center)).toEqual([255, 255, 255, 255]);
  });

  it('uses the longest opposite sides', async (): Promise<void> => {
    const output: Canvas = await decodeToCanvas(
      await new OpenCvImageCropper().crop(
        new CanvasImage(createCanvas(300, 300)).toPng(),
        {
          topLeft: { x: 0, y: 0 },
          topRight: { x: 100, y: 0 },
          bottomRight: { x: 80, y: 200 },
          bottomLeft: { x: 0, y: 150 },
        },
      ),
    );

    expect({ width: output.width, height: output.height }).toEqual({
      width: 100,
      height: 201,
    });
  });
});
