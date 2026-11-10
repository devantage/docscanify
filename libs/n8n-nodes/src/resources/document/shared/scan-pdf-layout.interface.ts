/** A rectangle on the PDF page, in points, measured from the top left corner of the page. */
export interface ScanPdfArea {
  x: number;

  y: number;

  width: number;

  height: number;
}

/** How the document was laid out on the PDF page, as the node outputs it. */
export interface ScanPdfLayout {
  /** Unit of every measure: points, 1 pt = 1/72 in. */
  unit: 'pt';

  page: {
    width: number;

    height: number;

    orientation: 'portrait' | 'landscape';
  };

  /** Where the document image was drawn on the page. */
  image: ScanPdfArea;

  /**
   * Pixels of the document image per point of the page: a position found in the image, in
   * pixels, is at `image.x + px / pixelsPerPoint` on the page.
   */
  pixelsPerPoint: number;
}
