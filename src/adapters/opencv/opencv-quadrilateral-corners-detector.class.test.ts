import type { Corners } from '../../domain/models';
import {
  createBlankPhoto,
  createDocumentPhoto,
  type DocumentPhoto,
  getMaxCornerError,
} from '../../test-helpers';
import type { OpenCvQuadrilateralCandidate } from './opencv-quadrilateral-candidate.interface';
import { OpenCvQuadrilateralCornersDetector } from './opencv-quadrilateral-corners-detector.class';

describe('OpenCvQuadrilateralCornersDetector', (): void => {
  const cornersDetector: OpenCvQuadrilateralCornersDetector =
    new OpenCvQuadrilateralCornersDetector();

  it('finds the document corners', async (): Promise<void> => {
    const photo: DocumentPhoto = createDocumentPhoto();
    const corners: Corners | null = await cornersDetector.detect(photo.buffer);

    expect(corners).not.toBeNull();
    expect(getMaxCornerError(corners as Corners, photo.corners)).toBeLessThan(
      8,
    );
  });

  it('returns corners in the coordinate system of large images', async (): Promise<void> => {
    const photo: DocumentPhoto = createDocumentPhoto(1600, 1800, {
      topLeft: { x: 280, y: 180 },
      topRight: { x: 1280, y: 240 },
      bottomRight: { x: 1340, y: 1520 },
      bottomLeft: { x: 220, y: 1460 },
    });
    const corners: Corners | null = await cornersDetector.detect(photo.buffer);

    expect(corners).not.toBeNull();
    expect(getMaxCornerError(corners as Corners, photo.corners)).toBeLessThan(
      16,
    );
  });

  it('resolves null when there is no document', async (): Promise<void> => {
    await expect(
      cornersDetector.detect(createBlankPhoto()),
    ).resolves.toBeNull();
  });

  it('reports the candidates in the coordinates of the image', async (): Promise<void> => {
    const photo: DocumentPhoto = createDocumentPhoto(1600, 1800, {
      topLeft: { x: 280, y: 180 },
      topRight: { x: 1280, y: 240 },
      bottomRight: { x: 1340, y: 1520 },
      bottomLeft: { x: 220, y: 1460 },
    });
    let candidates: OpenCvQuadrilateralCandidate[] = [];

    await new OpenCvQuadrilateralCornersDetector({
      onCandidates: (reported: OpenCvQuadrilateralCandidate[]): void => {
        candidates = reported;
      },
    }).detect(photo.buffer);

    expect(candidates.length).toBeGreaterThan(0);
    expect(
      getMaxCornerError(candidates[0].corners, photo.corners),
    ).toBeLessThan(16);
    expect(candidates[0]).toEqual({
      corners: expect.any(Object) as Corners,
      area: expect.any(Number) as number,
      edgeSupport: expect.any(Number) as number,
    });
  });

  it('does not write to the console', async (): Promise<void> => {
    const errorSpy: jest.SpyInstance = jest.spyOn(console, 'error');

    await new OpenCvQuadrilateralCornersDetector().detect(
      createDocumentPhoto().buffer,
    );

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
