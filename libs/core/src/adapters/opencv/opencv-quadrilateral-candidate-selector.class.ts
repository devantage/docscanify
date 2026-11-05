import type { OpenCvQuadrilateralCandidate } from './opencv-quadrilateral-candidate.interface';

const STRONG_EDGE_SUPPORT: number = 0.75;

const WEAK_EDGE_SUPPORT: number = 0.5;

/** Chooses which quadrilateral is the document. */
export class OpenCvQuadrilateralCandidateSelector {
  /**
   * Picks the document among the candidates.
   *
   * @param candidates the quadrilaterals to choose from
   * @returns the largest quadrilateral well supported by edges or, if none is,
   * the best supported one, or `null` if all of them have too little support
   */
  public static selectBest(
    candidates: OpenCvQuadrilateralCandidate[],
  ): OpenCvQuadrilateralCandidate | null {
    const strong: OpenCvQuadrilateralCandidate[] = candidates
      .filter(
        (candidate: OpenCvQuadrilateralCandidate): boolean =>
          candidate.edgeSupport >= STRONG_EDGE_SUPPORT,
      )
      .sort(
        (
          a: OpenCvQuadrilateralCandidate,
          b: OpenCvQuadrilateralCandidate,
        ): number => b.area - a.area,
      );

    if (strong.length) {
      return strong[0];
    }

    const weak: OpenCvQuadrilateralCandidate[] = candidates
      .filter(
        (candidate: OpenCvQuadrilateralCandidate): boolean =>
          candidate.edgeSupport >= WEAK_EDGE_SUPPORT,
      )
      .sort(
        (
          a: OpenCvQuadrilateralCandidate,
          b: OpenCvQuadrilateralCandidate,
        ): number => b.edgeSupport - a.edgeSupport,
      );

    return weak.length ? weak[0] : null;
  }
}
