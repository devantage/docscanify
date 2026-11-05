import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

import { decodeToCanvas } from '../../test-helpers';
import { CanvasImage } from '../canvas/canvas-image.class';
import { OpenCvNoiseReductionEnhancer } from './opencv-noise-reduction-enhancer.class';

/** Light gray with a fixed noise on the left half, black on the right half. */
function createInput(): Uint8Array {
  const canvas: Canvas = createCanvas(60, 40);
  const context: SKRSContext2D = canvas.getContext('2d');

  context.fillStyle = '#000000';
  context.fillRect(0, 0, 60, 40);

  for (let x: number = 0; x < 30; x++) {
    for (let y: number = 0; y < 40; y++) {
      const tone: number = 200 + ((x * 7 + y * 13) % 21) - 10;

      context.fillStyle = `rgb(${String(tone)},${String(tone)},${String(tone)})`;
      context.fillRect(x, y, 1, 1);
    }
  }

  return new CanvasImage(canvas).toPng();
}

async function getRow(png: Uint8Array): Promise<number[]> {
  const { data }: { data: Uint8ClampedArray } = (await decodeToCanvas(png))
    .getContext('2d')
    .getImageData(0, 20, 60, 1);

  return Array.from(
    { length: 60 },
    (_: unknown, x: number): number => data[x * 4],
  );
}

function getSpread(tones: number[]): number {
  return Math.max(...tones) - Math.min(...tones);
}

describe('OpenCvNoiseReductionEnhancer', (): void => {
  it('reduces the noise, keeping the edge', async (): Promise<void> => {
    const input: Uint8Array = createInput();
    const before: number[] = await getRow(input);
    const after: number[] = await getRow(
      await new OpenCvNoiseReductionEnhancer().enhance(input),
    );

    expect(getSpread(after.slice(5, 25))).toBeLessThan(
      getSpread(before.slice(5, 25)),
    );
    expect(after[25]).toBeGreaterThan(150);
    expect(after[35]).toBeLessThan(50);
  });

  it('keeps the dimensions and the opacity', async (): Promise<void> => {
    const output: Canvas = await decodeToCanvas(
      await new OpenCvNoiseReductionEnhancer().enhance(createInput()),
    );

    expect(output.width).toBe(60);
    expect(output.height).toBe(40);
    expect(output.getContext('2d').getImageData(30, 20, 1, 1).data[3]).toBe(
      255,
    );
  });
});
