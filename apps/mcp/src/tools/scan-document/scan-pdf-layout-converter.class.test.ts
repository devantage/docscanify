import { ScanPdfLayoutConverter } from './scan-pdf-layout-converter.class';

describe('ScanPdfLayoutConverter', (): void => {
  it('returns the page, where the image was drawn and the pixels per point', (): void => {
    expect(
      ScanPdfLayoutConverter.fromLayout(
        {
          page: { width: 612, height: 792 },
          image: { x: 36, y: 126, width: 540, height: 540 },
        },
        { width: 1080, height: 1080 },
      ),
    ).toEqual({
      unit: 'pt',
      page: { width: 612, height: 792, orientation: 'portrait' },
      image: { x: 36, y: 126, width: 540, height: 540 },
      pixelsPerPoint: 2,
    });
  });

  it('tells a landscape page', (): void => {
    expect(
      ScanPdfLayoutConverter.fromLayout(
        {
          page: { width: 841.89, height: 595.28 },
          image: { x: 0, y: 87.165, width: 841.89, height: 420.945 },
        },
        { width: 1000, height: 500 },
      ).page.orientation,
    ).toBe('landscape');
  });
});
