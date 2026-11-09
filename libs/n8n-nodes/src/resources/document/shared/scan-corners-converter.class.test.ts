import { ScanCornersConverter } from './scan-corners-converter.class';

describe('ScanCornersConverter', (): void => {
  it('renames the corners of docscanify', (): void => {
    expect(
      ScanCornersConverter.fromCorners({
        topLeft: { x: 1, y: 2 },
        topRight: { x: 3, y: 4 },
        bottomRight: { x: 5, y: 6 },
        bottomLeft: { x: 7, y: 8 },
      }),
    ).toEqual({
      topLeftCorner: { x: 1, y: 2 },
      topRightCorner: { x: 3, y: 4 },
      bottomRightCorner: { x: 5, y: 6 },
      bottomLeftCorner: { x: 7, y: 8 },
    });
  });
});
