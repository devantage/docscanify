/* eslint-disable @typescript-eslint/unbound-method -- these methods are mocks */
jest.mock('./opencv-quadrilateral-corners-detector.class');
jest.mock('./opencv-largest-contour-corners-detector.class');

import type { Corners } from '../../domain/models';
import { OpenCvCornersDetector } from './opencv-corners-detector.class';
import { OpenCvLargestContourCornersDetector } from './opencv-largest-contour-corners-detector.class';
import { OpenCvQuadrilateralCornersDetector } from './opencv-quadrilateral-corners-detector.class';

const CORNERS: Corners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 10, y: 0 },
  bottomRight: { x: 10, y: 10 },
  bottomLeft: { x: 0, y: 10 },
};

const png: Uint8Array = new Uint8Array([1, 2, 3]);

describe('OpenCvCornersDetector', (): void => {
  const quadrilateralDetect: jest.MockedFunction<
    OpenCvQuadrilateralCornersDetector['detect']
  > = jest.mocked(OpenCvQuadrilateralCornersDetector.prototype.detect);
  const contourDetect: jest.MockedFunction<
    OpenCvLargestContourCornersDetector['detect']
  > = jest.mocked(OpenCvLargestContourCornersDetector.prototype.detect);

  it('uses the robust detection first', async (): Promise<void> => {
    quadrilateralDetect.mockResolvedValueOnce(CORNERS);

    await expect(new OpenCvCornersDetector().detect(png)).resolves.toBe(
      CORNERS,
    );
    expect(quadrilateralDetect).toHaveBeenCalledWith(png);
    expect(contourDetect).not.toHaveBeenCalled();
  });

  it('falls back to the largest contour when the robust detection fails', async (): Promise<void> => {
    quadrilateralDetect.mockResolvedValueOnce(null);
    contourDetect.mockResolvedValueOnce(CORNERS);

    await expect(new OpenCvCornersDetector().detect(png)).resolves.toBe(
      CORNERS,
    );
    expect(contourDetect).toHaveBeenCalledWith(png);
  });

  it('resolves null when both detections fail', async (): Promise<void> => {
    quadrilateralDetect.mockResolvedValueOnce(null);
    contourDetect.mockResolvedValueOnce(null);

    await expect(new OpenCvCornersDetector().detect(png)).resolves.toBeNull();
  });

  it('gives each detection only the options it uses', (): void => {
    const onCandidates: jest.Mock = jest.fn();

    new OpenCvCornersDetector({ scriptUrl: '/opencv.js', onCandidates });

    expect(OpenCvQuadrilateralCornersDetector).toHaveBeenCalledWith({
      scriptUrl: '/opencv.js',
      onCandidates,
    });
    expect(OpenCvLargestContourCornersDetector).toHaveBeenCalledWith({
      scriptUrl: '/opencv.js',
    });
  });
});
