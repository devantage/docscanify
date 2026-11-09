import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  type Download,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';
import { unzipSync } from 'fflate';
import { PDFDocument, type PDFPage } from 'pdf-lib';

/** The photos in `src/test-support/e2e/fixtures`. */
export type Fixture = 'invoice.jpg' | 'receipt.jpg' | 'blank.png';

/** A point of an image, in its pixels. */
export interface Point {
  x: number;
  y: number;
}

/** The corners of a document, clockwise from the top left, in pixels of the photo. */
export type Quad = [Point, Point, Point, Point];

/** Where the sheet of each fixture photo really is (`blank.png` has no document). */
export const FIXTURE_CORNERS: Record<'invoice.jpg' | 'receipt.jpg', Quad> = {
  // 1600 × 1200 photo of a landscape-ish invoice on a wooden desk
  'invoice.jpg': [
    { x: 520, y: 150 },
    { x: 1150, y: 215 },
    { x: 1215, y: 1080 },
    { x: 405, y: 1030 },
  ],
  // 1400 × 1300 photo of a narrow receipt on a dark striped background
  'receipt.jpg': [
    { x: 430, y: 170 },
    { x: 980, y: 120 },
    { x: 1050, y: 1150 },
    { x: 360, y: 1180 },
  ],
};

export function fixturePath(name: Fixture): string {
  return path.join(import.meta.dirname, 'fixtures', name);
}

/** Opens the app and waits for the upload step. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('upload-files')).toBeVisible();
}

export function documentTiles(page: Page): Locator {
  return page.locator('[data-testid^="doc-"]');
}

/**
 * Uploads photos through the file picker, as a user does: with the "Upload images" button of the
 * empty upload step, or the upload button of the carousel once it has documents. Waits until
 * every photo is imported and its document detected.
 */
export async function uploadImages(
  page: Page,
  files: Fixture[],
): Promise<void> {
  const before: number = await documentTiles(page).count();
  const button: Locator = page
    .getByTestId('upload-files')
    .or(page.getByTestId('add-upload'))
    .first();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    button.click(),
  ]);
  await chooser.setFiles(files.map(fixturePath));
  await expect(documentTiles(page)).toHaveCount(before + files.length, {
    timeout: 60_000,
  });
  await expect(page.getByTestId('import-progress')).toBeHidden({
    timeout: 60_000,
  });
}

export async function clickContinue(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

/**
 * The corners shown by the crop editor, clockwise from the top left. The editor draws the image
 * in its own pixels, so these are in pixels of the photo.
 */
export async function editorCorners(page: Page): Promise<Quad> {
  await expect(page.getByTestId('corner-3')).toBeVisible();
  const points: Point[] = [];
  for (let i: number = 0; i < 4; i++) {
    const hit: Locator = page.locator(
      `[data-testid="corner-${String(i)}"] circle`,
    );
    const cx: string | null = await hit.first().getAttribute('cx');
    const cy: string | null = await hit.first().getAttribute('cy');
    points.push({ x: Number(cx), y: Number(cy) });
  }
  return points as Quad;
}

/** Largest distance, in pixels, between matching corners of two quadrilaterals. */
export function maxCornerError(a: Quad, b: Quad): number {
  return Math.max(
    ...a.map((point: Point, i: number) =>
      Math.hypot(point.x - b[i].x, point.y - b[i].y),
    ),
  );
}

export async function cornerOnScreen(
  page: Page,
  index: number,
): Promise<Point> {
  const box: { x: number; y: number; width: number; height: number } | null =
    await page
      .locator(`[data-testid="corner-${String(index)}"] circle`)
      .first()
      .boundingBox();
  if (!box) throw new Error(`Corner ${String(index)} is not on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export interface DownloadedFile {
  name: string;
  data: Buffer;
}

export async function downloadFrom(
  page: Page,
  action: () => Promise<void>,
): Promise<DownloadedFile> {
  const download: Download = (
    await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      action(),
    ])
  )[0];
  const file: string | null = await download.path();
  if (!file) throw new Error('The download failed');
  return { name: download.suggestedFilename(), data: await readFile(file) };
}

/** What a PDF has: its pages and their sizes, in points (1/72 inch). */
export interface PdfInfo {
  pageCount: number;
  pageSizes: { width: number; height: number }[];
}

export async function readPdf(data: Uint8Array): Promise<PdfInfo> {
  const pdf: PDFDocument = await PDFDocument.load(data);
  const pages: PDFPage[] = pdf.getPages();
  return {
    pageCount: pages.length,
    pageSizes: pages.map((page: PDFPage) => page.getSize()),
  };
}

/** The files of a ZIP, by name, in the order they are stored. */
export function readZip(data: Uint8Array): Map<string, Uint8Array> {
  return new Map(Object.entries(unzipSync(data)));
}

export interface ImageInfo {
  format: 'png' | 'jpeg';
  width: number;
  height: number;
}

/** Reads the format and dimensions of a PNG or JPEG from its header. */
export function readImage(data: Uint8Array): ImageInfo {
  const bytes: Buffer = Buffer.from(data);
  if (bytes.readUInt32BE(0) === 0x89504e47) {
    return {
      format: 'png',
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // Walks the JPEG segments until a start-of-frame one, which holds the dimensions
    let offset: number = 2;
    while (offset < bytes.length) {
      const marker: number = bytes[offset + 1];
      const length: number = bytes.readUInt16BE(offset + 2);
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      ) {
        return {
          format: 'jpeg',
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  throw new Error('Not a PNG or JPEG file');
}
