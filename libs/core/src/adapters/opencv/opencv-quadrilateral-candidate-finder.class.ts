import type { Corner, Corners } from '../../domain/models';
import type { ImageScale } from '../../domain/value-objects/image-scale.class';
import type { OpenCv, OpenCvMat, OpenCvPoint } from './opencv.interface';
import type { OpenCvImageContext } from './opencv-image-processor.class';
import type { OpenCvOperations } from './opencv-operations.class';
import { OpenCvPlanarGeometry } from './opencv-planar-geometry.class';
import type { OpenCvQuadrilateralCandidate } from './opencv-quadrilateral-candidate.interface';
import { OpenCvQuadrilateralEdgeSupport } from './opencv-quadrilateral-edge-support.class';
import type { OpenCvResources } from './opencv-resources.class';

/** Fractions of the perimeter tried, in order, to approximate a contour as a polygon */
const APPROXIMATION_PRECISIONS: number[] = [0.01, 0.02, 0.03, 0.05, 0.08];

/** Below this fraction of the image, a contour is noise */
const MIN_CONTOUR_AREA: number = 0.1;

/** Above this fraction of the image, a contour is the whole photo */
const MAX_CONTOUR_AREA: number = 0.97;

/** How much the area of a quadrilateral can differ from the contour it represents */
const MIN_QUADRILATERAL_COVERAGE: number = 0.9;

const MAX_QUADRILATERAL_COVERAGE: number = 1.1;

/** Large enough to erase text and background texture */
const CLEANING_KERNEL_SIDE: number = 9;

const CLEANING_ITERATIONS: number = 2;

const BLUR_KERNEL_SIDE: number = 5;

const EDGE_LOW_THRESHOLD: number = 30;

const EDGE_HIGH_THRESHOLD: number = 120;

const EDGE_KERNEL_SIDE: number = 3;

const EDGE_ITERATIONS: number = 2;

const EDGE_MAP_ITERATIONS: number = 3;

/** Finds in an image the quadrilaterals that could be the document. */
export class OpenCvQuadrilateralCandidateFinder {
  private readonly _cv: OpenCv;

  private readonly _mat: OpenCvMat;

  private readonly _resources: OpenCvResources;

  private readonly _operations: OpenCvOperations;

  private readonly _anchor: OpenCvPoint;

  /**
   * Creates a finder for an image.
   *
   * @param context what is available to work on the image
   */
  public constructor({ cv, mat, resources, operations }: OpenCvImageContext) {
    this._cv = cv;
    this._mat = mat;
    this._resources = resources;
    this._operations = operations;
    this._anchor = new cv.Point(-1, -1);
  }

  /**
   * Finds the candidates in the masks of a smaller copy of the image.
   *
   * @param scale how much to shrink the image for the detection
   * @returns the candidates, in the coordinate system of the image
   */
  public find(scale: ImageScale): OpenCvQuadrilateralCandidate[] {
    const small: OpenCvMat = this._operations.resize(
      this._mat,
      scale.dimensionsFromOriginal({
        width: this._mat.cols,
        height: this._mat.rows,
      }),
    );
    const cleaned: OpenCvMat = this.eraseDetails(small);
    const edges: OpenCvMat = this.findEdges(cleaned);
    const edgeMap: OpenCvMat = this.createEdgeMap(edges);
    const imageArea: number = small.cols * small.rows;

    return [
      this._operations.applyOtsu(cleaned, this._cv.THRESH_BINARY),
      this._operations.applyOtsu(cleaned, this._cv.THRESH_BINARY_INV),
      edges,
    ]
      .flatMap((mask: OpenCvMat): OpenCvQuadrilateralCandidate[] =>
        this.findCandidates(mask, edgeMap, imageArea),
      )
      .map(
        (
          candidate: OpenCvQuadrilateralCandidate,
        ): OpenCvQuadrilateralCandidate => ({
          corners: scale.cornersToOriginal(candidate.corners),
          area: scale.areaToOriginal(candidate.area),
          edgeSupport: candidate.edgeSupport,
        }),
      );
  }

  /**
   * Creates a rectangular kernel.
   *
   * @param side the side of the kernel
   * @returns the kernel
   */
  private createKernel(side: number): OpenCvMat {
    return this._resources.track(
      this._cv.getStructuringElement(
        this._cv.MORPH_RECT,
        new this._cv.Size(side, side),
      ),
    );
  }

  /**
   * Erases what is not the outline of the document: closing erases text/photos
   * inside of it, opening erases background texture.
   *
   * @param mat a RGBA Mat
   * @returns a blurred, single channel Mat
   */
  private eraseDetails(mat: OpenCvMat): OpenCvMat {
    const cleaned: OpenCvMat = this._resources.createMat();
    const kernel: OpenCvMat = this.createKernel(CLEANING_KERNEL_SIDE);

    this._cv.morphologyEx(
      this._operations.toGray(mat),
      cleaned,
      this._cv.MORPH_CLOSE,
      kernel,
      this._anchor,
      CLEANING_ITERATIONS,
    );
    this._cv.morphologyEx(
      cleaned,
      cleaned,
      this._cv.MORPH_OPEN,
      kernel,
      this._anchor,
      CLEANING_ITERATIONS,
    );
    return this._operations.blur(cleaned, BLUR_KERNEL_SIDE);
  }

  /**
   * Finds the edges with Canny, dilated to close their gaps.
   *
   * @param mat a single channel Mat
   * @returns the mask of the edges
   */
  private findEdges(mat: OpenCvMat): OpenCvMat {
    const edges: OpenCvMat = this._resources.createMat();

    this._cv.Canny(mat, edges, EDGE_LOW_THRESHOLD, EDGE_HIGH_THRESHOLD);
    this._cv.dilate(
      edges,
      edges,
      this.createKernel(EDGE_KERNEL_SIDE),
      this._anchor,
      EDGE_ITERATIONS,
    );

    return edges;
  }

  /**
   * Creates an untouched copy of the edges for scoring candidates (findContours
   * in this OpenCV.js version modifies its input), widened to tolerate a few
   * pixels of difference between a contour and the real edge.
   *
   * @param edges the mask of the edges
   * @returns the edge map
   */
  private createEdgeMap(edges: OpenCvMat): OpenCvMat {
    const edgeMap: OpenCvMat = this._resources.track(edges.clone());

    this._cv.dilate(
      edgeMap,
      edgeMap,
      this.createKernel(EDGE_KERNEL_SIDE),
      this._anchor,
      EDGE_MAP_ITERATIONS,
    );

    return edgeMap;
  }

  /**
   * Finds the candidates of a mask. RETR_LIST includes inner contours: the
   * inner edge of the Canny stroke is the cleanest.
   *
   * @param mask the mask to look at
   * @param edgeMap what scores the candidates
   * @param imageArea the area of the image, to discard contours too small or
   * too large
   * @returns the candidates
   */
  private findCandidates(
    mask: OpenCvMat,
    edgeMap: OpenCvMat,
    imageArea: number,
  ): OpenCvQuadrilateralCandidate[] {
    const candidates: OpenCvQuadrilateralCandidate[] = [];

    for (const contour of this._operations.findContours(
      mask,
      this._cv.RETR_LIST,
    )) {
      const area: number = this._cv.contourArea(contour);

      if (
        area < imageArea * MIN_CONTOUR_AREA ||
        area > imageArea * MAX_CONTOUR_AREA
      ) {
        continue;
      }

      const candidate: OpenCvQuadrilateralCandidate | null = this.toCandidate(
        contour,
        edgeMap,
      );

      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  /**
   * Turns a contour into a candidate.
   *
   * @param contour the contour
   * @param edgeMap what scores the candidate
   * @returns the candidate, or `null` if no quadrilateral represents the
   * contour well
   */
  private toCandidate(
    contour: OpenCvMat,
    edgeMap: OpenCvMat,
  ): OpenCvQuadrilateralCandidate | null {
    const hull: OpenCvMat = this._resources.createMat();

    this._cv.convexHull(contour, hull, false, true);

    const corners: Corners | null = this.approximate(hull);

    if (!corners) {
      return null;
    }

    const area: number = OpenCvPlanarGeometry.getArea(corners);
    const coverage: number = area / this._cv.contourArea(hull);

    if (
      coverage < MIN_QUADRILATERAL_COVERAGE ||
      coverage > MAX_QUADRILATERAL_COVERAGE
    ) {
      return null;
    }

    return {
      corners,
      area,
      edgeSupport: OpenCvQuadrilateralEdgeSupport.measure(edgeMap, corners),
    };
  }

  /**
   * Approximates a hull as a polygon, from the most precise approximation to
   * the least.
   *
   * @param hull the convex hull of a contour
   * @returns the first convex quadrilateral found, or `null` if there is none
   */
  private approximate(hull: OpenCvMat): Corners | null {
    const perimeter: number = this._cv.arcLength(hull, true);

    for (const precision of APPROXIMATION_PRECISIONS) {
      const polygon: OpenCvMat = this._resources.createMat();

      this._cv.approxPolyDP(hull, polygon, precision * perimeter, true);

      if (polygon.rows === 4 && this._cv.isContourConvex(polygon)) {
        return this.orderCorners(this.getPolygonCorners(polygon));
      }
    }

    return null;
  }

  /**
   * Reads the vertices of a polygon.
   *
   * @param polygon the polygon
   * @returns the vertices, in no particular order
   */
  private getPolygonCorners(polygon: OpenCvMat): Corner[] {
    return Array.from(
      { length: polygon.rows },
      (_: unknown, index: number): Corner => ({
        x: polygon.data32S[index * 2],
        y: polygon.data32S[index * 2 + 1],
      }),
    );
  }

  /**
   * Orders 4 corners as TL, TR, BR, BL using the sum and difference of their
   * coordinates.
   *
   * @param corners the corners, in any order
   * @returns the corners by their position
   */
  private orderCorners(corners: Corner[]): Corners {
    const bySum: Corner[] = [...corners].sort(
      (a: Corner, b: Corner): number => a.x + a.y - (b.x + b.y),
    );
    const byDiff: Corner[] = [...corners].sort(
      (a: Corner, b: Corner): number => a.y - a.x - (b.y - b.x),
    );

    return {
      topLeft: bySum[0],
      bottomRight: bySum[3],
      topRight: byDiff[0],
      bottomLeft: byDiff[3],
    };
  }
}
