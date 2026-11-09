import {
  DEFAULT_ADAPTERS,
  DocumentScanner,
  OpenCvCornersDetector,
  type OpenCvQuadrilateralCandidate,
} from '@devantage/docscanify';

import { ScanCornersConverter } from './scan-corners-converter.class';

/** Creates the scanner the node uses. */
export class DocumentScannerFactory {
  /**
   * Creates a scanner with the adapters of docscanify. With the `DEBUG_SCAN`
   * environment variable, the detection logs the quadrilaterals it considered
   * and their scores to stderr, in the coordinates of the image after
   * `maxDimension`.
   */
  public static create(): DocumentScanner {
    if (!process.env.DEBUG_SCAN) {
      return new DocumentScanner();
    }

    return new DocumentScanner({
      ...DEFAULT_ADAPTERS,
      cornersDetector: new OpenCvCornersDetector({
        onCandidates: (candidates: OpenCvQuadrilateralCandidate[]): void => {
          console.error(
            JSON.stringify(
              candidates.map((candidate: OpenCvQuadrilateralCandidate) => ({
                ...ScanCornersConverter.fromCorners(candidate.corners),
                area: Math.round(candidate.area),
                support: +candidate.edgeSupport.toFixed(2),
              })),
            ),
          );
        },
      }),
    });
  }
}
