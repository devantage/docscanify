import type { Corner, Corners } from '../../domain/models';
import { CornersPerimeter } from '../../domain/value-objects/corners-perimeter.class';
import type { OpenCvPoint } from './opencv.interface';

/** The geometry shared by the OpenCV adapters. */
export class OpenCvPlanarGeometry {
  /**
   * Measures the distance between two points.
   *
   * @param a a point
   * @param b the other point
   * @returns the distance, in pixels
   */
  public static getDistance(a: OpenCvPoint, b: OpenCvPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /**
   * Measures the area of a quadrilateral (shoelace formula).
   *
   * @param corners the corners of the quadrilateral
   * @returns the area, in square pixels
   */
  public static getArea(corners: Corners): number {
    const points: Corner[] = CornersPerimeter.of(corners);

    let area: number = 0;

    for (let index: number = 0; index < points.length; index++) {
      const current: Corner = points[index];
      const next: Corner = points[(index + 1) % points.length];

      area += current.x * next.y - next.x * current.y;
    }

    return Math.abs(area) / 2;
  }
}
