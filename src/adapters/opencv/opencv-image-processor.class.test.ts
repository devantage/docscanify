import { createBlankPhoto } from '../../test-helpers';
import { CanvasImage } from '../canvas/canvas-image.class';
import type { OpenCvMat } from './opencv.interface';
import {
  type OpenCvImageContext,
  OpenCvImageProcessor,
} from './opencv-image-processor.class';
import { OpenCvLoader } from './opencv-loader.class';
import { OpenCvResources } from './opencv-resources.class';

describe('OpenCvImageProcessor', (): void => {
  const png: Buffer = createBlankPhoto(60, 40);

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('loads OpenCV with the given options', async (): Promise<void> => {
    const load: jest.SpyInstance = jest.spyOn(OpenCvLoader, 'load');

    await new OpenCvImageProcessor({ scriptUrl: '/opencv.js' }).inspect(
      png,
      (): null => null,
    );

    expect(load).toHaveBeenCalledWith({ scriptUrl: '/opencv.js' });
  });

  it('gives an operation the image as a Mat', async (): Promise<void> => {
    await expect(
      new OpenCvImageProcessor().inspect(
        png,
        ({ mat }: OpenCvImageContext): number[] => [mat.cols, mat.rows],
      ),
    ).resolves.toEqual([60, 40]);
  });

  it('encodes the Mat an operation creates as a PNG', async (): Promise<void> => {
    const output: Uint8Array = await new OpenCvImageProcessor().transform(
      png,
      ({ cv, mat, resources }: OpenCvImageContext): OpenCvMat => {
        const gray: OpenCvMat = resources.createMat();

        cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

        return gray;
      },
    );
    const decoded: CanvasImage = await CanvasImage.fromBuffer(output);

    expect(Buffer.from(output).subarray(1, 4).toString()).toBe('PNG');
    expect(decoded.getDimensions()).toEqual({ width: 60, height: 40 });
  });

  it('releases the memory when the operation succeeds', async (): Promise<void> => {
    const release: jest.SpyInstance = jest.spyOn(
      OpenCvResources.prototype,
      'release',
    );

    await new OpenCvImageProcessor().inspect(png, (): null => null);

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases the memory when the operation fails', async (): Promise<void> => {
    const release: jest.SpyInstance = jest.spyOn(
      OpenCvResources.prototype,
      'release',
    );

    await expect(
      new OpenCvImageProcessor().inspect(png, (): never => {
        throw new Error('Failed');
      }),
    ).rejects.toThrow('Failed');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('reports an OpenCV exception as an error with its message', async (): Promise<void> => {
    const failure: unknown = await new OpenCvImageProcessor()
      .inspect(png, ({ cv, mat, resources }: OpenCvImageContext): void => {
        cv.resize(
          mat,
          resources.createMat(),
          new cv.Size(0, 0),
          0,
          0,
          cv.INTER_AREA,
        );
      })
      .catch((error: unknown): unknown => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain('resize');
  });

  it('keeps the errors of an operation as they are', async (): Promise<void> => {
    await expect(
      new OpenCvImageProcessor().inspect(png, (): void => {
        throw new Error('Failed');
      }),
    ).rejects.toThrow('Failed');
  });
});
