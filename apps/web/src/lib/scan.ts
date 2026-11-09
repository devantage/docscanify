import type {
  ImageEnhancer,
  ImageFilter,
  ScannedDocumentAdapters,
} from '@devantage/docscanify';
import {
  createDefaultAdapters,
  OpenCvBlackAndWhiteFilter,
  OpenCvGrayscaleFilter,
  OpenCvNoiseReductionEnhancer,
  OpenCvRotationEnhancer,
  OpenCvSharpnessEnhancer,
  ScannedDocument,
} from '@devantage/docscanify';

import type { EnhanceOptions, Filter } from './types';

const scriptUrl: string = `${import.meta.env.BASE_URL}opencv.js`;

const adapters: ScannedDocumentAdapters = createDefaultAdapters({ scriptUrl });

/** No adjustments: the document only cropped, with its original colors. */
export const NO_ENHANCEMENTS: EnhanceOptions = {
  filter: 'none',
  turns: 0,
  sharpen: 'off',
  denoise: false,
};

/**
 * Creates the document from the bytes of an image. When no document is detected, it keeps the
 * whole original image.
 *
 * @param file Bytes of any image the browser can read.
 */
export async function createScannedDocument(
  file: Uint8Array,
  name: string,
): Promise<ScannedDocument> {
  return ScannedDocument.fromImage(file, adapters, {
    name,
    onNotDetected: 'original',
  });
}

/**
 * Builds the enhancers chosen in the Enhance step. They run after the crop and before the
 * filter, in this order: noise reduction, sharpness, rotation.
 *
 * @returns The active enhancers; empty when none is on.
 */
export function createEnhancers({
  denoise,
  sharpen,
  turns,
}: EnhanceOptions): ImageEnhancer[] {
  const enhancers: ImageEnhancer[] = [];
  if (denoise) enhancers.push(new OpenCvNoiseReductionEnhancer({ scriptUrl }));
  if (sharpen !== 'off') {
    enhancers.push(new OpenCvSharpnessEnhancer({ scriptUrl, level: sharpen }));
  }
  if (turns % 4 !== 0) {
    enhancers.push(
      new OpenCvRotationEnhancer({ scriptUrl, quarterTurns: turns }),
    );
  }
  return enhancers;
}

/**
 * Builds the color filter of a document.
 *
 * @returns The filter, or null to keep the original colors.
 */
export function createFilter(filter: Filter): ImageFilter | null {
  if (filter === 'bw') return new OpenCvBlackAndWhiteFilter({ scriptUrl });
  if (filter === 'grayscale') return new OpenCvGrayscaleFilter({ scriptUrl });
  return null;
}

/**
 * Applies the given adjustments to the document. The document snapshots its adjustments when a
 * render starts, so call this right before starting one.
 */
function applyOptions(
  scannedDocument: ScannedDocument,
  options: EnhanceOptions,
): void {
  scannedDocument.applyEnhancements(createEnhancers(options));
  scannedDocument.applyFilter(createFilter(options.filter));
}

/**
 * Renders the document with the given adjustments. Applying and rendering happen in the same
 * synchronous step, so a concurrent render with other adjustments cannot interfere.
 *
 * @param scannedDocument Document, with its crop corners already set.
 * @returns The rendered document, as PNG.
 */
export async function renderWith(
  scannedDocument: ScannedDocument,
  options: EnhanceOptions,
): Promise<Uint8Array> {
  applyOptions(scannedDocument, options);
  return scannedDocument.render();
}
