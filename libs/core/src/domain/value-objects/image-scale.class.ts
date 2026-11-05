import type { Corner, Corners, ImageDimensions } from '../models';

/** A very thin image must not round down to a side that does not exist */
const MIN_SIDE: number = 1;

/** How much an image was resized from the original one. */
export class ImageScale {
  private readonly _factor: number;

  /**
   * Creates a scale from its factor.
   *
   * @param factor the side of the resized image divided by the side of the
   * original one
   */
  public constructor(factor: number) {
    this._factor = factor;
  }

  /**
   * Finds the scale that keeps the longest side within `maxDimension`, never
   * enlarging the image.
   *
   * @param dimensions the dimensions of the original image
   * @param maxDimension the limit of the longest side
   * @returns the scale
   */
  public static toFit(
    dimensions: ImageDimensions,
    maxDimension: number,
  ): ImageScale {
    return new ImageScale(
      Math.min(1, maxDimension / Math.max(dimensions.width, dimensions.height)),
    );
  }

  /**
   * Checks if this scale does not resize the image.
   *
   * @returns whether both images have the same dimensions
   */
  public keepsOriginal(): boolean {
    return this._factor === 1;
  }

  /**
   * Converts dimensions of the original image to the resized one.
   *
   * @param dimensions the dimensions of the original image
   * @returns the rounded dimensions of the resized image, with sides of at
   * least 1
   */
  public dimensionsFromOriginal(dimensions: ImageDimensions): ImageDimensions {
    return {
      width: Math.max(MIN_SIDE, Math.round(dimensions.width * this._factor)),
      height: Math.max(MIN_SIDE, Math.round(dimensions.height * this._factor)),
    };
  }

  /**
   * Converts an area measured on the resized image to the original one.
   *
   * @param area the area on the resized image
   * @returns the area on the original image
   */
  public areaToOriginal(area: number): number {
    return area / (this._factor * this._factor);
  }

  /**
   * Converts corners of the original image to the resized one.
   *
   * @param corners the corners on the original image
   * @returns the rounded corners on the resized image
   */
  public cornersFromOriginal(corners: Corners): Corners {
    return this.multiply(corners, this._factor);
  }

  /**
   * Converts corners of the resized image to the original one.
   *
   * @param corners the corners on the resized image
   * @returns the rounded corners on the original image
   */
  public cornersToOriginal(corners: Corners): Corners {
    return this.multiply(corners, 1 / this._factor);
  }

  /**
   * Multiplies the coordinates of the corners.
   *
   * @param corners the corners to multiply
   * @param factor how much to multiply
   * @returns the rounded result
   */
  private multiply(corners: Corners, factor: number): Corners {
    /**
     * Multiplies the coordinates of a corner.
     *
     * @param corner the corner to multiply
     * @returns the rounded result
     */
    const multiplyCorner = (corner: Corner): Corner => ({
      x: Math.round(corner.x * factor),
      y: Math.round(corner.y * factor),
    });

    return {
      topLeft: multiplyCorner(corners.topLeft),
      topRight: multiplyCorner(corners.topRight),
      bottomRight: multiplyCorner(corners.bottomRight),
      bottomLeft: multiplyCorner(corners.bottomLeft),
    };
  }
}
