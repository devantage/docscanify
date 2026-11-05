import type { Corners } from '@devantage/docscanify';

import { detectCorners } from '@/lib/detect';
import type { DocumentItem, SourceImage } from '@/lib/types';

/** The crop fields of a document. */
export type CropState = Pick<
  DocumentItem,
  'corners' | 'valid' | 'detectorFailed'
>;

/**
 * Detects the corners of an image and returns the crop state of its document.
 *
 * @param source Input image and its document.
 * @returns The detected corners, or a failed state when OpenCV could not be loaded.
 */
export async function detectCrop(source: SourceImage): Promise<CropState> {
  try {
    const corners: Corners = await detectCorners(source.scannedDocument);
    return { corners, valid: true, detectorFailed: false };
  } catch (e) {
    console.error(e);
    return { corners: null, valid: false, detectorFailed: true };
  }
}
