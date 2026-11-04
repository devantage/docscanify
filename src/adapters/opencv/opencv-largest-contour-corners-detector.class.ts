import type { Corners } from '../../domain/models';
import type { CornersDetector } from '../../domain/ports';
import type { OpenCvMat, OpenCvPoint } from './opencv.interface';
import { OpenCvAdapter } from './opencv-adapter.class';
import type { OpenCvContourPoint } from './opencv-contour-point.interface';
import type { OpenCvImageContext } from './opencv-image-processor.class';
import { OpenCvPlanarGeometry } from './opencv-planar-geometry.class';

/** Below this fraction of the image, the largest contour is not a document */
const MIN_DOCUMENT_AREA: number = 0.1;

const EDGE_LOW_THRESHOLD: number = 50;

const EDGE_HIGH_THRESHOLD: number = 200;

const BLUR_KERNEL_SIDE: number = 3;

/**
 * Fallback detection, based on the largest contour of the image. Ported from
 * jscanify (MIT).
 */
export class OpenCvLargestContourCornersDetector
  extends OpenCvAdapter
  implements CornersDetector
{
  /**
   * Looks for the document in the largest contour of the image.
   *
   * @param buffer the image, as a PNG
   * @returns the corners in the coordinate system of the image, or `null` if
   * the contour is too small to be a document
   */
  public async detect(buffer: Uint8Array): Promise<Corners | null> {
    return this._imageProcessor.inspect(
      buffer,
      (context: OpenCvImageContext): Corners | null => {
        const { mat } = context;
        const largest: OpenCvMat | null = this.findLargest(
          context,
          this.findContours(context),
        );
        const corners: Corners | null =
          largest && this.toCorners(context, largest);

        if (
          !corners ||
          OpenCvPlanarGeometry.getArea(corners) <
            mat.cols * mat.rows * MIN_DOCUMENT_AREA
        ) {
          return null;
        }

        return corners;
      },
    );
  }

  /**
   * Finds the contours of the edges of the image.
   *
   * @param context what is available to work on the image
   * @returns the contours
   */
  private findContours({
    cv,
    mat,
    resources,
    operations,
  }: OpenCvImageContext): OpenCvMat[] {
    const edges: OpenCvMat = resources.createMat();

    cv.Canny(mat, edges, EDGE_LOW_THRESHOLD, EDGE_HIGH_THRESHOLD);

    return operations.findContours(
      operations.applyOtsu(
        operations.blur(edges, BLUR_KERNEL_SIDE),
        cv.THRESH_BINARY,
      ),
      cv.RETR_CCOMP,
    );
  }

  /**
   * Finds the contour with the largest area.
   *
   * @param context what is available to work on the image
   * @param contours the contours to compare
   * @returns the contour, or `null` if every area is 0
   */
  private findLargest(
    { cv }: OpenCvImageContext,
    contours: OpenCvMat[],
  ): OpenCvMat | null {
    let largest: OpenCvMat | null = null;
    let largestArea: number = 0;

    for (const contour of contours) {
      const area: number = cv.contourArea(contour);

      if (area > largestArea) {
        largest = contour;
        largestArea = area;
      }
    }

    return largest;
  }

  /**
   * Picks, in each quadrant around the center of the contour, the farthest
   * point.
   *
   * @param context what is available to work on the image
   * @param contour the contour
   * @returns the corners, or `null` if a quadrant has no points
   */
  private toCorners(
    { cv }: OpenCvImageContext,
    contour: OpenCvMat,
  ): Corners | null {
    const center: OpenCvPoint = cv.minAreaRect(contour).center;
    const corners: Partial<Corners> = {};
    const distances: Partial<Record<keyof Corners, number>> = {};

    for (let index: number = 0; index < contour.data32S.length; index += 2) {
      const point: OpenCvContourPoint = {
        x: contour.data32S[index],
        y: contour.data32S[index + 1],
      };
      const quadrant: keyof Corners | null = this.getQuadrant(point, center);
      const distance: number = OpenCvPlanarGeometry.getDistance(point, center);

      if (quadrant && distance > (distances[quadrant] ?? 0)) {
        corners[quadrant] = point;
        distances[quadrant] = distance;
      }
    }

    const { topLeft, topRight, bottomLeft, bottomRight } = corners;

    return topLeft && topRight && bottomLeft && bottomRight
      ? { topLeft, topRight, bottomLeft, bottomRight }
      : null;
  }

  /**
   * Finds which corner of the document a point is closest to.
   *
   * @param point the point
   * @param center the center of the contour
   * @returns the corner, or `null` if the point is in line with the center
   */
  private getQuadrant(
    point: OpenCvContourPoint,
    center: OpenCvPoint,
  ): keyof Corners | null {
    if (point.x < center.x && point.y < center.y) {
      return 'topLeft';
    }

    if (point.x > center.x && point.y < center.y) {
      return 'topRight';
    }

    if (point.x < center.x && point.y > center.y) {
      return 'bottomLeft';
    }

    if (point.x > center.x && point.y > center.y) {
      return 'bottomRight';
    }

    return null;
  }
}
