import type { Corners } from '../../domain/models';
import type { OpenCvMat } from './opencv.interface';
import { OpenCvQuadrilateralEdgeSupport } from './opencv-quadrilateral-edge-support.class';

function createEdgeMap(
  cols: number,
  rows: number,
  isEdge: (x: number, y: number) => boolean,
): OpenCvMat {
  return {
    cols,
    rows,
    ucharAt: (row: number, col: number): number => (isEdge(col, row) ? 255 : 0),
  } as unknown as OpenCvMat;
}

const SQUARE: Corners = {
  topLeft: { x: 10, y: 10 },
  topRight: { x: 90, y: 10 },
  bottomRight: { x: 90, y: 90 },
  bottomLeft: { x: 10, y: 90 },
};

describe('OpenCvQuadrilateralEdgeSupport', (): void => {
  it('returns 1 when the whole perimeter lies on edges', (): void => {
    const edgeMap: OpenCvMat = createEdgeMap(
      100,
      100,
      (x: number, y: number): boolean =>
        x === 10 || x === 90 || y === 10 || y === 90,
    );

    expect(OpenCvQuadrilateralEdgeSupport.measure(edgeMap, SQUARE)).toBe(1);
  });

  it('returns 0 when no edge is found', (): void => {
    expect(
      OpenCvQuadrilateralEdgeSupport.measure(
        createEdgeMap(100, 100, (): boolean => false),
        SQUARE,
      ),
    ).toBe(0);
  });

  it('returns the fraction of the perimeter on edges', (): void => {
    const edgeMap: OpenCvMat = createEdgeMap(
      100,
      100,
      (_x: number, y: number): boolean => y === 10 || y === 90,
    );

    expect(OpenCvQuadrilateralEdgeSupport.measure(edgeMap, SQUARE)).toBeCloseTo(
      0.5,
      1,
    );
  });

  it('ignores samples outside the image and returns 0 when none is inside', (): void => {
    expect(
      OpenCvQuadrilateralEdgeSupport.measure(
        createEdgeMap(5, 5, (): boolean => true),
        SQUARE,
      ),
    ).toBe(0);
  });
});
