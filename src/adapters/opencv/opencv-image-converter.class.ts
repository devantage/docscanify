import { CanvasImage } from '../canvas/canvas-image.class';
import type { OpenCv, OpenCvMat } from './opencv.interface';

/** Converts between an image in memory and an OpenCV Mat. */
export class OpenCvImageConverter {
  /**
   * Copies the pixels to a new RGBA Mat.
   *
   * @param cv OpenCV
   * @param canvasImage the image to copy
   * @returns the Mat, which the caller must delete
   */
  public static toMat(cv: OpenCv, canvasImage: CanvasImage): OpenCvMat {
    return cv.matFromImageData(canvasImage.getImageData());
  }

  /**
   * Draws a Mat on a new image.
   *
   * @param cv OpenCV
   * @param mat a RGBA or single channel Mat
   * @returns the image
   */
  public static toCanvasImage(cv: OpenCv, mat: OpenCvMat): CanvasImage {
    const rgba: OpenCvMat = new cv.Mat();

    try {
      if (mat.channels() === 1) {
        cv.cvtColor(mat, rgba, cv.COLOR_GRAY2RGBA);
      } else {
        mat.copyTo(rgba);
      }

      return CanvasImage.fromRaw({
        dimensions: { width: mat.cols, height: mat.rows },
        data: rgba.data,
      });
    } finally {
      rgba.delete();
    }
  }
}
