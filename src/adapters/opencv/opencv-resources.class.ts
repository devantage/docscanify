import type {
  OpenCv,
  OpenCvDeletable,
  OpenCvMat,
  OpenCvMatVector,
} from './opencv.interface';

/** Creates and keeps the OpenCV objects of a block of work, which must be deleted by hand. */
export class OpenCvResources {
  private readonly _cv: OpenCv;

  private readonly _tracked: OpenCvDeletable[] = [];

  /**
   * Creates the resources of a block of work.
   *
   * @param cv OpenCV
   */
  public constructor(cv: OpenCv) {
    this._cv = cv;
  }

  /**
   * Creates an empty Mat.
   *
   * @returns the Mat, released with the resources
   */
  public createMat(): OpenCvMat {
    return this.track(new this._cv.Mat());
  }

  /**
   * Creates an empty list of Mats.
   *
   * @returns the list, released with the resources
   */
  public createMatVector(): OpenCvMatVector {
    return this.track(new this._cv.MatVector());
  }

  /**
   * Keeps an object that OpenCV itself created, to release it with the
   * resources.
   *
   * @template TResource the type of the object
   * @param resource the object
   * @returns the same object
   */
  public track<TResource extends OpenCvDeletable>(
    resource: TResource,
  ): TResource {
    this._tracked.push(resource);

    return resource;
  }

  /** Deletes every object it keeps. */
  public release(): void {
    for (const resource of this._tracked) {
      resource.delete();
    }
  }
}
