import { createDocumentPhoto } from '../../test-helpers';
import { CanvasImage } from '../canvas/canvas-image.class';
import { OpenCvImageResizer } from './opencv-image-resizer.class';

describe('OpenCvImageResizer', (): void => {
  it('resizes the image to the given dimensions, as a PNG', async (): Promise<void> => {
    const output: Uint8Array = await new OpenCvImageResizer().resize(
      createDocumentPhoto(800, 900).buffer,
      { width: 400, height: 450 },
    );
    const image: CanvasImage = await CanvasImage.fromBuffer(output);

    expect(Buffer.from(output).subarray(1, 4).toString()).toBe('PNG');
    expect(image.getDimensions()).toEqual({ width: 400, height: 450 });
  });
});
