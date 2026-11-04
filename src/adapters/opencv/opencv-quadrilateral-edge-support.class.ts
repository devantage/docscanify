import type { Corner, Corners } from '../../domain/models';
import { CornersPerimeter } from '../../domain/value-objects/corners-perimeter.class';
import type { OpenCvMat } from './opencv.interface';
import { OpenCvPlanarGeometry } from './opencv-planar-geometry.class';

const MIN_SAMPLES_PER_SIDE: number = 10;

const PIXELS_PER_SAMPLE: number = 3;

/** How much of a quadrilateral lies on the real edges of an image. */
export class OpenCvQuadrilateralEdgeSupport {
  /**
   * Samples the perimeter of a quadrilateral, ignoring what falls outside of
   * the image.
   *
   * @param edgeMap a single channel Mat where the edges are not 0
   * @param corners the corners of the quadrilateral
   * @returns the fraction of the samples on edge pixels (0 to 1)
   */
  public static measure(edgeMap: OpenCvMat, corners: Corners): number {
    const points: Corner[] = CornersPerimeter.of(corners);

    let hit: number = 0;
    let total: number = 0;

    for (let side: number = 0; side < points.length; side++) {
      const a: Corner = points[side];
      const b: Corner = points[(side + 1) % points.length];
      const samples: number = Math.max(
        MIN_SAMPLES_PER_SIDE,
        Math.round(OpenCvPlanarGeometry.getDistance(a, b) / PIXELS_PER_SAMPLE),
      );

      for (let step: number = 1; step < samples; step++) {
        const x: number = Math.round(a.x + ((b.x - a.x) * step) / samples);
        const y: number = Math.round(a.y + ((b.y - a.y) * step) / samples);

        if (x < 0 || y < 0 || x >= edgeMap.cols || y >= edgeMap.rows) {
          continue;
        }

        total++;

        if (edgeMap.ucharAt(y, x) > 0) {
          hit++;
        }
      }
    }

    return total ? hit / total : 0;
  }
}
