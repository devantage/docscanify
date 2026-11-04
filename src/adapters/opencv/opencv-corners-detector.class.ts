import type { Corners } from '../../domain/models';
import type { CornersDetector } from '../../domain/ports';
import { OpenCvLargestContourCornersDetector } from './opencv-largest-contour-corners-detector.class';
import {
  OpenCvQuadrilateralCornersDetector,
  type OpenCvQuadrilateralCornersDetectorOptions,
} from './opencv-quadrilateral-corners-detector.class';

/** What can be chosen for the detection. */
export type OpenCvCornersDetectorOptions =
  OpenCvQuadrilateralCornersDetectorOptions;

/**
 * The default detection engine: a robust detection based on edge support, with
 * a fallback based on the largest contour.
 */
export class OpenCvCornersDetector implements CornersDetector {
  private readonly _openCvQuadrilateralCornersDetector: OpenCvQuadrilateralCornersDetector;

  private readonly _openCvLargestContourCornersDetector: OpenCvLargestContourCornersDetector;

  /**
   * Creates the detector. OpenCV is only loaded when the detector is used.
   *
   * @param options what can be chosen for the detection
   */
  public constructor(options: OpenCvCornersDetectorOptions = {}) {
    this._openCvQuadrilateralCornersDetector =
      new OpenCvQuadrilateralCornersDetector(options);
    this._openCvLargestContourCornersDetector =
      new OpenCvLargestContourCornersDetector({ scriptUrl: options.scriptUrl });
  }

  /**
   * Looks for the document, trying the fallback if the robust detection finds
   * nothing.
   *
   * @param buffer the image, as a PNG
   * @returns the corners in the coordinate system of the image, or `null` if
   * there is no document
   */
  public async detect(buffer: Uint8Array): Promise<Corners | null> {
    return (
      (await this._openCvQuadrilateralCornersDetector.detect(buffer)) ??
      this._openCvLargestContourCornersDetector.detect(buffer)
    );
  }
}
