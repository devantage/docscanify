import type { Corner, Corners, DocumentOutput, ScanReport } from '../models';
import type {
  CornersDetector,
  DocumentEncoder,
  ImageEncoder,
  ImageEnhancer,
  ImageFilter,
  PdfEncoder,
  ScannedDocumentAdapters,
} from '../ports';
import { CornersValidator } from '../services/corners-validator.class';
import {
  DocumentIngestion,
  type DocumentIngestionOptions,
  type IngestedDocument,
} from '../services/document-ingestion.class';
import { FileContent } from '../value-objects/file-content.class';
import type { ImageScale } from '../value-objects/image-scale.class';

/**
 * What `detectCorners` does if no document is detected: fail with an error or
 * go back to the whole image.
 */
export type OnNotDetected = 'error' | 'original';

/** What can be chosen when creating a document. */
export interface ScannedDocumentOptions extends DocumentIngestionOptions {
  /** What `detectCorners` does if no document is detected. Default: error */
  onNotDetected?: OnNotDetected;
}

/** Everything a document is created with. */
interface ScannedDocumentState extends IngestedDocument {
  adapters: ScannedDocumentAdapters;

  onNotDetected: OnNotDetected;
}

/** What a render does, as it was asked for when the render started. */
interface RenderSteps {
  corners: Corners | null;

  enhancers: ImageEnhancer[];

  filter: ImageFilter | null;
}

/**
 * A document scanned from an image. Tell it what to do (detect the corners,
 * apply a filter...) and ask it for the result: it only keeps what was asked
 * for, and does the work when rendering or exporting. It only works with PNG
 * buffers and abstractions: the adapters do everything else.
 */
export class ScannedDocument {
  private readonly _adapters: ScannedDocumentAdapters;

  /** The file the document came from, as received */
  private readonly _originalFile: FileContent;

  /** The original file as a PNG, resized by `_scale`: what every render starts from */
  private readonly _workingFile: FileContent;

  private readonly _scale: ImageScale;

  private readonly _onNotDetected: OnNotDetected;

  /** In the coordinate system of `_workingFile` */
  private _corners: Corners | null = null;

  private _enhancers: ImageEnhancer[] = [];

  private _filter: ImageFilter | null = null;

  /**
   * Use `fromImage` to create a document.
   *
   * @param state the received file, ready to work on, and the adapters
   */
  private constructor(state: ScannedDocumentState) {
    this._adapters = state.adapters;
    this._originalFile = state.originalFile;
    this._workingFile = state.workingFile;
    this._scale = state.scale;
    this._onNotDetected = state.onNotDetected;
  }

  /** The file the document came from, as received. */
  public get originalFile(): FileContent {
    return this._originalFile;
  }

  /** The corners to crop from, in the coordinate system of the original image, or `null` if it is the whole image. */
  public get corners(): Corners | null {
    return this._corners && this._scale.cornersToOriginal(this._corners);
  }

  /**
   * Crops the document from the given corners, in the coordinate system of the
   * original image. The crop only happens when rendering or exporting.
   *
   * @param corners `null` goes back to the whole image
   * @throws if the corners do not form a quadrilateral or are outside of the
   * image
   */
  public set corners(corners: Corners | null) {
    const workingCorners: Corners | null =
      corners && this._scale.cornersFromOriginal(corners);

    if (workingCorners) {
      this.assertCorners(workingCorners);
    }

    this._corners = workingCorners;
  }

  /**
   * Creates a document from an image file.
   *
   * @param buffer the image file, which is copied
   * @param adapters what the document uses to work with images
   * @param options what can be chosen for this document
   * @returns the document
   * @throws if the `imageDecoder` adapter cannot read the file, if an adapter
   * does not return a PNG, or if `maxDimension` is below 1
   */
  public static async fromImage(
    buffer: Uint8Array,
    adapters: ScannedDocumentAdapters,
    options: ScannedDocumentOptions = {},
  ): Promise<ScannedDocument> {
    const ingestion: DocumentIngestion = new DocumentIngestion(
      adapters.imageDecoder,
      adapters.imageResizer,
    );

    return new ScannedDocument({
      ...(await ingestion.ingest(buffer, options)),
      adapters,
      onNotDetected: options.onNotDetected ?? 'error',
    });
  }

  /**
   * Rounds the coordinates of the corners to whole pixels.
   *
   * @param corners the corners to round
   * @returns the rounded corners
   */
  private static roundCorners(corners: Corners): Corners {
    /**
     * Rounds the coordinates of a corner.
     *
     * @param corner the corner to round
     * @returns the rounded corner
     */
    const roundCorner = (corner: Corner): Corner => ({
      x: Math.round(corner.x),
      y: Math.round(corner.y),
    });

    return {
      topLeft: roundCorner(corners.topLeft),
      topRight: roundCorner(corners.topRight),
      bottomRight: roundCorner(corners.bottomRight),
      bottomLeft: roundCorner(corners.bottomLeft),
    };
  }

  /**
   * Copies the corners, so that an adapter cannot change the ones the document
   * keeps.
   *
   * @param corners the corners to copy
   * @returns the copy
   */
  private static copyCorners(corners: Corners): Corners {
    return {
      topLeft: { ...corners.topLeft },
      topRight: { ...corners.topRight },
      bottomRight: { ...corners.bottomRight },
      bottomLeft: { ...corners.bottomLeft },
    };
  }

  /**
   * Finds the document, whose crop only happens when rendering or exporting.
   *
   * @param cornersDetector Default: the `cornersDetector` adapter of the
   * document
   * @throws if no document is detected, unless `onNotDetected` is `original`,
   * which goes back to the whole image
   * @throws if the detected corners do not form a quadrilateral or are outside
   * of the image
   */
  public async detectCorners(
    cornersDetector: CornersDetector = this._adapters.cornersDetector,
  ): Promise<void> {
    const detectedCorners: Corners | null = await cornersDetector.detect(
      this._workingFile.toBuffer(),
    );

    if (!detectedCorners && this._onNotDetected !== 'original') {
      throw new Error('No document detected in the image');
    }

    const corners: Corners | null =
      detectedCorners && ScannedDocument.roundCorners(detectedCorners);

    if (corners) {
      this.assertCorners(corners);
    }

    this._corners = corners;
  }

  /**
   * Sets what improves the cropped document before the filter, replacing the
   * current enhancers. They only run when rendering or exporting, in this order.
   *
   * @param enhancers an empty list removes the current enhancers
   */
  public applyEnhancements(enhancers: ImageEnhancer[]): void {
    this._enhancers = [...enhancers];
  }

  /**
   * Sets the filter of the cropped document, replacing the current one. The filter
   * only runs when rendering or exporting.
   *
   * @param filter `null` removes the current filter
   */
  public applyFilter(filter: ImageFilter | null): void {
    this._filter = filter;
  }

  /**
   * Renders what was asked for so far, to preview it before exporting: the image,
   * then the crop if there are corners, then the enhancers, then the filter if
   * there is one.
   *
   * @returns the document as a PNG
   * @throws if the cropper, an enhancer or the filter fails, or does not return a PNG
   */
  public async render(): Promise<Uint8Array> {
    return (await this.renderFile(this.getRenderSteps())).toBuffer();
  }

  /**
   * Gets the file the document came from.
   *
   * @returns a copy of its bytes
   */
  public toOriginalBuffer(): Uint8Array {
    return this._originalFile.toBuffer();
  }

  /**
   * Exports the document as an image.
   *
   * @param imageEncoder Default: the `imageEncoder` adapter of the document
   * @returns the exported file and the report of what was done
   * @throws if the cropper, an enhancer, the filter or the encoder fails
   */
  public async toImage(
    imageEncoder: ImageEncoder = this._adapters.imageEncoder,
  ): Promise<DocumentOutput> {
    return this.export(imageEncoder);
  }

  /**
   * Exports the document as a PDF.
   *
   * @param pdfEncoder Default: the `pdfEncoder` adapter of the document
   * @returns the exported file and the report of what was done
   * @throws if the cropper, an enhancer, the filter or the encoder fails
   */
  public async toPdf(
    pdfEncoder: PdfEncoder = this._adapters.pdfEncoder,
  ): Promise<DocumentOutput> {
    return this.export(pdfEncoder);
  }

  /**
   * Renders the document and encodes the result.
   *
   * @param documentEncoder what makes the file
   * @returns the exported file and the report of what was done
   */
  private async export(
    documentEncoder: DocumentEncoder,
  ): Promise<DocumentOutput> {
    // What was asked for up to this call: a later change does not reach this output
    const steps: RenderSteps = this.getRenderSteps();
    const file: FileContent = await this.renderFile(steps);

    return {
      file: {
        buffer: await documentEncoder.encode(file.toBuffer()),
        mimeType: documentEncoder.mimeType,
        fileExtension: documentEncoder.fileExtension,
      },
      report: this.getReport(steps.corners, file),
    };
  }

  /**
   * Checks if the corners can be cropped from the working file.
   *
   * @param corners in the coordinate system of the working file
   * @throws if the corners do not form a quadrilateral or are outside of the
   * image
   */
  private assertCorners(corners: Corners): void {
    CornersValidator.assertQuadrilateral(corners);
    CornersValidator.assertWithin(corners, this._workingFile.getDimensions());
  }

  /**
   * Takes note of what was asked for so far.
   *
   * @returns the steps of a render
   */
  private getRenderSteps(): RenderSteps {
    return {
      corners: this._corners,
      enhancers: this._enhancers,
      filter: this._filter,
    };
  }

  /**
   * Runs the steps of a render, always in the same order: crop, enhancers and
   * filter.
   *
   * @param steps what to run
   * @returns the rendered document
   */
  private async renderFile(steps: RenderSteps): Promise<FileContent> {
    const cropped: FileContent = await this.renderCrop(steps.corners);
    const enhanced: FileContent = await this.renderEnhancements(
      cropped,
      steps.enhancers,
    );

    return this.renderFilter(enhanced, steps.filter);
  }

  /**
   * Crops the document from the working file.
   *
   * @param corners `null` keeps the whole image
   * @returns the cropped document
   */
  private async renderCrop(corners: Corners | null): Promise<FileContent> {
    if (!corners) {
      return this._workingFile;
    }

    return FileContent.fromPng(
      await this._adapters.imageCropper.crop(
        this._workingFile.toBuffer(),
        ScannedDocument.copyCorners(corners),
      ),
    );
  }

  /**
   * Runs the enhancers, each one on the result of the previous one.
   *
   * @param file the cropped document
   * @param enhancers what to run, in this order
   * @returns the enhanced document
   */
  private async renderEnhancements(
    file: FileContent,
    enhancers: ImageEnhancer[],
  ): Promise<FileContent> {
    let enhanced: FileContent = file;

    for (const enhancer of enhancers) {
      enhanced = FileContent.fromPng(
        await enhancer.enhance(enhanced.toBuffer()),
      );
    }

    return enhanced;
  }

  /**
   * Runs the filter.
   *
   * @param file the enhanced document
   * @param filter `null` keeps the document as it is
   * @returns the filtered document
   */
  private async renderFilter(
    file: FileContent,
    filter: ImageFilter | null,
  ): Promise<FileContent> {
    if (!filter) {
      return file;
    }

    return FileContent.fromPng(await filter.filter(file.toBuffer()));
  }

  /**
   * Describes the result of a render.
   *
   * @param corners the corners used, in the coordinate system of the working
   * file
   * @param file the rendered document
   * @returns the report, with the corners in the coordinate system of the
   * original image
   */
  private getReport(corners: Corners | null, file: FileContent): ScanReport {
    return {
      corners: corners && this._scale.cornersToOriginal(corners),
      dimensions: file.getDimensions(),
      originalFile: this._originalFile.toMetadata(),
    };
  }
}
