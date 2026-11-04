/** Pixels of a canvas. The array type depends on the environment. */
export interface CanvasImageDataLike {
  data: ArrayLike<number> & {
    /**
     * Overwrites the pixels.
     *
     * @param array the new RGBA values
     */
    set(array: ArrayLike<number>): void;
  };

  width: number;

  height: number;
}

/** The subset of the 2D context used by this package. */
export interface CanvasContextLike {
  /**
   * Reads the pixels of an area of the canvas.
   *
   * @param x the left of the area
   * @param y the top of the area
   * @param width the width of the area
   * @param height the height of the area
   * @returns the pixels
   */
  getImageData(
    x: number,
    y: number,
    width: number,
    height: number,
  ): CanvasImageDataLike;

  /**
   * Creates pixels that are not on the canvas yet.
   *
   * @param width in pixels
   * @param height in pixels
   * @returns the pixels
   */
  createImageData(width: number, height: number): CanvasImageDataLike;

  /**
   * Writes pixels on the canvas.
   *
   * @param imageData must come from `createImageData` or `getImageData` of the
   * same environment
   * @param x the left of the area to write
   * @param y the top of the area to write
   */
  putImageData(imageData: never, x: number, y: number): void;
}

/** A @napi-rs/canvas `Canvas` on Node.js or an `HTMLCanvasElement` on browsers. */
export interface CanvasLike {
  width: number;

  height: number;

  /**
   * Gets the 2D context.
   *
   * @param contextId always `2d`
   * @returns the context, or `null` if the canvas does not have one
   */
  getContext(contextId: '2d'): CanvasContextLike | null;
}
