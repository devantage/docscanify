import type { Corner, Corners } from '@devantage/docscanify';

import type { ScanCorners, ScanPoint } from './scan-corners.interface';

/** Converts the corners of docscanify to the names the node outputs. */
export class ScanCornersConverter {
  /**
   * @param corners the corners of docscanify
   * @returns the same corners, named as in the output of the node
   */
  public static fromCorners(corners: Corners): ScanCorners {
    const toPoint = ({ x, y }: Corner): ScanPoint => ({ x, y });

    return {
      topLeftCorner: toPoint(corners.topLeft),
      topRightCorner: toPoint(corners.topRight),
      bottomLeftCorner: toPoint(corners.bottomLeft),
      bottomRightCorner: toPoint(corners.bottomRight),
    };
  }
}
