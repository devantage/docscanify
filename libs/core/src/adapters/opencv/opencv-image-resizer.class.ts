import type { ImageDimensions } from '../../domain/models';
import type { ImageResizer } from '../../domain/ports';
import type { OpenCvMat } from './opencv.interface';
import { OpenCvAdapter } from './opencv-adapter.class';
import type { OpenCvImageContext } from './opencv-image-processor.class';

/** Resizes an image with OpenCV. */
export class OpenCvImageResizer extends OpenCvAdapter implements ImageResizer {
  /**
   * Resizes the image.
   *
   * @param buffer the image, as a PNG
   * @param dimensions the dimensions of the result
   * @returns the image in the given dimensions, as a PNG
   */
  public async resize(
    buffer: Uint8Array,
    dimensions: ImageDimensions,
  ): Promise<Uint8Array> {
    return this._imageProcessor.transform(
      buffer,
      ({ mat, operations }: OpenCvImageContext): OpenCvMat =>
        operations.resize(mat, dimensions),
    );
  }
}
