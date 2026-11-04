import type { Corners } from '../../domain/models';
import type { OpenCvQuadrilateralCandidate } from './opencv-quadrilateral-candidate.interface';
import { OpenCvQuadrilateralCandidateSelector } from './opencv-quadrilateral-candidate-selector.class';

const CORNERS: Corners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 1, y: 0 },
  bottomRight: { x: 1, y: 1 },
  bottomLeft: { x: 0, y: 1 },
};

function createCandidate(
  area: number,
  edgeSupport: number,
): OpenCvQuadrilateralCandidate {
  return { corners: CORNERS, area, edgeSupport };
}

describe('OpenCvQuadrilateralCandidateSelector', (): void => {
  it('prefers the largest of the well supported', (): void => {
    const largest: OpenCvQuadrilateralCandidate = createCandidate(200, 0.8);

    expect(
      OpenCvQuadrilateralCandidateSelector.selectBest([
        createCandidate(100, 0.99),
        largest,
        createCandidate(300, 0.6),
      ]),
    ).toBe(largest);
  });

  it('falls back to the best supported when none is well supported', (): void => {
    const bestSupported: OpenCvQuadrilateralCandidate = createCandidate(
      100,
      0.7,
    );

    expect(
      OpenCvQuadrilateralCandidateSelector.selectBest([
        createCandidate(300, 0.5),
        bestSupported,
      ]),
    ).toBe(bestSupported);
  });

  it('returns null when none has enough support', (): void => {
    expect(
      OpenCvQuadrilateralCandidateSelector.selectBest([
        createCandidate(300, 0.49),
      ]),
    ).toBeNull();
  });

  it('returns null when there are no candidates', (): void => {
    expect(OpenCvQuadrilateralCandidateSelector.selectBest([])).toBeNull();
  });
});
