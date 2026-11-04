import type { Corner, Corners, ImageDimensions } from '../models';
import { CornersPerimeter } from '../value-objects/corners-perimeter.class';

/** Checks what makes a set of corners usable as a document. */
export class CornersValidator {
  /**
   * Checks if the corners are the vertices of a quadrilateral, in the order of
   * their names: finite coordinates, no three of them on the same line and no
   * sides crossing each other.
   *
   * @param corners the corners to check
   * @throws if they are not
   */
  public static assertQuadrilateral(corners: Corners): void {
    const { topLeft, topRight, bottomRight, bottomLeft } = corners;
    const perimeter: Corner[] = CornersPerimeter.of(corners);
    const isQuadrilateral: boolean =
      perimeter.every(
        (corner: Corner): boolean =>
          Number.isFinite(corner.x) && Number.isFinite(corner.y),
      ) &&
      perimeter.every(
        (corner: Corner, index: number): boolean =>
          CornersValidator.getTurn(
            corner,
            perimeter[(index + 1) % perimeter.length],
            perimeter[(index + 2) % perimeter.length],
          ) !== 0,
      ) &&
      !CornersValidator.cross(topLeft, topRight, bottomRight, bottomLeft) &&
      !CornersValidator.cross(topRight, bottomRight, bottomLeft, topLeft);

    if (!isQuadrilateral) {
      throw new Error('The corners do not form a quadrilateral');
    }
  }

  /**
   * Checks if the corners are inside of an image.
   *
   * @param corners the corners to check
   * @param dimensions the dimensions of the image
   * @throws if any of the corners is outside of the image
   */
  public static assertWithin(
    corners: Corners,
    dimensions: ImageDimensions,
  ): void {
    const isWithin: boolean = CornersPerimeter.of(corners).every(
      (corner: Corner): boolean =>
        corner.x >= 0 &&
        corner.y >= 0 &&
        corner.x <= dimensions.width &&
        corner.y <= dimensions.height,
    );

    if (!isWithin) {
      throw new Error('The corners are outside of the image');
    }
  }

  /**
   * Finds which way the path turns from `a` to `c`, through `b`.
   *
   * @param a where the path starts
   * @param b where the path turns
   * @param c where the path ends
   * @returns the sign of the turn, 0 if the points are on the same line
   */
  private static getTurn(a: Corner, b: Corner, c: Corner): number {
    return Math.sign((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x));
  }

  /**
   * Checks if two segments cross each other.
   *
   * @param a the start of the first segment
   * @param b the end of the first segment
   * @param c the start of the second segment
   * @param d the end of the second segment
   * @returns whether they cross
   */
  private static cross(a: Corner, b: Corner, c: Corner, d: Corner): boolean {
    return (
      CornersValidator.getTurn(a, b, c) !== CornersValidator.getTurn(a, b, d) &&
      CornersValidator.getTurn(c, d, a) !== CornersValidator.getTurn(c, d, b)
    );
  }
}
