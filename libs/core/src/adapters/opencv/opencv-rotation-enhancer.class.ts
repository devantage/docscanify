import type { ImageEnhancer } from '../../domain/ports';
import type { OpenCv, OpenCvMat } from './opencv.interface';
import {
  OpenCvAdapter,
  type OpenCvAdapterOptions,
} from './opencv-adapter.class';
import type { OpenCvImageContext } from './opencv-image-processor.class';

const QUARTER_TURNS_PER_TURN: number = 4;

/** What can be chosen for the rotation. */
export interface OpenCvRotationEnhancerOptions extends OpenCvAdapterOptions {
  /** Quarter turns: clockwise if positive, counterclockwise if negative */
  quarterTurns: number;
}

/** Rotates the image in quarter turns. */
export class OpenCvRotationEnhancer
  extends OpenCvAdapter
  implements ImageEnhancer
{
  /** From 0 to 3, clockwise */
  private readonly _quarterTurns: number;

  /**
   * Creates the enhancer. OpenCV is only loaded when the enhancer is used.
   *
   * @param options the rotation and, on browsers, the URL of the opencv.js file
   * @throws if `quarterTurns` is not an integer
   */
  public constructor(options: OpenCvRotationEnhancerOptions) {
    super(options);

    if (!Number.isInteger(options.quarterTurns)) {
      throw new Error('quarterTurns must be an integer');
    }

    this._quarterTurns =
      ((options.quarterTurns % QUARTER_TURNS_PER_TURN) +
        QUARTER_TURNS_PER_TURN) %
      QUARTER_TURNS_PER_TURN;
  }

  /**
   * Rotates the document.
   *
   * @param buffer the document, as a PNG
   * @returns the rotated document, as a PNG, or the same buffer if there is
   * nothing to rotate
   */
  public async enhance(buffer: Uint8Array): Promise<Uint8Array> {
    if (!this._quarterTurns) {
      return Promise.resolve(buffer);
    }

    return this._imageProcessor.transform(
      buffer,
      ({ cv, mat, resources }: OpenCvImageContext): OpenCvMat => {
        const rotated: OpenCvMat = resources.createMat();

        cv.rotate(mat, rotated, this.getRotateCode(cv));

        return rotated;
      },
    );
  }

  /**
   * Finds the OpenCV code of the rotation.
   *
   * @param cv OpenCV
   * @returns the code
   */
  private getRotateCode(cv: OpenCv): number {
    switch (this._quarterTurns) {
      case 1:
        return cv.ROTATE_90_CLOCKWISE;
      case 2:
        return cv.ROTATE_180;
      default:
        return cv.ROTATE_90_COUNTERCLOCKWISE;
    }
  }
}
