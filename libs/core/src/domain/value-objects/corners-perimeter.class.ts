import type { Corner, Corners } from '../models';

/** The sides of a quadrilateral. */
export class CornersPerimeter {
  /**
   * Lists the corners going around the quadrilateral.
   *
   * @param corners the corners of the quadrilateral
   * @returns the corners in the order they are connected
   */
  public static of(corners: Corners): Corner[] {
    return [
      corners.topLeft,
      corners.topRight,
      corners.bottomRight,
      corners.bottomLeft,
    ];
  }
}
