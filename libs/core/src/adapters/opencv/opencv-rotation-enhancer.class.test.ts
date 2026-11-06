import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

import { decodeToCanvas } from '../../test-helpers';
import { CanvasImage } from '../canvas/canvas-image.class';
import { OpenCvRotationEnhancer } from './opencv-rotation-enhancer.class';

/** 60x40: the left half is red, the right half is white. */
function createInput(): Uint8Array {
  const canvas: Canvas = createCanvas(60, 40);
  const context: SKRSContext2D = canvas.getContext('2d');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 60, 40);
  context.fillStyle = '#ff0000';
  context.fillRect(0, 0, 30, 40);

  return new CanvasImage(canvas).toPng();
}

function isRed(canvas: Canvas, x: number, y: number): boolean {
  const [red, green]: Uint8ClampedArray = canvas
    .getContext('2d')
    .getImageData(x, y, 1, 1).data;

  return red === 255 && green === 0;
}

describe('OpenCvRotationEnhancer', (): void => {
  it.each([1, 5, -3])(
    'rotates clockwise with %d quarter turns',
    async (quarterTurns: number): Promise<void> => {
      const output: Canvas = await decodeToCanvas(
        await new OpenCvRotationEnhancer({ quarterTurns }).enhance(
          createInput(),
        ),
      );

      expect({ width: output.width, height: output.height }).toEqual({
        width: 40,
        height: 60,
      });
      expect(isRed(output, 20, 10)).toBe(true);
      expect(isRed(output, 20, 50)).toBe(false);
    },
  );

  it('rotates counterclockwise with a negative number', async (): Promise<void> => {
    const output: Canvas = await decodeToCanvas(
      await new OpenCvRotationEnhancer({ quarterTurns: -1 }).enhance(
        createInput(),
      ),
    );

    expect(isRed(output, 20, 50)).toBe(true);
    expect(isRed(output, 20, 10)).toBe(false);
  });

  it('turns the image upside down with 2 quarter turns', async (): Promise<void> => {
    const output: Canvas = await decodeToCanvas(
      await new OpenCvRotationEnhancer({ quarterTurns: 2 }).enhance(
        createInput(),
      ),
    );

    expect(output.width).toBe(60);
    expect(isRed(output, 50, 20)).toBe(true);
    expect(isRed(output, 10, 20)).toBe(false);
  });

  it.each([0, 4, -8])(
    'keeps the image with %d quarter turns',
    async (quarterTurns: number): Promise<void> => {
      const input: Uint8Array = createInput();

      expect(
        await new OpenCvRotationEnhancer({ quarterTurns }).enhance(input),
      ).toEqual(input);
    },
  );

  it.each([1.5, NaN])(
    'rejects %d quarter turns',
    (quarterTurns: number): void => {
      expect((): void => {
        new OpenCvRotationEnhancer({ quarterTurns });
      }).toThrow('quarterTurns must be an integer');
    },
  );
});
