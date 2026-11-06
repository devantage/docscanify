import type { Corners } from '../models';
import { ImageScale } from './image-scale.class';

const CORNERS: Corners = {
  topLeft: { x: 200, y: 100 },
  topRight: { x: 800, y: 100 },
  bottomRight: { x: 800, y: 500 },
  bottomLeft: { x: 200, y: 500 },
};

describe('ImageScale', (): void => {
  it('fits the longest side within the limit', (): void => {
    const scale: ImageScale = ImageScale.toFit(
      { width: 1200, height: 800 },
      600,
    );

    expect(scale.keepsOriginal()).toBe(false);
    expect(scale.dimensionsFromOriginal({ width: 1200, height: 800 })).toEqual({
      width: 600,
      height: 400,
    });
  });

  it('keeps at least 1 px on each side', (): void => {
    expect(
      ImageScale.toFit({ width: 4000, height: 10 }, 100).dimensionsFromOriginal(
        { width: 4000, height: 10 },
      ),
    ).toEqual({ width: 100, height: 1 });
    expect(
      ImageScale.toFit({ width: 10, height: 4000 }, 100).dimensionsFromOriginal(
        { width: 10, height: 4000 },
      ),
    ).toEqual({ width: 1, height: 100 });
  });

  it('never enlarges the image', (): void => {
    expect(
      ImageScale.toFit({ width: 100, height: 50 }, 600).keepsOriginal(),
    ).toBe(true);
  });

  it('converts corners from the original image, rounding them', (): void => {
    expect(
      new ImageScale(0.5).cornersFromOriginal({
        ...CORNERS,
        topLeft: { x: 201, y: 100 },
      }),
    ).toEqual({
      topLeft: { x: 101, y: 50 },
      topRight: { x: 400, y: 50 },
      bottomRight: { x: 400, y: 250 },
      bottomLeft: { x: 100, y: 250 },
    });
  });

  it('converts corners to the original image', (): void => {
    const scale: ImageScale = new ImageScale(0.5);

    expect(scale.cornersToOriginal(scale.cornersFromOriginal(CORNERS))).toEqual(
      CORNERS,
    );
    expect(new ImageScale(1).cornersToOriginal(CORNERS)).toEqual(CORNERS);
  });

  it('converts an area to the original image', (): void => {
    expect(new ImageScale(0.5).areaToOriginal(100)).toBe(400);
  });

  it('does not change the given corners', (): void => {
    const corners: Corners = { ...CORNERS };

    new ImageScale(0.5).cornersFromOriginal(corners);

    expect(corners).toEqual(CORNERS);
  });
});
