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
    const { margin } = this._options;
    const { width: pageWidth, height: pageHeight } =
      this.getPageDimensions(pdfImage);
    const scale: number = Math.min(
      (pageWidth - margin * 2) / pdfImage.width,
      (pageHeight - margin * 2) / pdfImage.height,
    );
    const drawWidth: number = pdfImage.width * scale;
    const drawHeight: number = pdfImage.height * scale;
    const page: PDFPage = document.addPage([pageWidth, pageHeight]);

    page.drawImage(pdfImage, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });

    return document.save();
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
   * @param pdfImage the image in the PDF
   * @returns the dimensions, in points
   */
  private getPageDimensions(pdfImage: PDFImage): ImageDimensions {
    const { pageFormat, imageDpi, margin } = this._options;

    if (pageFormat === 'image') {
      return {
        width: (pdfImage.width * POINTS_PER_INCH) / imageDpi + margin * 2,
        height: (pdfImage.height * POINTS_PER_INCH) / imageDpi + margin * 2,
      };
    }

    const [width, height] = PAGE_FORMATS[pageFormat];

    return pdfImage.width > pdfImage.height
      ? { width: height, height: width }
      : { width, height };
  }
}
