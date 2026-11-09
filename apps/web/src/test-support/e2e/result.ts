import { readFile } from 'node:fs/promises';

import { expect, type Locator, type Page } from '@playwright/test';
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  type PDFObject,
  type PDFPage,
  PDFRawStream,
  PDFRef,
} from 'pdf-lib';

import {
  clickContinue,
  documentTiles,
  type DownloadedFile,
  downloadFrom,
  type Fixture,
  fixturePath,
  openApp,
  uploadImages,
} from './app';

/** The size of a rendered document, in pixels. */
export interface Size {
  width: number;
  height: number;
}

/** Matches the size at the end of the status of the Adjust and Export panels. */
const SIZE_PATTERN: RegExp = /(\d+) × (\d+) px$/;

/** Points per millimeter, the unit of the margin field. */
export const POINTS_PER_MM: number = 72 / 25.4;

/** A4 and Letter pages in points, portrait. */
export const A4: Size = { width: 595.28, height: 841.89 };
export const LETTER: Size = { width: 612, height: 792 };

/** "Document size" PDF pages are sized at this resolution. */
export const PDF_IMAGE_DPI: number = 150;

/** The status under the title of the Adjust and Export panels: position and result size. */
export function resultStatus(page: Page): Locator {
  return page.getByTestId('result-size');
}

/** The text of the status once the render of the current options is shown. */
export function sizeText(size: Size): string {
  return `${String(size.width)} × ${String(size.height)} px`;
}

/** Waits for the preview of the current options and returns its size, from the status. */
export async function resultSize(page: Page): Promise<Size> {
  await expect(resultStatus(page)).toHaveText(SIZE_PATTERN, {
    timeout: 60_000,
  });
  await expect(page.getByTestId('loading')).toBeHidden({ timeout: 60_000 });
  const text: string = await resultStatus(page).innerText();
  const match: RegExpExecArray | null = SIZE_PATTERN.exec(text);
  if (!match) throw new Error(`No size in "${text}"`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

/** Opens the app, uploads the photos and goes to the Crop step. */
export async function openCrop(page: Page, files: Fixture[]): Promise<void> {
  await openApp(page);
  await uploadImages(page, files);
  await page.getByTestId('upload-continue').click();
  await expect(page.getByTestId('corner-editor')).toBeVisible();
}

/** Opens the app, uploads the photos and goes to the Adjust step, with the first preview ready. */
export async function openAdjust(page: Page, files: Fixture[]): Promise<void> {
  await openCrop(page, files);
  await clickContinue(page);
  await expect(page.getByTestId('step-2')).toHaveAttribute(
    'aria-current',
    'step',
  );
  await resultSize(page);
}

/** Opens the app, uploads the photos and goes to the Export step, with the preview ready. */
export async function openExport(page: Page, files: Fixture[]): Promise<void> {
  await openAdjust(page, files);
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('step-3')).toHaveAttribute(
    'aria-current',
    'step',
  );
  await expect(page.getByTestId('download')).toBeEnabled();
}

/**
 * Uploads a fixture photo under another file name, through the file picker of the empty Upload
 * step, and waits until it is imported.
 */
export async function uploadAs(
  page: Page,
  fixture: Fixture,
  name: string,
): Promise<void> {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('upload-files').click(),
  ]);
  await chooser.setFiles({
    name,
    mimeType: fixture.endsWith('.png') ? 'image/png' : 'image/jpeg',
    buffer: await readFile(fixturePath(fixture)),
  });
  await expect(documentTiles(page)).toHaveCount(1, { timeout: 60_000 });
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 60_000,
  });
}

/** What `watchTransients` saw in the page. */
export interface Transients {
  /** The selectors that matched an element, even for a moment, in the order they first did. */
  selectors: string[];
  /** Every text the status of the Adjust and Export panels showed, in order. */
  statuses: string[];
}

/** The page global where `watchTransients` keeps what it sees. */
interface TransientsWatch {
  transients?: Transients;
}

/**
 * Starts noting states of the page that may last too short to assert on, such as a loading state
 * while OpenCV blocks the page: which selectors match and which texts the status shows, after
 * every change of the page. Read them with `seenTransients`.
 */
export async function watchTransients(
  page: Page,
  selectors: string[],
): Promise<void> {
  await page.evaluate((watched: string[]): void => {
    const seen: Transients = { selectors: [], statuses: [] };
    (globalThis as TransientsWatch).transients = seen;
    const note = (): void => {
      for (const selector of watched) {
        if (
          !seen.selectors.includes(selector) &&
          document.querySelector(selector)
        )
          seen.selectors.push(selector);
      }
      const status: string | undefined = document
        .querySelector('[data-testid="result-size"]')
        ?.textContent.trim();
      if (status !== undefined && seen.statuses.at(-1) !== status)
        seen.statuses.push(status);
    };
    note();
    new MutationObserver(note).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }, selectors);
}

/** What the page went through since `watchTransients`. */
export async function seenTransients(page: Page): Promise<Transients> {
  return page.evaluate((): Transients => {
    const seen: Transients | undefined = (globalThis as TransientsWatch)
      .transients;
    if (!seen) throw new Error('watchTransients was not called');
    return seen;
  });
}

/** Picks an option of a segmented field (color, sharpness, format, file) by its label. */
export async function choose(page: Page, label: string): Promise<void> {
  const radio: Locator = page.getByRole('radio', { name: label, exact: true });
  // The radio is hidden behind its label, which takes the clicks
  await page.locator('label').filter({ has: radio }).click();
  await expect(radio).toBeChecked();
}

/** Shows a document of the carousel under the preview, by its position from 0. */
export async function showDocument(page: Page, index: number): Promise<void> {
  await page.getByTestId(`doc-${String(index)}`).click();
  await expect(page.getByTestId(`doc-${String(index)}`)).toHaveAttribute(
    'aria-current',
    'true',
  );
}

export async function exportFile(page: Page): Promise<DownloadedFile> {
  return downloadFrom(page, async (): Promise<void> => {
    await page.getByTestId('download').click();
  });
}

/** What the pixels of the preview canvas look like. */
export interface PreviewPixels {
  width: number;
  height: number;
  /** Largest difference between two channels of any pixel. */
  maxChannelSpread: number;
  /** Share of pixels whose channels differ by more than 24, so clearly colored. */
  colorfulShare: number;
  /** Share of channel values that are neither near black (≤ 8) nor near white (≥ 247). */
  midtoneShare: number;
  /** Mean difference of luminance between horizontal neighbors: grows with sharpness. */
  edgeEnergy: number;
  /** A hash of every pixel, to tell two renders apart or find them equal. */
  checksum: number;
}

/** Reads the pixels of the preview canvas of the Adjust and Export steps. */
export async function previewPixels(page: Page): Promise<PreviewPixels> {
  return page
    .getByTestId('result')
    .evaluate((canvas: HTMLElement): PreviewPixels => {
      if (!(canvas instanceof HTMLCanvasElement))
        throw new Error('The preview is not a canvas');
      const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
      if (!context) throw new Error('No 2D context');
      const { width, height } = canvas;
      const data: Uint8ClampedArray = context.getImageData(
        0,
        0,
        width,
        height,
      ).data;
      let maxChannelSpread: number = 0;
      let colorful: number = 0;
      let midtones: number = 0;
      let edges: number = 0;
      let checksum: number = 0;
      for (let y: number = 0; y < height; y++) {
        let previous: number = -1;
        for (let x: number = 0; x < width; x++) {
          const i: number = (y * width + x) * 4;
          const r: number = data[i];
          const g: number = data[i + 1];
          const b: number = data[i + 2];
          const spread: number = Math.max(r, g, b) - Math.min(r, g, b);
          if (spread > maxChannelSpread) maxChannelSpread = spread;
          if (spread > 24) colorful++;
          for (const value of [r, g, b]) {
            if (value > 8 && value < 247) midtones++;
          }
          const luminance: number = 0.299 * r + 0.587 * g + 0.114 * b;
          if (previous >= 0) edges += Math.abs(luminance - previous);
          previous = luminance;
          checksum = (Math.imul(checksum, 31) + r * 65536 + g * 256 + b) | 0;
        }
      }
      const pixels: number = width * height;
      return {
        width,
        height,
        maxChannelSpread,
        colorfulShare: colorful / pixels,
        midtoneShare: midtones / (pixels * 3),
        edgeEnergy: edges / (height * (width - 1)),
        checksum,
      };
    });
}

/** Waits for the preview to show the render of the current options and reads its pixels. */
export async function settledPixels(page: Page): Promise<PreviewPixels> {
  await resultSize(page);
  return previewPixels(page);
}

/** Where an image is drawn on a PDF page, in points from the bottom left corner. */
export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Matrix = [number, number, number, number, number, number];

/** `a` then `b`, as PDF matrices compose with `cm`. */
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

/** The decoded content streams of a page, joined. */
function pageContent(page: PDFPage): string {
  const contents: PDFObject | undefined = page.node.Contents();
  const refs: PDFObject[] =
    contents instanceof PDFArray
      ? contents.asArray()
      : contents
        ? [contents]
        : [];
  return refs
    .map((ref: PDFObject): string => {
      const stream: PDFObject | undefined =
        ref instanceof PDFRef ? page.node.context.lookup(ref) : ref;
      if (!(stream instanceof PDFRawStream))
        throw new Error('Unexpected PDF content stream');
      return Buffer.from(decodePDFRawStream(stream).decode()).toString(
        'latin1',
      );
    })
    .join('\n');
}

/** Where each page draws its image (the `Do` operator), following the `cm` and `q`/`Q` operators. */
function placementsOf(content: string): Placement[] {
  const placements: Placement[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  let operands: number[] = [];
  for (const token of content.split(/\s+/)) {
    if (token === '') continue;
    const value: number = Number(token);
    if (!Number.isNaN(value)) {
      operands.push(value);
      continue;
    }
    if (token === 'q') stack.push(ctm);
    else if (token === 'Q') ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (token === 'cm' && operands.length >= 6)
      ctm = multiply(operands.slice(-6) as Matrix, ctm);
    else if (token === 'Do') {
      const xs: number[] = [ctm[4], ctm[4] + ctm[0], ctm[4] + ctm[2]];
      const ys: number[] = [ctm[5], ctm[5] + ctm[1], ctm[5] + ctm[3]];
      const x: number = Math.min(...xs, ctm[4] + ctm[0] + ctm[2]);
      const y: number = Math.min(...ys, ctm[5] + ctm[1] + ctm[3]);
      placements.push({
        x,
        y,
        width: Math.max(...xs, ctm[4] + ctm[0] + ctm[2]) - x,
        height: Math.max(...ys, ctm[5] + ctm[1] + ctm[3]) - y,
      });
    }
    if (!token.startsWith('/')) operands = [];
  }
  return placements;
}

/** Where the image of each page of a PDF is drawn, one entry per page. */
export async function pdfImagePlacements(
  data: Uint8Array,
): Promise<Placement[]> {
  const pdf: PDFDocument = await PDFDocument.load(data);
  return pdf.getPages().map((page: PDFPage): Placement => {
    const placements: Placement[] = placementsOf(pageContent(page));
    if (placements.length !== 1)
      throw new Error(
        `Expected one image per page, found ${String(placements.length)}`,
      );
    return placements[0];
  });
}

/** The size, in pixels, of the image embedded in each page of a PDF, one entry per page. */
export async function pdfImageSizes(data: Uint8Array): Promise<Size[]> {
  const pdf: PDFDocument = await PDFDocument.load(data);
  return pdf.getPages().map((page: PDFPage): Size => {
    const xObjects: PDFDict | undefined = page.node
      .Resources()
      ?.lookupMaybe(PDFName.of('XObject'), PDFDict);
    const images: Size[] = (xObjects?.values() ?? [])
      .map((ref: PDFObject): PDFObject | undefined =>
        ref instanceof PDFRef ? page.node.context.lookup(ref) : ref,
      )
      .filter(
        (object: PDFObject | undefined): object is PDFRawStream =>
          object instanceof PDFRawStream &&
          object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'),
      )
      .map((stream: PDFRawStream): Size => ({
        width: stream.dict.lookup(PDFName.of('Width'), PDFNumber).asNumber(),
        height: stream.dict.lookup(PDFName.of('Height'), PDFNumber).asNumber(),
      }));
    if (images.length !== 1)
      throw new Error(
        `Expected one image per page, found ${String(images.length)}`,
      );
    return images[0];
  });
}

/** Where the PDF encoder draws an image of this size: centered, as large as the margins allow. */
export function expectedPlacement(
  image: Size,
  pageSize: Size,
  margin: number,
): Placement {
  const scale: number = Math.min(
    (pageSize.width - margin * 2) / image.width,
    (pageSize.height - margin * 2) / image.height,
  );
  const width: number = image.width * scale;
  const height: number = image.height * scale;
  return {
    x: (pageSize.width - width) / 2,
    y: (pageSize.height - height) / 2,
    width,
    height,
  };
}

/** Checks two placements are the same, to a hundredth of a point. */
export function expectPlacement(actual: Placement, expected: Placement): void {
  expect(actual.x).toBeCloseTo(expected.x, 1);
  expect(actual.y).toBeCloseTo(expected.y, 1);
  expect(actual.width).toBeCloseTo(expected.width, 1);
  expect(actual.height).toBeCloseTo(expected.height, 1);
}

/** The current date as the app stamps batch files: `YYYYMMDDhhmm`, in UTC. */
export function fileStamp(date: Date = new Date()): string {
  return date.toISOString().slice(0, 16).replace(/[-:T]/g, '');
}

/** The size and colors of an exported image, decoded by the browser. */
export interface DecodedImage {
  width: number;
  height: number;
  /** Largest difference between two channels of any pixel: 0 for a gray image. */
  maxChannelSpread: number;
  /** A hash of every pixel, computed as `PreviewPixels.checksum`, to compare with the preview. */
  checksum: number;
}

/** Decodes an exported PNG or JPEG in the page, to check its pixels. */
export async function decodeImage(
  page: Page,
  data: Uint8Array,
): Promise<DecodedImage> {
  return page.evaluate(async (base64: string): Promise<DecodedImage> => {
    const bytes: Uint8Array<ArrayBuffer> = Uint8Array.from(
      atob(base64),
      (char: string): number => char.charCodeAt(0),
    );
    const bitmap: ImageBitmap = await createImageBitmap(new Blob([bytes]));
    const canvas: OffscreenCanvas = new OffscreenCanvas(
      bitmap.width,
      bitmap.height,
    );
    const context: OffscreenCanvasRenderingContext2D | null =
      canvas.getContext('2d');
    if (!context) throw new Error('No 2D context');
    context.drawImage(bitmap, 0, 0);
    const pixels: Uint8ClampedArray = context.getImageData(
      0,
      0,
      bitmap.width,
      bitmap.height,
    ).data;
    let maxChannelSpread: number = 0;
    let checksum: number = 0;
    for (let i: number = 0; i < pixels.length; i += 4) {
      const r: number = pixels[i];
      const g: number = pixels[i + 1];
      const b: number = pixels[i + 2];
      const spread: number = Math.max(r, g, b) - Math.min(r, g, b);
      if (spread > maxChannelSpread) maxChannelSpread = spread;
      checksum = (Math.imul(checksum, 31) + r * 65536 + g * 256 + b) | 0;
    }
    return {
      width: bitmap.width,
      height: bitmap.height,
      maxChannelSpread,
      checksum,
    };
  }, Buffer.from(data).toString('base64'));
}
