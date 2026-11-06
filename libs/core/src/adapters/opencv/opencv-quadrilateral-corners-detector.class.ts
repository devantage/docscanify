import type { Corners } from '../../domain/models';
import type { CornersDetector } from '../../domain/ports';
import { ImageScale } from '../../domain/value-objects/image-scale.class';
import {
  OpenCvAdapter,
  type OpenCvAdapterOptions,
} from './opencv-adapter.class';
import type { OpenCvImageContext } from './opencv-image-processor.class';
import type { OpenCvQuadrilateralCandidate } from './opencv-quadrilateral-candidate.interface';
import { OpenCvQuadrilateralCandidateFinder } from './opencv-quadrilateral-candidate-finder.class';
import { OpenCvQuadrilateralCandidateSelector } from './opencv-quadrilateral-candidate-selector.class';

const DETECTION_DIMENSION: number = 800;

/** What can be chosen for the detection. */
export interface OpenCvQuadrilateralCornersDetectorOptions extends OpenCvAdapterOptions {
  /**
   * Receives the quadrilaterals considered by each detection, to diagnose its
   * result.
   *
   * @param candidates the quadrilaterals, in the coordinate system of the image
   */
  onCandidates?(candidates: OpenCvQuadrilateralCandidate[]): void;
}

/**
 * Robust detection (CamScanner style):
 * 1. downscales to ~800 px (less noise and faster)
 * 2. morphological closing erases text/photos inside the document,
 *    opening erases background texture (granite, wood, fabric)
 * 3. generates candidate masks (normal Otsu, inverted Otsu, dilated Canny)
 * 4. for each contour, approximates the convex hull with a polygon
 *    and accepts only convex quadrilaterals that cover the contour well
 * 5. keeps the largest quadrilateral well supported by real edges
 */
export class OpenCvQuadrilateralCornersDetector
  extends OpenCvAdapter
  implements CornersDetector
{
  private readonly _options: OpenCvQuadrilateralCornersDetectorOptions;

  /**
   * Creates the detector. OpenCV is only loaded when the detector is used.
   *
   * @param options what can be chosen for the detection
   */
  public constructor(options: OpenCvQuadrilateralCornersDetectorOptions = {}) {
    super(options);

    this._options = options;
  }

  /**
   * Looks for the document.
   *
   * @param buffer the image, as a PNG
   * @returns the corners in the coordinate system of the image, or `null` if no
   * quadrilateral is well supported by edges
   */
  public async detect(buffer: Uint8Array): Promise<Corners | null> {
    return this._imageProcessor.inspect(
      buffer,
      (context: OpenCvImageContext): Corners | null => {
        const { mat } = context;
        const candidates: OpenCvQuadrilateralCandidate[] =
          new OpenCvQuadrilateralCandidateFinder(context).find(
            ImageScale.toFit(
              { width: mat.cols, height: mat.rows },
              DETECTION_DIMENSION,
            ),
          );

        this._options.onCandidates?.(candidates);

        return (
          OpenCvQuadrilateralCandidateSelector.selectBest(candidates)
            ?.corners ?? null
        );
      },
    );
  }
}
