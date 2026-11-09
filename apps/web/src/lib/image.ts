import type { ScannedDocument } from '@devantage/docscanify';

import { createScannedDocument } from './scan';
import type { SourceImage } from './types';

/** Maximum thumbnail size, in px: twice its on-screen size, for high-density displays. */
const THUMBNAIL_WIDTH: number = 112;
const THUMBNAIL_HEIGHT: number = 144;

/** Wraps PNG bytes in a Blob, the input `createImageBitmap` takes. */
const pngBlob = (png: Uint8Array): Blob =>
  new Blob([png as Uint8Array<ArrayBuffer>], { type: 'image/png' });

/**
 * Current date and time, in UTC, for file names.
 *
 * @returns The date as `YYYYMMDDhhmm`.
 */
export function fileStamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
}

/**
 * Decodes a PNG into a canvas, to show the result on screen.
 *
 * @throws When the browser cannot decode the PNG or give a 2D canvas context.
 */
export async function canvasFromPng(
  png: Uint8Array,
): Promise<HTMLCanvasElement> {
  const bitmap: ImageBitmap = await createImageBitmap(pngBlob(png));
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
  if (!context) throw new Error('Could not get a 2D canvas context');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

/**
 * Scales an image down to thumbnail size, keeping its aspect ratio. A smaller image is never
 * scaled up, and neither side goes below 1 px. The given image is not closed.
 *
 * @returns The thumbnail as a JPEG data URL.
 * @throws When the browser cannot give a 2D canvas context.
 */
export async function thumbnailFrom(
  image: HTMLCanvasElement | ImageBitmap,
): Promise<string> {
  const scale: number = Math.min(
    THUMBNAIL_WIDTH / image.width,
    THUMBNAIL_HEIGHT / image.height,
    1,
  );
  const width: number = Math.max(1, Math.round(image.width * scale));
  const height: number = Math.max(1, Math.round(image.height * scale));
  // A single drawImage downscale aliases thin lines; the bitmap resize has better quality
  const bitmap: ImageBitmap = await createImageBitmap(image, {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: 'high',
  });
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
  if (!context) throw new Error('Could not get a 2D canvas context');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Decodes a PNG and scales it down to thumbnail size, as {@link thumbnailFrom} does.
 *
 * @returns The thumbnail as a JPEG data URL.
 */
export async function thumbnailFromPng(png: Uint8Array): Promise<string> {
  const bitmap: ImageBitmap = await createImageBitmap(pngBlob(png));
  try {
    return await thumbnailFrom(bitmap);
  } finally {
    bitmap.close();
  }
}

/**
 * Creates the input image from a file, without changing it, and the document from it. On failure,
 * the object URL is revoked and the original error is kept as the `cause` of the one thrown.
 *
 * @param fallbackName Base name used when the file has none.
 * @returns The image, shown in the editor, and the document, which does all the processing.
 * @throws `Could not open <file name>` when the file cannot be read or decoded, or the document
 * cannot be created from it.
 */
export async function sourceFromFile(
  file: File,
  fallbackName: string,
): Promise<SourceImage> {
  const name: string = file.name.replace(/\.[^.]+$/, '') || fallbackName;
  let url: string | null = null;
  try {
    const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(
      await file.arrayBuffer(),
    );
    const scannedDocument: ScannedDocument = await createScannedDocument(
      bytes,
      file.name,
    );
    url = URL.createObjectURL(file);
    const image: HTMLImageElement = new Image();
    image.src = url;
    await image.decode();
    return { image, url, name, scannedDocument };
  } catch (e) {
    if (url) URL.revokeObjectURL(url);
    throw new Error(`Could not open ${file.name}`, { cause: e });
  }
}

/**
 * Reads the current camera video frame as a PNG file at the camera resolution. It is fast: the
 * document is only created later, together with the uploaded files.
 *
 * @param video Camera video, already playing.
 * @param name File name, without extension.
 * @throws When the browser cannot give a 2D canvas context or encode the frame.
 */
export async function frameFromVideo(
  video: HTMLVideoElement,
  name: string,
): Promise<File> {
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
  if (!context) throw new Error('Could not get a 2D canvas context');
  context.drawImage(video, 0, 0);
  const blob: Blob = await new Promise<Blob>(
    (
      resolve: (value: Blob | PromiseLike<Blob>) => void,
      reject: (reason?: unknown) => void,
    ) => {
      canvas.toBlob((b: Blob | null) => {
        b ? resolve(b) : reject(new Error('Could not encode the camera frame'));
      }, 'image/png');
    },
  );
  return new File([blob], `${name}.png`, { type: 'image/png' });
}
