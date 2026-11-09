import { readFile } from 'node:fs/promises';

import {
  expect,
  type JSHandle,
  type Locator,
  type Page,
} from '@playwright/test';

import { documentTiles, type Fixture, fixturePath } from './app';

/** The fixture photos by their size in pixels, to tell which photo a carousel tile shows. */
const PHOTO_BY_SIZE: Record<string, string> = {
  '1600x1200': 'invoice',
  '1400x1300': 'receipt',
  '800x600': 'blank',
};

/** A file to drop on the page, built inside the page from its bytes. */
export interface DroppedFile {
  name: string;
  type: string;
  base64: string;
}

/** Reads a fixture photo from disk as a file to drop, with the MIME type of its extension. */
export async function fixtureFile(name: Fixture): Promise<DroppedFile> {
  const bytes: Buffer = await readFile(fixturePath(name));
  return {
    name,
    type: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
    base64: bytes.toString('base64'),
  };
}

/** A small file that is not an image, to drop together with the photos. */
export function textFile(name: string): DroppedFile {
  return {
    name,
    type: 'text/plain',
    base64: Buffer.from('Not an image, just some notes.').toString('base64'),
  };
}

/** A DataTransfer, inside the page, that holds the given files. */
export async function dataTransferWith(
  page: Page,
  files: DroppedFile[],
): Promise<JSHandle<DataTransfer>> {
  return page.evaluateHandle((list: DroppedFile[]): DataTransfer => {
    const transfer: DataTransfer = new DataTransfer();
    for (const file of list) {
      const bytes: Uint8Array<ArrayBuffer> = Uint8Array.from(
        atob(file.base64),
        (char: string): number => char.charCodeAt(0),
      );
      transfer.items.add(new File([bytes], file.name, { type: file.type }));
    }
    return transfer;
  }, files);
}

/** Drags the files over an element and drops them there, as the browser does with a real drop. */
export async function dropFiles(
  page: Page,
  target: Locator,
  files: DroppedFile[],
): Promise<void> {
  const dataTransfer: JSHandle<DataTransfer> = await dataTransferWith(
    page,
    files,
  );
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
}

/** The size of the image of each tile, in carousel order, or null while one is still loading. */
async function tileImageSizes(page: Page): Promise<string[] | null> {
  return documentTiles(page).evaluateAll(
    (tiles: Element[]): string[] | null => {
      const sizes: string[] = [];
      for (const tile of tiles) {
        const img: HTMLImageElement | null = tile.querySelector('img');
        if (!img?.complete || !img.naturalWidth) return null;
        sizes.push(`${String(img.naturalWidth)}x${String(img.naturalHeight)}`);
      }
      return sizes;
    },
  );
}

/**
 * Which photo each tile of the Upload step shows, in carousel order. The Upload step shows the
 * original photos, so their sizes tell them apart. All the tiles are read at once, so the list
 * is never a mix of two orders; wrap it in `expect.poll` to wait for a change of order.
 */
export async function uploadedPhotos(page: Page): Promise<string[]> {
  const loaded: { sizes: string[] } = { sizes: [] };
  await expect
    .poll(
      async (): Promise<boolean> => {
        const sizes: string[] | null = await tileImageSizes(page);
        if (sizes) loaded.sizes = sizes;
        return sizes !== null;
      },
      { message: 'every tile image is loaded' },
    )
    .toBe(true);
  return loaded.sizes.map(
    (size: string): string => PHOTO_BY_SIZE[size] ?? size,
  );
}

/** Which photo the crop editor shows, from the size of the image it draws. */
export async function photoInEditor(page: Page): Promise<string> {
  const viewBox: string | null = await page
    .getByTestId('corner-editor')
    .getAttribute('viewBox');
  const [, , width, height] = (viewBox ?? '').split(' ');
  const size: string = `${width}x${height}`;
  return PHOTO_BY_SIZE[size] ?? size;
}

/**
 * Which photo each tile of the compact carousel holds, in order, found in the Crop step by
 * opening each document in the editor. Leaves the last document selected.
 */
export async function photosInCrop(page: Page): Promise<string[]> {
  const count: number = await documentTiles(page).count();
  const photos: string[] = [];
  for (let i: number = 0; i < count; i++) {
    const tile: Locator = page.getByTestId(`doc-${String(i)}`);
    await tile.click();
    await expect(tile).toHaveAttribute('aria-current', 'true');
    photos.push(await photoInEditor(page));
  }
  return photos;
}

/** Drags a tile with the mouse and drops it over the center of another one, shifted by `dx`. */
export async function dragTile(
  page: Page,
  from: number,
  to: number,
  dx: number,
): Promise<void> {
  const source: Locator = page.getByTestId(`doc-${String(from)}`);
  const target: Locator = page.getByTestId(`doc-${String(to)}`);
  const start: { x: number; y: number; width: number; height: number } | null =
    await source.boundingBox();
  const end: { x: number; y: number; width: number; height: number } | null =
    await target.boundingBox();
  if (!start || !end) throw new Error('The tiles are not on screen');
  const y: number = start.y + start.height * 0.6;
  await page.mouse.move(start.x + start.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2 + dx, y, { steps: 12 });
  await page.mouse.up();
}
