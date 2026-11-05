import type { ImageEnhancer } from '../../domain/ports';
import type { OpenCvMat } from './opencv.interface';
import {
  OpenCvAdapter,
  type OpenCvAdapterOptions,
} from './opencv-adapter.class';
import type { OpenCvImageContext } from './opencv-image-processor.class';

/** How much to sharpen the image. */
export type SharpnessLevel = 'soft' | 'strong';

/** What can be chosen for the sharpening. */
export interface OpenCvSharpnessEnhancerOptions extends OpenCvAdapterOptions {
  /** How much to sharpen the image. Default: soft */
  level?: SharpnessLevel;
}

const SHARPNESS_LEVELS: Record<
  SharpnessLevel,
  { amount: number; sigma: number }
> = {
  soft: { amount: 0.6, sigma: 1 },
  strong: { amount: 1.2, sigma: 1.2 },
};

/** Sharpens the image with an unsharp mask. */
export class OpenCvSharpnessEnhancer
  extends OpenCvAdapter
  implements ImageEnhancer
{
  private readonly _level: SharpnessLevel;

  /**
   * Creates the enhancer. OpenCV is only loaded when the enhancer is used.
   *
   * @param options the level and, on browsers, the URL of the opencv.js file
   */
  public constructor(options: OpenCvSharpnessEnhancerOptions = {}) {
    super(options);

    this._level = options.level ?? 'soft';
  }

  /**
   * Sharpens the document by subtracting a blurred copy of it.
   *
   * @param buffer the document, as a PNG
   * @returns the enhanced document, as a PNG
   */
  public async enhance(buffer: Uint8Array): Promise<Uint8Array> {
    const { amount, sigma } = SHARPNESS_LEVELS[this._level];

    return this._imageProcessor.transform(
      buffer,
      ({ cv, mat, resources }: OpenCvImageContext): OpenCvMat => {
        const blurred: OpenCvMat = resources.createMat();
        const sharpened: OpenCvMat = resources.createMat();

        // A size of 0 makes OpenCV derive the kernel from the sigma
        cv.GaussianBlur(mat, blurred, new cv.Size(0, 0), sigma);
        cv.addWeighted(mat, 1 + amount, blurred, -amount, 0, sharpened);

        return sharpened;
      },
    );
  }
}
