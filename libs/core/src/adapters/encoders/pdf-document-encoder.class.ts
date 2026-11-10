import { PDFDocument, type PDFImage, type PDFPage } from 'pdf-lib';

import { type ImageDimensions, MIME_TYPE } from '../../domain/models';
import type { ImageEncoder, PdfEncoder } from '../../domain/ports';
import { PngImageEncoder } from './png-image-encoder.class';

/** The format of the PDF page. `image` makes the page the size of the image. */
export type PageFormat = 'a4' | 'letter' | 'image';

/** What can be chosen for a PDF. */
export interface PdfDocumentEncoderOptions {
  /** PDF page format. Default: a4 */
  pageFormat?: PageFormat;

  /** Page margin in points, 1 pt = 1/72 in. Default: 0 */
  margin?: number;

  /** Resolution used to size the page when `pageFormat` is `image`. Default: 150 */
  imageDpi?: number;

  /** Encodes the image embedded in the PDF, to a JPEG or a PNG. Default: `PngImageEncoder` */
  imageEncoder?: ImageEncoder;
}

/** A rectangle on the PDF page, in points. */
export interface PdfPageArea {
  /** Distance from the left edge of the page. */
  x: number;

  /** Distance from the top edge of the page. */
  y: number;

  width: number;

  height: number;
}

/** How an image is laid out on the PDF page, in points (1 pt = 1/72 in). */
export interface PdfPageLayout {
  /** The page, already turned to landscape when the image is wider than it is tall. */
  page: ImageDimensions;

  /** Where the image is drawn: centered and as large as the margin allows. */
  image: PdfPageArea;
}

const PAGE_FORMATS: Record<'a4' | 'letter', [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

const DEFAULT_IMAGE_DPI: number = 150;

const POINTS_PER_INCH: number = 72;

/** The default PDF encoder: a one page PDF with the image, built with pdf-lib. */
export class PdfDocumentEncoder implements PdfEncoder {
  public readonly mimeType: string = MIME_TYPE.PDF;

  public readonly fileExtension: string = 'pdf';

  private readonly _options: Required<PdfDocumentEncoderOptions>;

  /**
   * Creates the encoder.
   *
   * @param options what can be chosen for the PDF
   * @throws if the margin does not leave room for the image, or if `imageDpi`
   * is not positive
   */
  public constructor(options: PdfDocumentEncoderOptions = {}) {
    this._options = {
      pageFormat: options.pageFormat ?? 'a4',
      margin: options.margin ?? 0,
      imageDpi: options.imageDpi ?? DEFAULT_IMAGE_DPI,
      imageEncoder: options.imageEncoder ?? new PngImageEncoder(),
    };

    this.assertOptions();
  }

  /**
   * Makes a one page PDF with the document centered and as large as the margins
   * allow.
   *
   * @param buffer the document, as a PNG
   * @returns the PDF
   * @throws if the `imageEncoder` option does not make a JPEG or a PNG
   */
  public async encode(buffer: Uint8Array): Promise<Uint8Array> {
    const document: PDFDocument = await PDFDocument.create();
    const pdfImage: PDFImage = await this.embed(document, buffer);
    const { page: pageDimensions, image } = this.getPageLayout(pdfImage);
    const page: PDFPage = document.addPage([
      pageDimensions.width,
      pageDimensions.height,
    ]);

    // pdf-lib measures y from the bottom of the page, the layout from the top
    page.drawImage(pdfImage, {
      ...image,
      y: pageDimensions.height - image.y - image.height,
    });

    return document.save();
  }

  /**
   * Lays out an image on the page the way `encode` does, without making the
   * PDF: the page, turned to landscape for a wide image, and the image centered
   * and as large as the margins allow. A preview can draw exactly what the PDF
   * will hold.
   *
   * @param image the dimensions of the image, in pixels
   * @returns the page and where the image goes on it, in points
   */
  public getPageLayout(image: ImageDimensions): PdfPageLayout {
    const { margin } = this._options;
    const page: ImageDimensions = this.getPageDimensions(image);
    const scale: number = Math.min(
      (page.width - margin * 2) / image.width,
      (page.height - margin * 2) / image.height,
    );
    const width: number = image.width * scale;
    const height: number = image.height * scale;

    return {
      page,
      image: {
        x: (page.width - width) / 2,
        y: (page.height - height) / 2,
        width,
        height,
      },
    };
  }

  /**
   * Checks the options received by the constructor.
   *
   * @throws if the margin does not leave room for the image, or if `imageDpi`
   * is not positive
   */
  private assertOptions(): void {
    const { pageFormat, margin, imageDpi } = this._options;

    if (!Number.isFinite(imageDpi) || imageDpi <= 0) {
      throw new Error('imageDpi must be a positive number');
    }

    if (
      !Number.isFinite(margin) ||
      margin < 0 ||
      (pageFormat !== 'image' &&
        margin * 2 >= Math.min(...PAGE_FORMATS[pageFormat]))
    ) {
      throw new Error('The margin must leave room for the image on the page');
    }
  }

  /**
   * Encodes the image and adds it to the PDF.
   *
   * @param document the PDF
   * @param buffer the image, as a PNG
   * @returns the image in the PDF
   * @throws if the `imageEncoder` option does not make a JPEG or a PNG
   */
  private async embed(
    document: PDFDocument,
    buffer: Uint8Array,
  ): Promise<PDFImage> {
    const { imageEncoder } = this._options;
    const encoded: Uint8Array = await imageEncoder.encode(buffer);

    switch (imageEncoder.mimeType) {
      case MIME_TYPE.PNG:
        return document.embedPng(encoded);
      case MIME_TYPE.JPEG:
        return document.embedJpg(encoded);
      default:
        throw new Error('A PDF can only embed a JPEG or a PNG');
    }
  }

  /**
   * Finds the dimensions of the page. A fixed format turns to landscape if the
   * image is wider than it is tall.
   *
   * @param image the dimensions of the image, in pixels
   * @returns the dimensions, in points
   */
  private getPageDimensions(image: ImageDimensions): ImageDimensions {
    const { pageFormat, imageDpi, margin } = this._options;

    if (pageFormat === 'image') {
      return {
        width: (image.width * POINTS_PER_INCH) / imageDpi + margin * 2,
        height: (image.height * POINTS_PER_INCH) / imageDpi + margin * 2,
      };
    }

    const [width, height] = PAGE_FORMATS[pageFormat];

    return image.width > image.height
      ? { width: height, height: width }
      : { width, height };
  }
}
