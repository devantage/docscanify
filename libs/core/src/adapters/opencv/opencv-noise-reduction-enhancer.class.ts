import type { ImageEnhancer } from '../../domain/ports';
import type { OpenCvMat } from './opencv.interface';
import { OpenCvAdapter } from './opencv-adapter.class';
import type { OpenCvImageContext } from './opencv-image-processor.class';

const NEIGHBORHOOD_DIAMETER: number = 5;

const SIGMA_COLOR: number = 40;

const SIGMA_SPACE: number = 5;

/**
 * Smooths the noise of the image, preserving the edges of the text. The result
 * is always opaque.
 */
export class OpenCvNoiseReductionEnhancer
  extends OpenCvAdapter
  implements ImageEnhancer
{
  /**
   * Smooths the noise of the document with a bilateral filter.
   *
   * @param buffer the document, as a PNG
   * @returns the enhanced document, as a PNG
   */
  public async enhance(buffer: Uint8Array): Promise<Uint8Array> {
    return this._imageProcessor.transform(
      buffer,
      ({ cv, mat, resources }: OpenCvImageContext): OpenCvMat => {
        const rgb: OpenCvMat = resources.createMat();
        const smoothed: OpenCvMat = resources.createMat();
        const rgba: OpenCvMat = resources.createMat();

        // The bilateral filter does not accept 4 channels
        cv.cvtColor(mat, rgb, cv.COLOR_RGBA2RGB);
        cv.bilateralFilter(
          rgb,
          smoothed,
          NEIGHBORHOOD_DIAMETER,
          SIGMA_COLOR,
          SIGMA_SPACE,
        );
        cv.cvtColor(smoothed, rgba, cv.COLOR_RGB2RGBA);

        return rgba;
      },
    );
  }
}
