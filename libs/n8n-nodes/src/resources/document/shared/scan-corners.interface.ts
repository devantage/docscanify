/** A point of the original image, in pixels. */
export interface ScanPoint {
  x: number;

  y: number;
}

/** The corners the document was cropped from, named as in the output of the node. */
export interface ScanCorners {
  topLeftCorner: ScanPoint;

  topRightCorner: ScanPoint;

  bottomLeftCorner: ScanPoint;

  bottomRightCorner: ScanPoint;
}
