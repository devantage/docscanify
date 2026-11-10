import type { ImageDimensions, PdfPageLayout } from '@devantage/docscanify';

import type { ScanPdfLayout } from './scan-document.schema';

/** Converts the PDF page layout of docscanify to what the tool returns. */
export class ScanPdfLayoutConverter {
  /**
   * @param layout the page layout of docscanify, in points
   * @param dimensions the dimensions of the document image embedded in the PDF, in pixels
   * @returns the layout as the tool returns it, with the page orientation and the scale between
   * the image pixels and the page points
   */
  public static fromLayout(
    layout: PdfPageLayout,
    dimensions: ImageDimensions,
  ): ScanPdfLayout {
    const { page, image } = layout;

    return {
      unit: 'pt',
      page: {
        width: page.width,
        height: page.height,
        orientation: page.width > page.height ? 'landscape' : 'portrait',
      },
      image: {
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height,
      },
      pixelsPerPoint: dimensions.width / image.width,
    };
  }
}
