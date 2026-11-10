import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  clickContinue,
  documentTiles,
  type DownloadedFile,
  type ImageInfo,
  type PdfInfo,
  readImage,
  readPdf,
  readZip,
  uploadImages,
} from '@/test-support/e2e/app';
import {
  A4,
  choose,
  type DecodedImage,
  decodeImage,
  expectedPlacement,
  expectPlacement,
  exportFile,
  fileStamp,
  LETTER,
  openExport,
  PDF_IMAGE_DPI,
  pdfImagePlacements,
  pdfImageSizes,
  POINTS_PER_MM,
  type PreviewPixels,
  resultSize,
  resultStatus,
  seenTransients,
  settledPixels,
  showDocument,
  type Size,
  sizeText,
  type Transients,
  uploadAs,
  watchTransients,
} from '@/test-support/e2e/result';

const PNG_SIGNATURE: number[] = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
];

/** The toast that confirms a file was downloaded. */
function savedToast(page: Page): Locator {
  return page.getByTestId('toast').filter({ hasText: 'File downloaded' });
}

/** Picks the page of the PDF: A4, Letter, or the size of the document (`image`). */
async function choosePage(
  page: Page,
  format: 'a4' | 'letter' | 'image',
): Promise<void> {
  await page.getByLabel('PDF page').selectOption(format);
}

/** Types the margins, in millimeters. */
async function setMargins(page: Page, millimeters: number): Promise<void> {
  await page.getByTestId('margins').fill(String(millimeters));
  await expect(page.getByTestId('margins')).toHaveValue(String(millimeters));
}

/** A "Document size" page: the image at 150 dpi, plus the margins on each side. */
function documentSizePage(size: Size, margins: number = 0): Size {
  return {
    width: (size.width * 72) / PDF_IMAGE_DPI + margins * 2,
    height: (size.height * 72) / PDF_IMAGE_DPI + margins * 2,
  };
}

/** Checks a PDF page size, to about a twentieth of a point. */
function expectPageSize(actual: Size, expected: Size): void {
  expect(actual.width).toBeCloseTo(expected.width, 1);
  expect(actual.height).toBeCloseTo(expected.height, 1);
}

/** The result size of every document, in carousel order, read from the status. */
async function documentSizes(page: Page): Promise<Size[]> {
  const sizes: Size[] = [];
  const count: number = await documentTiles(page).count();
  for (let index: number = 0; index < count; index++) {
    await showDocument(page, index);
    sizes.push(await resultSize(page));
  }
  return sizes;
}

/**
 * Checks a batch file name: `documents-<UTC date and time>.<extension>`, with a stamp between the
 * `before` and `after` ones taken around the export.
 */
function expectBatchName(
  name: string,
  extension: string,
  before: string,
  after: string,
): void {
  const match: RegExpExecArray | null = new RegExp(
    `^documents-(\\d{12})\\.${extension}$`,
  ).exec(name);
  expect(match, name).not.toBeNull();
  const stamp: string = match?.[1] ?? '';
  expect(stamp >= before && stamp <= after, stamp).toBe(true);
}

test.describe('Export step', (): void => {
  test('exports one document as an A4 PDF named after the photo, and says so', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg']);
    const size: Size = await resultSize(page);
    await expect(
      page.getByRole('radio', { name: 'PDF', exact: true }),
    ).toBeChecked();
    await expect(page.getByLabel('PDF page')).toHaveValue('a4');
    await expect(page.getByTestId('margins')).toHaveValue('0');

    const file: DownloadedFile = await exportFile(page);

    expect(file.name).toBe('invoice.pdf');
    expect(file.data.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const pdf: PdfInfo = await readPdf(file.data);
    expect(pdf.pageCount).toBe(1);
    // The invoice is taller than wide: a portrait page
    expectPageSize(pdf.pageSizes[0], A4);
    const [placement] = await pdfImagePlacements(file.data);
    expectPlacement(placement, expectedPlacement(size, A4, 0));
    // The render at full resolution, not scaled down to fit the page
    expect(await pdfImageSizes(file.data)).toEqual([size]);

    await expect(savedToast(page)).toHaveText('File downloaded: invoice.pdf');
    await expect(savedToast(page)).toHaveAttribute('data-kind', 'success');
    // The button comes back once the progress bar is done
    await expect(page.getByTestId('download')).toBeEnabled();
  });

  test('shows the progress while the file is created', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg']);
    const progress: string = '[data-testid="export-progress"]';
    const labelled: string = `${progress} [role="progressbar"][aria-label="Creating file…"]`;
    const full: string = `${progress} [role="progressbar"][aria-valuenow="100"]`;
    const buttonDuringProgress: string = `body:has(${progress}) [data-testid="download"]`;

    // The page is busy encoding: the progress is noted as it happens
    await watchTransients(page, [
      progress,
      labelled,
      full,
      buttonDuringProgress,
    ]);
    const file: DownloadedFile = await exportFile(page);

    expect(file.name).toBe('invoice.pdf');
    await expect(savedToast(page)).toHaveText('File downloaded: invoice.pdf');
    // The button comes back once the bar is done
    await expect(page.locator(progress)).toHaveCount(0);
    await expect(page.getByTestId('download')).toBeEnabled();
    // A progress bar named after the task took the place of the button, and ended full
    const seen: Transients = await seenTransients(page);
    expect(seen.selectors).toEqual([progress, labelled, full]);
  });

  test('exports Letter pages', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg']);
    const size: Size = await resultSize(page);

    await choosePage(page, 'letter');
    const file: DownloadedFile = await exportFile(page);

    expect(file.name).toBe('invoice.pdf');
    const pdf: PdfInfo = await readPdf(file.data);
    expect(pdf.pageCount).toBe(1);
    expect(pdf.pageSizes[0]).toEqual(LETTER);
    const [placement] = await pdfImagePlacements(file.data);
    expectPlacement(placement, expectedPlacement(size, LETTER, 0));
  });

  test('exports pages the size of the document, filled by the image', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg']);
    const size: Size = await resultSize(page);

    await choosePage(page, 'image');
    const file: DownloadedFile = await exportFile(page);

    const pdf: PdfInfo = await readPdf(file.data);
    expect(pdf.pageCount).toBe(1);
    const pageSize: Size = documentSizePage(size);
    expectPageSize(pdf.pageSizes[0], pageSize);
    const [placement] = await pdfImagePlacements(file.data);
    expectPlacement(placement, { x: 0, y: 0, ...pageSize });
  });

  test('turns a landscape document into a landscape A4 page', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg']);
    const size: Size = await resultSize(page);

    // Back to Adjust to turn the portrait invoice sideways
    await page.getByTestId('step-2').click();
    await page.getByRole('button', { name: 'Right', exact: true }).click();
    const landscape: Size = { width: size.height, height: size.width };
    await expect(resultStatus(page)).toHaveText(sizeText(landscape), {
      timeout: 30_000,
    });
    await page.getByTestId('continue').click();
    await expect(resultStatus(page)).toHaveText(sizeText(landscape));

    const file: DownloadedFile = await exportFile(page);

    const pdf: PdfInfo = await readPdf(file.data);
    expectPageSize(pdf.pageSizes[0], { width: A4.height, height: A4.width });
    const [placement] = await pdfImagePlacements(file.data);
    expectPlacement(
      placement,
      expectedPlacement(landscape, { width: A4.height, height: A4.width }, 0),
    );
  });

  test('applies the margins in millimeters around the image of an A4 page', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg']);
    const size: Size = await resultSize(page);
    const noMargins: DownloadedFile = await exportFile(page);

    await setMargins(page, 20);
    const withMargins: DownloadedFile = await exportFile(page);

    expect(withMargins.data.equals(noMargins.data)).toBe(false);
    const pdf: PdfInfo = await readPdf(withMargins.data);
    expect(pdf.pageCount).toBe(1);
    // Same page, smaller image, centered inside the margins
    expectPageSize(pdf.pageSizes[0], A4);
    const margins: number = 20 * POINTS_PER_MM;
    const [before] = await pdfImagePlacements(noMargins.data);
    const [after] = await pdfImagePlacements(withMargins.data);
    expectPlacement(after, expectedPlacement(size, A4, margins));
    expect(after.width).toBeLessThan(before.width);
    expect(after.height).toBeLessThan(before.height);
    expect(Math.min(after.x, after.y)).toBeCloseTo(margins, 1);
    expect(after.x + after.width).toBeLessThanOrEqual(
      A4.width - margins + 0.01,
    );
    expect(after.y + after.height).toBeLessThanOrEqual(
      A4.height - margins + 0.01,
    );
  });

  test('adds the margins around a page the size of the document', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg']);
    const size: Size = await resultSize(page);

    await choosePage(page, 'image');
    await setMargins(page, 10);
    const file: DownloadedFile = await exportFile(page);

    const margins: number = 10 * POINTS_PER_MM;
    const pdf: PdfInfo = await readPdf(file.data);
    expectPageSize(pdf.pageSizes[0], documentSizePage(size, margins));
    const [placement] = await pdfImagePlacements(file.data);
    expectPlacement(placement, {
      x: margins,
      y: margins,
      ...documentSizePage(size),
    });
  });

  test('limits the margins to 100 mm, which still exports a valid Letter page', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg']);
    const size: Size = await resultSize(page);

    await choosePage(page, 'letter');
    // Neither negative nor larger than 100 mm
    await page.getByTestId('margins').fill('-5');
    await expect(page.getByTestId('margins')).toHaveValue('0');
    await page.getByTestId('margins').fill('150');
    await expect(page.getByTestId('margins')).toHaveValue('100');
    const file: DownloadedFile = await exportFile(page);

    const pdf: PdfInfo = await readPdf(file.data);
    expect(pdf.pageSizes[0]).toEqual(LETTER);
    const [placement] = await pdfImagePlacements(file.data);
    expectPlacement(
      placement,
      expectedPlacement(size, LETTER, 100 * POINTS_PER_MM),
    );
  });

  test('exports several documents as one PDF, one page per document in carousel order', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg', 'receipt.jpg']);
    const [invoice, receipt] = await documentSizes(page);
    expect(invoice).not.toEqual(receipt);
    await expect(
      page.getByRole('radio', { name: 'One PDF with everything', exact: true }),
    ).toBeChecked();

    // Pages the size of each document, to tell them apart
    await choosePage(page, 'image');
    const before: string = fileStamp();
    const file: DownloadedFile = await exportFile(page);
    const after: string = fileStamp();

    expectBatchName(file.name, 'pdf', before, after);
    const pdf: PdfInfo = await readPdf(file.data);
    expect(pdf.pageCount).toBe(2);
    expectPageSize(pdf.pageSizes[0], documentSizePage(invoice));
    expectPageSize(pdf.pageSizes[1], documentSizePage(receipt));
    expect(await pdfImageSizes(file.data)).toEqual([invoice, receipt]);
    await expect(savedToast(page)).toHaveText(`File downloaded: ${file.name}`);

    // The receipt goes first: the pages follow
    await showDocument(page, 0);
    await page.getByTestId('doc-0').press('Alt+ArrowRight');
    await expect(resultStatus(page)).toHaveText(
      `Document 2 of 2 · ${sizeText(invoice)}`,
    );
    const reordered: DownloadedFile = await exportFile(page);

    const swapped: PdfInfo = await readPdf(reordered.data);
    expect(swapped.pageCount).toBe(2);
    expectPageSize(swapped.pageSizes[0], documentSizePage(receipt));
    expectPageSize(swapped.pageSizes[1], documentSizePage(invoice));
    expect(await pdfImageSizes(reordered.data)).toEqual([receipt, invoice]);
  });

  test('exports one PDF per document in a ZIP, numbered in carousel order', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg', 'receipt.jpg']);
    const sizes: Size[] = await documentSizes(page);

    await choose(page, 'One PDF per document');
    await expect(
      page.getByText('The PDFs are downloaded together, in a ZIP file.'),
    ).toBeVisible();
    const before: string = fileStamp();
    const file: DownloadedFile = await exportFile(page);
    const after: string = fileStamp();

    expectBatchName(file.name, 'zip', before, after);
    const zip: Map<string, Uint8Array> = readZip(file.data);
    expect([...zip.keys()]).toEqual(['1-invoice.pdf', '2-receipt.pdf']);
    // Each PDF holds its own document, on an A4 page
    for (const [index, pdfData] of [...zip.values()].entries()) {
      const pdf: PdfInfo = await readPdf(pdfData);
      expect(pdf.pageCount).toBe(1);
      expectPageSize(pdf.pageSizes[0], A4);
      expect(await pdfImageSizes(pdfData)).toEqual([sizes[index]]);
      const [placement] = await pdfImagePlacements(pdfData);
      expectPlacement(placement, expectedPlacement(sizes[index], A4, 0));
    }
    await expect(savedToast(page)).toHaveText(`File downloaded: ${file.name}`);
  });

  test('exports a PNG the size of the result, without PDF options', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg']);
    const size: Size = await resultSize(page);
    const shown: PreviewPixels = await settledPixels(page);

    await choose(page, 'PNG');
    await expect(page.getByLabel('PDF page')).toHaveCount(0);
    await expect(page.getByTestId('margins')).toHaveCount(0);
    const file: DownloadedFile = await exportFile(page);

    expect(file.name).toBe('invoice.png');
    expect([...file.data.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    const image: ImageInfo = readImage(file.data);
    expect(image).toEqual({ format: 'png', ...size });
    // The colors of the photo, as the Color filter is on: the very pixels of the preview
    const decoded: DecodedImage = await decodeImage(page, file.data);
    expect(decoded.maxChannelSpread).toBeGreaterThan(60);
    expect(decoded.checksum).toBe(shown.checksum);
    await expect(savedToast(page)).toHaveText('File downloaded: invoice.png');
  });

  test('exports a JPG the size of the result', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg']);
    const size: Size = await resultSize(page);

    await choose(page, 'JPG');
    const file: DownloadedFile = await exportFile(page);

    expect(file.name).toBe('invoice.jpg');
    expect([...file.data.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect([...file.data.subarray(-2)]).toEqual([0xff, 0xd9]);
    expect(readImage(file.data)).toEqual({ format: 'jpeg', ...size });
    expect(
      (await decodeImage(page, file.data)).maxChannelSpread,
    ).toBeGreaterThan(60);
    await expect(savedToast(page)).toHaveText('File downloaded: invoice.jpg');
  });

  test('exports several documents as PNG or JPG files in a ZIP, numbered in carousel order', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg', 'receipt.jpg']);
    const [invoice, receipt] = await documentSizes(page);

    await choose(page, 'PNG');
    await expect(
      page.getByText('Each document becomes a file, all in a ZIP.'),
    ).toBeVisible();
    // Only PDFs can be combined
    await expect(
      page.getByRole('radio', { name: 'One PDF with everything' }),
    ).toHaveCount(0);
    const before: string = fileStamp();
    const pngs: DownloadedFile = await exportFile(page);
    const after: string = fileStamp();

    expectBatchName(pngs.name, 'zip', before, after);
    const pngZip: Map<string, Uint8Array> = readZip(pngs.data);
    expect([...pngZip.keys()]).toEqual(['1-invoice.png', '2-receipt.png']);
    expect(readImage(pngZip.get('1-invoice.png') ?? new Uint8Array())).toEqual({
      format: 'png',
      ...invoice,
    });
    expect(readImage(pngZip.get('2-receipt.png') ?? new Uint8Array())).toEqual({
      format: 'png',
      ...receipt,
    });

    await choose(page, 'JPG');
    const jpgs: DownloadedFile = await exportFile(page);

    expect(jpgs.name).toMatch(/^documents-\d{12}\.zip$/);
    const jpgZip: Map<string, Uint8Array> = readZip(jpgs.data);
    expect([...jpgZip.keys()]).toEqual(['1-invoice.jpg', '2-receipt.jpg']);
    expect(readImage(jpgZip.get('1-invoice.jpg') ?? new Uint8Array())).toEqual({
      format: 'jpeg',
      ...invoice,
    });
    expect(readImage(jpgZip.get('2-receipt.jpg') ?? new Uint8Array())).toEqual({
      format: 'jpeg',
      ...receipt,
    });
  });

  test('exports the adjustments of each document, including those applied to all', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg', 'receipt.jpg']);
    const [invoice, receipt] = await documentSizes(page);

    // Grayscale and strong sharpness (so noise reduction) applied to all; only the invoice rotated
    await page.getByTestId('step-2').click();
    await showDocument(page, 0);
    await choose(page, 'Grayscale');
    await choose(page, 'Strong');
    await page.getByRole('button', { name: 'Right', exact: true }).click();
    await page.getByTestId('apply-all').click();
    await expect(
      page.getByTestId('toast').filter({ hasText: 'adjustments' }),
    ).toHaveText('The adjustments were applied to all 2 documents.');
    await page.getByTestId('continue').click();
    await expect(page.getByTestId('step-3')).toHaveAttribute(
      'aria-current',
      'step',
    );

    // What the preview shows for each document, with its adjustments
    const shown: PreviewPixels[] = [];
    for (const index of [0, 1]) {
      await showDocument(page, index);
      shown.push(await settledPixels(page));
    }
    expect({ width: shown[0].width, height: shown[0].height }).toEqual({
      width: invoice.height,
      height: invoice.width,
    });
    expect({ width: shown[1].width, height: shown[1].height }).toEqual(receipt);

    await choose(page, 'PNG');
    const file: DownloadedFile = await exportFile(page);

    const zip: Map<string, Uint8Array> = readZip(file.data);
    expect([...zip.keys()]).toEqual(['1-invoice.png', '2-receipt.png']);
    const first: DecodedImage = await decodeImage(
      page,
      zip.get('1-invoice.png') ?? new Uint8Array(),
    );
    const second: DecodedImage = await decodeImage(
      page,
      zip.get('2-receipt.png') ?? new Uint8Array(),
    );
    // Each file is the very render of the preview: rotated or not, gray, sharpened and smoothed
    expect(first).toEqual({
      width: invoice.height,
      height: invoice.width,
      maxChannelSpread: 0,
      checksum: shown[0].checksum,
    });
    expect(second).toEqual({
      ...receipt,
      maxChannelSpread: 0,
      checksum: shown[1].checksum,
    });
  });

  test('names the files after the uploaded image, without its extension', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await page.goto('/');
    await uploadAs(page, 'invoice.jpg', 'Contract March.final.jpeg');
    await page.getByTestId('upload-continue').click();
    await expect(page.getByTestId('corner-editor')).toBeVisible();
    await clickContinue(page);
    await resultSize(page);
    await page.getByTestId('continue').click();

    const pdf: DownloadedFile = await exportFile(page);
    expect(pdf.name).toBe('Contract March.final.pdf');
    await expect(savedToast(page)).toHaveText(
      'File downloaded: Contract March.final.pdf',
    );

    await choose(page, 'JPG');
    const jpg: DownloadedFile = await exportFile(page);
    expect(jpg.name).toBe('Contract March.final.jpg');
    await expect(savedToast(page)).toHaveText(
      'File downloaded: Contract March.final.jpg',
    );
  });

  test('New scan goes back to an empty Upload step with the default options', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openExport(page, ['invoice.jpg', 'receipt.jpg']);
    // Options away from the defaults, which a new scan must not keep
    await choose(page, 'One PDF per document');
    await choosePage(page, 'letter');
    await setMargins(page, 5);
    await choose(page, 'PNG');
    await exportFile(page);
    await expect(savedToast(page)).toBeVisible();

    await page.getByRole('button', { name: 'New scan', exact: true }).click();

    await expect(page.getByTestId('step-0')).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(page.getByTestId('upload-files')).toBeVisible();
    await expect(
      page.getByText('Take photos or upload images of your documents'),
    ).toBeVisible();
    await expect(documentTiles(page)).toHaveCount(0);
    await expect(page.getByTestId('toast')).toHaveCount(0);
    for (const step of ['step-1', 'step-2', 'step-3']) {
      await expect(page.getByTestId(step)).toBeDisabled();
    }

    // A new scan starts from the default adjustments and export options
    await uploadImages(page, ['receipt.jpg', 'invoice.jpg']);
    await page.getByTestId('upload-continue').click();
    await clickContinue(page);
    await resultSize(page);
    await expect(
      page.getByRole('radio', { name: 'Color', exact: true }),
    ).toBeChecked();
    await page.getByTestId('continue').click();
    await expect(page.getByTestId('step-3')).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(
      page.getByRole('radio', { name: 'PDF', exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole('radio', { name: 'One PDF with everything', exact: true }),
    ).toBeChecked();
    await expect(page.getByLabel('PDF page')).toHaveValue('a4');
    await expect(page.getByTestId('margins')).toHaveValue('0');
    const file: DownloadedFile = await exportFile(page);
    expect(file.name).toMatch(/^documents-\d{12}\.pdf$/);
    const pdf: PdfInfo = await readPdf(file.data);
    expect(pdf.pageSizes).toHaveLength(2);
    for (const pageSize of pdf.pageSizes) expectPageSize(pageSize, A4);
  });
});
