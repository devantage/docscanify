import { type Canvas, createCanvas } from '@napi-rs/canvas';

import { CanvasImage } from '../canvas/canvas-image.class';
import { PngImageEncoder } from './png-image-encoder.class';

describe('PngImageEncoder', (): void => {
  const canvas: Canvas = createCanvas(60, 40);

  it('declares its format', (): void => {
    expect(new PngImageEncoder().mimeType).toBe('image/png');
    expect(new PngImageEncoder().fileExtension).toBe('png');
  });

  it('exports a PNG as it is', async (): Promise<void> => {
    const buffer: Uint8Array = new CanvasImage(canvas).toPng();

    await expect(new PngImageEncoder().encode(buffer)).resolves.toBe(buffer);
  });
});
