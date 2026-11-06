import type { ImageFilter } from '../../domain/ports';
import { MAX_PIXEL_VALUE } from './opencv.constants';
import type { OpenCvMat } from './opencv.interface';
import { OpenCvAdapter } from './opencv-adapter.class';
import type { OpenCvImageContext } from './opencv-image-processor.class';

const BLUR_KERNEL_SIDE: number = 3;

const MIN_BLOCK_SIZE: number = 15;

/** The block is this fraction of the shortest side of the image */
const BLOCK_SIZE_DIVISOR: number = 40;

const THRESHOLD_OFFSET: number = 15;

/**
 * "Document mode": adaptive threshold, good for text with shadows/uneven
 * lighting.
 */
export class OpenCvBlackAndWhiteFilter
  extends OpenCvAdapter
  implements ImageFilter
{
  /**
   * Turns each pixel black or white, comparing it to its neighbors.
   *
   * @param buffer the document, as a PNG
   * @returns the filtered document, as a PNG
   */
  public async filter(buffer: Uint8Array): Promise<Uint8Array> {
    return this._imageProcessor.transform(
      buffer,
      ({ cv, mat, resources, operations }: OpenCvImageContext): OpenCvMat => {
        const blackAndWhite: OpenCvMat = resources.createMat();

        cv.adaptiveThreshold(
          operations.blur(operations.toGray(mat), BLUR_KERNEL_SIDE),
          blackAndWhite,
          MAX_PIXEL_VALUE,
          cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          cv.THRESH_BINARY,
          this.getBlockSize(mat),
          THRESHOLD_OFFSET,
        );

        return blackAndWhite;
      },
    );
  }

  /**
   * Finds the size of the neighborhood of the adaptive threshold, which must be
   * odd.
   *
   * @param mat the image
   * @returns the size, in pixels
   */
  private getBlockSize(mat: OpenCvMat): number {
    return Math.max(
      MIN_BLOCK_SIZE,
      Math.round(Math.min(mat.cols, mat.rows) / BLOCK_SIZE_DIVISOR) | 1,
    );
  }
}
