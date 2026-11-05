import { type Canvas, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

import { decodeToCanvas } from '../../test-helpers';
import { CanvasImage } from '../canvas/canvas-image.class';
import { OpenCvSharpnessEnhancer } from './opencv-sharpness-enhancer.class';

/** An edge in the middle: dark on the left, light on the right. */
function createInput(): Uint8Array {
  const canvas: Canvas = createCanvas(60, 40);
  const context: SKRSContext2D = canvas.getContext('2d');

  context.fillStyle = '#404040';
  context.fillRect(0, 0, 30, 40);
  context.fillStyle = '#c0c0c0';
  context.fillRect(30, 0, 30, 40);

  return new CanvasImage(canvas).toPng();
}

/** The difference between the two pixels next to the edge. */
async function getEdgeContrast(png: Uint8Array): Promise<number> {
  const context: SKRSContext2D = (await decodeToCanvas(png)).getContext('2d');

  return (
    context.getImageData(30, 20, 1, 1).data[0] -
    context.getImageData(29, 20, 1, 1).data[0]
  );
}

describe('OpenCvSharpnessEnhancer', (): void => {
  it('increases the contrast of an edge, more with the strong level', async (): Promise<void> => {
    const input: Uint8Array = createInput();
    const original: number = await getEdgeContrast(input);
    const soft: number = await getEdgeContrast(
      await new OpenCvSharpnessEnhancer().enhance(input),
    );
    const strong: number = await getEdgeContrast(
      await new OpenCvSharpnessEnhancer({ level: 'strong' }).enhance(input),
    );

    expect(soft).toBeGreaterThan(original);
    expect(strong).toBeGreaterThan(soft);
  });

  it('keeps the dimensions and the opacity', async (): Promise<void> => {
    const output: Canvas = await decodeToCanvas(
      await new OpenCvSharpnessEnhancer().enhance(createInput()),
    );

    expect(output.width).toBe(60);
    expect(output.height).toBe(40);
    expect(output.getContext('2d').getImageData(30, 20, 1, 1).data[3]).toBe(
      255,
    );
  });
});
