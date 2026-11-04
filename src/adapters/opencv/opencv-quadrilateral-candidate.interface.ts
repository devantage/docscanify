import type { Corners } from '../../domain/models';

/** A quadrilateral considered by the detection, in the coordinate system of the image. */
export interface OpenCvQuadrilateralCandidate {
  /** The corners of the quadrilateral */
  corners: Corners;

  /** In square pixels */
  area: number;

  /** Fraction of the quadrilateral's perimeter that lies on real edges (0 to 1) */
  edgeSupport: number;
}
