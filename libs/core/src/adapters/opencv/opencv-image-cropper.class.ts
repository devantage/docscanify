import type { Corners, ImageDimensions } from '../../domain/models';
import type { ImageCropper } from '../../domain/ports';
import type { OpenCv, OpenCvMat } from './opencv.interface';
import { OpenCvAdapter } from './opencv-adapter.class';
import type { OpenCvImageContext } from './opencv-image-processor.class';
import { OpenCvPlanarGeometry } from './opencv-planar-geometry.class';

/**
 * Crops the quadrilateral and corrects its perspective, to the dimensions that
 * keep its detail. Ported from jscanify (MIT).
 */
export class OpenCvImageCropper extends OpenCvAdapter implements ImageCropper {
  /**
   * Crops the quadrilateral and corrects its perspective.
   *
   * @param buffer the image, as a PNG
   * @param corners the corners of the quadrilateral, in the coordinate system
   * of the image
   * @returns the cropped document, as a PNG
   */
  public async crop(buffer: Uint8Array, corners: Corners): Promise<Uint8Array> {
    const { width, height } = this.getDimensions(corners);

    return this._imageProcessor.transform(
      buffer,
      ({ cv, mat, resources }: OpenCvImageContext): OpenCvMat => {
        const warped: OpenCvMat = resources.createMat();
        const matrix: OpenCvMat = resources.track(
          cv.getPerspectiveTransform(
            resources.track(this.toSourcePoints(cv, corners)),
            resources.track(
              cv.matFromArray(4, 1, cv.CV_32FC2, [
                0,
                0,
                width,
                0,
                0,
                height,
                width,
                height,
              ]),
            ),
          ),
        );

        cv.warpPerspective(
          mat,
          warped,
          matrix,
          new cv.Size(width, height),
          cv.INTER_LINEAR,
          cv.BORDER_CONSTANT,
          new cv.Scalar(),
        );

        return warped;
      },
    );
  }

  /**
   * Finds the dimensions of the result.
   *
   * @param corners the corners of the quadrilateral
   * @returns the longest width and the longest height of the quadrilateral
   */
  private getDimensions(corners: Corners): ImageDimensions {
    const { topLeft, topRight, bottomRight, bottomLeft } = corners;

    return {
      width: Math.round(
        Math.max(
          OpenCvPlanarGeometry.getDistance(topLeft, topRight),
          OpenCvPlanarGeometry.getDistance(bottomLeft, bottomRight),
        ),
      ),
      height: Math.round(
        Math.max(
          OpenCvPlanarGeometry.getDistance(topLeft, bottomLeft),
          OpenCvPlanarGeometry.getDistance(topRight, bottomRight),
        ),
      ),
    };
  }

  /**
   * Lists the corners in the order the perspective transform expects.
   *
   * @param cv OpenCV
   * @param corners the corners of the quadrilateral
   * @returns the points, in a Mat the caller must delete
   */
  private toSourcePoints(cv: OpenCv, corners: Corners): OpenCvMat {
    const { topLeft, topRight, bottomLeft, bottomRight } = corners;

    return cv.matFromArray(4, 1, cv.CV_32FC2, [
      topLeft.x,
      topLeft.y,
      topRight.x,
      topRight.y,
      bottomLeft.x,
      bottomLeft.y,
      bottomRight.x,
      bottomRight.y,
    ]);
  }
}
