import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { describe, expect, it, vi } from 'vitest';

import { detectCorners } from '@/lib/detect';
import type { SourceImage } from '@/lib/types';

import { type CropState, detectCrop } from './detectCrop';

vi.mock('@/lib/detect', (): Record<string, unknown> => ({
  detectCorners: vi.fn(),
}));

const CORNERS: Corners = {
  topLeft: { x: 10, y: 20 },
  topRight: { x: 300, y: 15 },
  bottomRight: { x: 310, y: 400 },
  bottomLeft: { x: 5, y: 410 },
};

function makeSource(): SourceImage {
  return {
    image: document.createElement('img'),
    url: 'blob:source',
    name: 'receipt',
    scannedDocument: { id: 'doc' } as unknown as ScannedDocument,
  };
}

describe('detectCrop', (): void => {
  it("detects the corners on the source's document and marks the crop valid", async (): Promise<void> => {
    vi.mocked(detectCorners).mockResolvedValue(CORNERS);
    const source: SourceImage = makeSource();

    const crop: CropState = await detectCrop(source);

    expect(crop).toEqual({
      corners: CORNERS,
      valid: true,
      detectorFailed: false,
    });
    expect(detectCorners).toHaveBeenCalledExactlyOnceWith(
      source.scannedDocument,
    );
  });

  it('returns a failed crop without corners and logs the error when the detector cannot load', async (): Promise<void> => {
    const error: Error = new Error('Failed to load opencv.js');
    vi.mocked(detectCorners).mockRejectedValue(error);
    const consoleError: ReturnType<typeof vi.spyOn> = vi
      .spyOn(console, 'error')
      .mockImplementation((): void => undefined);

    const crop: CropState = await detectCrop(makeSource());

    expect(crop).toEqual({
      corners: null,
      valid: false,
      detectorFailed: true,
    });
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(error);
  });
});
