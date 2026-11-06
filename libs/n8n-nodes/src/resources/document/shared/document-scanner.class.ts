import {
  type Corner,
  type Corners,
  DEFAULT_ADAPTERS,
  type DocumentOutput,
  type ImageEncoder,
  type ImageEnhancer,
  type ImageFilter,
  JpegImageEncoder,
  type OnNotDetected,
  OpenCvBlackAndWhiteFilter,
  OpenCvCornersDetector,
  OpenCvGrayscaleFilter,
  OpenCvNoiseReductionEnhancer,
  type OpenCvQuadrilateralCandidate,
  OpenCvRotationEnhancer,
  OpenCvSharpnessEnhancer,
  type PageFormat,
  PdfDocumentEncoder,
  PngImageEncoder,
  ScannedDocument,
  type ScannedDocumentAdapters,
  type SharpnessLevel,
} from '@devantage/docscanify';

/** Format of the scan result. */
export type OutputFormat = 'pdf' | 'image';

/** Filter applied after cropping and enhancing. */
export type ScanFilter = 'none' | 'grayscale' | 'bw';

/** Clockwise rotation of the scanned document, in degrees. */
export type ScanRotation = 0 | 90 | 180 | 270;

/** Sharpening of the scanned document. */
export type ScanSharpness = 'off' | SharpnessLevel;

/** What can be chosen when scanning. */
export interface DocumentScannerOptions {
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

/** A point of the original image, in pixels. */
export interface ScanPoint {
  x: number;

  y: number;
}

/** The corners the document was cropped from, named as in the output of the node. */
export interface ScanCorners {
  topLeftCorner: ScanPoint;

  topRightCorner: ScanPoint;

  bottomLeftCorner: ScanPoint;

  bottomRightCorner: ScanPoint;
}

/** What scanning an image returns. */
export interface ScanResult {
  /** The scanned document, as a PDF or an image depending on the output format */
  data: Buffer;

  mimeType: string;

  fileExtension: string;

  /** Whether a document was detected; when not, the whole image was used */
  detected: boolean;

  /** The corners the document was cropped from, in pixels of the original image */
  corners: ScanCorners | null;

  /** Dimensions of the scanned document, in pixels */
  width: number;

  height: number;
}

/**
 * Scans a document out of an image with docscanify: detects it, corrects its
 * perspective, enhances and filters it, and outputs it as a PDF or an image.
 * Does not depend on n8n.
 */
export class DocumentScanner {
  public constructor(
    private readonly adapters: ScannedDocumentAdapters = DocumentScanner.createDefaultAdapters(),
  ) {}

  /**
   * The adapters of docscanify. With the `DEBUG_SCAN` environment variable,
   * the detection logs the quadrilaterals it considered and their scores, in
   * the coordinates of the image after `maxDimension`.
   */
  private static createDefaultAdapters(): ScannedDocumentAdapters {
    if (!process.env.DEBUG_SCAN) {
      return DEFAULT_ADAPTERS;
    }

    return {
      ...DEFAULT_ADAPTERS,
      cornersDetector: new OpenCvCornersDetector({
        onCandidates: (candidates: OpenCvQuadrilateralCandidate[]): void => {
          console.error(
            JSON.stringify(
              candidates.map((candidate: OpenCvQuadrilateralCandidate) => ({
                ...DocumentScanner.toScanCorners(candidate.corners),
                area: Math.round(candidate.area),
                support: +candidate.edgeSupport.toFixed(2),
              })),
            ),
          );
        },
      }),
    };
  }

  private static toScanCorners(corners: Corners): ScanCorners {
    const toPoint = ({ x, y }: Corner): ScanPoint => ({ x, y });

    return {
      topLeftCorner: toPoint(corners.topLeft),
      topRightCorner: toPoint(corners.topRight),
      bottomLeftCorner: toPoint(corners.bottomLeft),
      bottomRightCorner: toPoint(corners.bottomRight),
    };
  }

  /**
   * Scans the document of an image.
   *
   * @param image the image file, in any format the canvas reads
   * @param options what to do with the document
   * @returns the scanned document and what was done to it
   * @throws if no document is detected, unless `onNotDetected` is `original`
   */
  public async scan(
    image: Buffer,
    options: DocumentScannerOptions = {},
  ): Promise<ScanResult> {
    const filter: ScanFilter = options.filter ?? 'none';
    const document: ScannedDocument = await ScannedDocument.fromImage(
      image,
      this.adapters,
      {
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
    const output: DocumentOutput =
      options.outputFormat === 'image'
        ? await document.toImage(imageEncoder)
        : await document.toPdf(
            new PdfDocumentEncoder({
              pageFormat: options.pageSize ?? 'a4',
              margin: options.margin ?? 0,
              imageEncoder,
            }),
          );

    return {
      data: Buffer.from(output.file.buffer),
      mimeType: output.file.mimeType,
      fileExtension: output.file.fileExtension,
      detected: output.report.corners !== null,
      corners:
        output.report.corners &&
        DocumentScanner.toScanCorners(output.report.corners),
      width: output.report.dimensions.width,
      height: output.report.dimensions.height,
    };
  }

  /** The enhancers chosen, in the order they run: noise, sharpness, rotation. */
  private createEnhancers(options: DocumentScannerOptions): ImageEnhancer[] {
    const enhancers: ImageEnhancer[] = [];
    const sharpness: ScanSharpness = options.sharpness ?? 'off';
    const quarterTurns: number = (options.rotation ?? 0) / 90;

    if (options.noiseReduction) {
      enhancers.push(new OpenCvNoiseReductionEnhancer());
    }

    if (sharpness !== 'off') {
      enhancers.push(new OpenCvSharpnessEnhancer({ level: sharpness }));
    }

    if (quarterTurns % 4 !== 0) {
      enhancers.push(new OpenCvRotationEnhancer({ quarterTurns }));
    }

    return enhancers;
  }

  private createFilter(filter: ScanFilter): ImageFilter | null {
    switch (filter) {
      case 'grayscale':
        return new OpenCvGrayscaleFilter();
      case 'bw':
        return new OpenCvBlackAndWhiteFilter();
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
