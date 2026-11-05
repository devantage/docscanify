import { OpenCvPlanarGeometry } from './opencv-planar-geometry.class';

describe('OpenCvPlanarGeometry', (): void => {
  it('measures the distance between two points', (): void => {
    expect(
      OpenCvPlanarGeometry.getDistance({ x: 0, y: 0 }, { x: 3, y: 4 }),
    ).toBe(5);
  });

  it('measures the area of a rectangle', (): void => {
    expect(
      OpenCvPlanarGeometry.getArea({
        topLeft: { x: 0, y: 0 },
        topRight: { x: 10, y: 0 },
        bottomRight: { x: 10, y: 5 },
        bottomLeft: { x: 0, y: 5 },
      }),
    ).toBe(50);
  });

  it('measures the area of an irregular quadrilateral', (): void => {
    expect(
      OpenCvPlanarGeometry.getArea({
        topLeft: { x: 0, y: 0 },
        topRight: { x: 4, y: 0 },
        bottomRight: { x: 6, y: 3 },
        bottomLeft: { x: 0, y: 3 },
      }),
    ).toBe(15);
  });
});
