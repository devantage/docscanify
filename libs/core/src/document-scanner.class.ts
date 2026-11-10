import { JpegImageEncoder } from './adapters/encoders/jpeg-image-encoder.class';
import {
  type PageFormat,
  PdfDocumentEncoder,
  type PdfPageLayout,
} from './adapters/encoders/pdf-document-encoder.class';
import { PngImageEncoder } from './adapters/encoders/png-image-encoder.class';
import type { OpenCvAdapterOptions } from './adapters/opencv/opencv-adapter.class';
import { OpenCvBlackAndWhiteFilter } from './adapters/opencv/opencv-black-and-white-filter.class';
import { OpenCvGrayscaleFilter } from './adapters/opencv/opencv-grayscale-filter.class';
import { OpenCvNoiseReductionEnhancer } from './adapters/opencv/opencv-noise-reduction-enhancer.class';
import { OpenCvRotationEnhancer } from './adapters/opencv/opencv-rotation-enhancer.class';
import {
  OpenCvSharpnessEnhancer,
  type SharpnessLevel,
} from './adapters/opencv/opencv-sharpness-enhancer.class';
import { DEFAULT_ADAPTERS } from './default-adapters';
import {
  type OnNotDetected,
  ScannedDocument,
} from './domain/entities/scanned-document.class';
import type { DocumentOutput } from './domain/models';
import type {
  ImageEncoder,
  ImageEnhancer,
  ImageFilter,
  ScannedDocumentAdapters,
} from './domain/ports';

/** Format of the scan result. */
export type OutputFormat = 'pdf' | 'image';

/** The scanned document, with where it was placed on the PDF page. */
export interface DocumentScannerOutput extends DocumentOutput {
  /**
   * How the document was laid out on the PDF page, in points (see
   * `PdfDocumentEncoder.getPageLayout`), or `null` for an image
   */
  pageLayout: PdfPageLayout | null;
}

/** Filter applied after cropping and enhancing. */
export type ScanFilter = 'none' | 'grayscale' | 'bw';

/** Clockwise rotation of the scanned document, in degrees. */
export type ScanRotation = 0 | 90 | 180 | 270;

/** Sharpening of the scanned document. */
export type ScanSharpness = 'off' | SharpnessLevel;

/** What can be chosen when scanning. */
export interface DocumentScannerOptions {
  /** Name of the original file, kept in `report.originalFile` */
  name?: string;

  /** Format of the scan result. Default: pdf */
  outputFormat?: OutputFormat;

  /** Filter applied after cropping and enhancing. Default: none */
  filter?: ScanFilter;

  /** Smooths the noise, preserving the edges of the text. Default: false */
  noiseReduction?: boolean;

  /** Sharpening of the document. Default: off */
  sharpness?: ScanSharpness;

  /** Clockwise rotation of the document, in degrees. Default: 0 */
  rotation?: ScanRotation;

  /** PDF page size (PDF output only). Default: a4 */
  pageSize?: PageFormat;

  /** Page margin in points, 1 pt = 1/72 in (PDF output only). Default: 0 */
  margin?: number;

  /** Longest side (px) of the image before processing. Default: 3000 */
  maxDimension?: number;

  /** JPEG quality (1 to 100). Not used by the bw filter, which is encoded as PNG. Default: 85 */
  jpegQuality?: number;

  /** What to do if no document is detected. Default: error */
  onNotDetected?: OnNotDetected;
}

/**
 * Scans a document out of an image in a single call: detects it, corrects its
 * perspective, enhances and filters it, and outputs it as a PDF or an image.
 * A ready-made recipe over `ScannedDocument`, for when the steps do not need
 * to be controlled one by one.
 */
export class DocumentScanner {
  /**
   * @param adapters the adapters of the documents it creates
   * @param openCvOptions given to the enhancers and filters it creates; on
   * browsers, must have the URL of the opencv.js file
   */
  public constructor(
    private readonly adapters: ScannedDocumentAdapters = DEFAULT_ADAPTERS,
    private readonly openCvOptions: OpenCvAdapterOptions = {},
  ) {}

  /**
   * Scans the document of an image.
   *
   * @param image the image file, in any format the `imageDecoder` reads
   * @param options what to do with the document
   * @returns the scanned document, the report of what was done to it and, for a
   * PDF, how it was laid out on the page
   * @throws if no document is detected, unless `onNotDetected` is `original`
   */
  public async scan(
    image: Uint8Array,
    options: DocumentScannerOptions = {},
  ): Promise<DocumentScannerOutput> {
    const filter: ScanFilter = options.filter ?? 'none';
    const document: ScannedDocument = await ScannedDocument.fromImage(
      image,
      this.adapters,
      {
        name: options.name,
        maxDimension: options.maxDimension,
        onNotDetected: options.onNotDetected ?? 'error',
      },
    );

    await document.detectCorners();
    document.applyEnhancements(this.createEnhancers(options));
    document.applyFilter(this.createFilter(filter));

    const imageEncoder: ImageEncoder = this.createImageEncoder(
      filter,
      options.jpegQuality,
    );

    if (options.outputFormat === 'image') {
      return { ...(await document.toImage(imageEncoder)), pageLayout: null };
    }

    const pdfEncoder: PdfDocumentEncoder = new PdfDocumentEncoder({
      pageFormat: options.pageSize ?? 'a4',
      margin: options.margin ?? 0,
      imageEncoder,
    });
    const output: DocumentOutput = await document.toPdf(pdfEncoder);

    return {
      ...output,
      pageLayout: pdfEncoder.getPageLayout(output.report.dimensions),
    };
  }

  /** The enhancers chosen, in the order they run: noise, sharpness, rotation. */
  private createEnhancers(options: DocumentScannerOptions): ImageEnhancer[] {
    const enhancers: ImageEnhancer[] = [];
    const sharpness: ScanSharpness = options.sharpness ?? 'off';
    const quarterTurns: number = (options.rotation ?? 0) / 90;

    if (options.noiseReduction) {
      enhancers.push(new OpenCvNoiseReductionEnhancer(this.openCvOptions));
    }

    if (sharpness !== 'off') {
      enhancers.push(
        new OpenCvSharpnessEnhancer({
          ...this.openCvOptions,
          level: sharpness,
        }),
      );
    }

    if (quarterTurns % 4 !== 0) {
      enhancers.push(
        new OpenCvRotationEnhancer({ ...this.openCvOptions, quarterTurns }),
      );
    }

    return enhancers;
  }

  private createFilter(filter: ScanFilter): ImageFilter | null {
    switch (filter) {
      case 'grayscale':
        return new OpenCvGrayscaleFilter(this.openCvOptions);
      case 'bw':
        return new OpenCvBlackAndWhiteFilter(this.openCvOptions);
      default:
        return null;
    }
  }

  /**
   * Encodes the image as a JPEG, or as a PNG for the black and white filter,
   * which keeps the text sharp. PDFs embed the image the same way.
   */
  private createImageEncoder(
    filter: ScanFilter,
    jpegQuality: number = 85,
  ): ImageEncoder {
    return filter === 'bw'
      ? new PngImageEncoder()
      : new JpegImageEncoder({ quality: jpegQuality });
  }
}
