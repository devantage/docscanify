import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { describe, expect, it, vi } from 'vitest';

import { detectCorners } from './detect';

const DETECTED: Corners = {
  topLeft: { x: 12, y: 8 },
  topRight: { x: 590, y: 20 },
  bottomRight: { x: 600, y: 790 },
  bottomLeft: { x: 5, y: 780 },
};

/**
 * A document that finds `found` when detecting. Like the real one, `corners` is only set by
 * `detectCorners`.
 */
function fakeDocument(
  found: Corners | null,
  size: { width: number; height: number } = { width: 640, height: 800 },
): ScannedDocument & { detectCorners(): Promise<void> } {
  const doc: { corners: Corners | null } & Record<string, unknown> = {
    corners: null,
    originalFile: { getDimensions: (): typeof size => size },
  };
  doc.detectCorners = vi.fn(async (): Promise<void> => {
    await Promise.resolve();
    doc.corners = found;
  });
  return doc as unknown as ScannedDocument & {
    detectCorners(): Promise<void>;
  };
}

describe('detectCorners', (): void => {
  it('returns the corners the document detected', async (): Promise<void> => {
    const doc: ScannedDocument = fakeDocument(DETECTED);

    expect(await detectCorners(doc)).toEqual(DETECTED);
    expect(doc.detectCorners).toHaveBeenCalledOnce();
  });

  it('returns the corners of the whole image when no document is found', async (): Promise<void> => {
    const doc: ScannedDocument = fakeDocument(null, {
      width: 1024,
      height: 768,
    });

    expect(await detectCorners(doc)).toEqual({
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1024, y: 0 },
      bottomRight: { x: 1024, y: 768 },
      bottomLeft: { x: 0, y: 768 },
    });
  });

  it('propagates the error when OpenCV cannot be loaded', async (): Promise<void> => {
    const doc: ScannedDocument & { detectCorners(): Promise<void> } =
      fakeDocument(DETECTED);
    const error: Error = new Error('Failed to load opencv.js');
    vi.mocked(doc.detectCorners).mockRejectedValueOnce(error);

    await expect(detectCorners(doc)).rejects.toBe(error);
  });
});
