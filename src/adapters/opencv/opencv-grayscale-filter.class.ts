import type { ImageFilter } from '../../domain/ports';
import { MAX_PIXEL_VALUE } from './opencv.constants';
import type { OpenCvMat } from './opencv.interface';
import { OpenCvAdapter } from './opencv-adapter.class';
import type { OpenCvImageContext } from './opencv-image-processor.class';

/** Converts the image to grayscale, stretching its contrast to the whole range. */
export class OpenCvGrayscaleFilter
  extends OpenCvAdapter
  implements ImageFilter
{
  /**
   * Converts the document to grayscale. A document with a single tone keeps it.
   *
   * @param buffer the document, as a PNG
   * @returns the filtered document, as a PNG
   */
  public async filter(buffer: Uint8Array): Promise<Uint8Array> {
    return this._imageProcessor.transform(
      buffer,
      ({ cv, mat, resources, operations }: OpenCvImageContext): OpenCvMat => {
        const gray: OpenCvMat = operations.toGray(mat);
        const { minVal, maxVal } = cv.minMaxLoc(gray, resources.createMat());

        // With a single tone there is nothing to stretch: it would become black
        if (minVal === maxVal) {
          return gray;
        }

        const stretched: OpenCvMat = resources.createMat();

        cv.normalize(gray, stretched, 0, MAX_PIXEL_VALUE, cv.NORM_MINMAX);

        return stretched;
      },
    );
  }
}
