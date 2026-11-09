import type { Corners, ScannedDocument } from '@devantage/docscanify';

/**
 * Detects the document corners in the image. The document starts cropping by them.
 *
 * @returns The detected corners or, when no document is found, the corners of the whole image.
 * @throws When OpenCV cannot be loaded.
 */
export async function detectCorners(
  scannedDocument: ScannedDocument,
): Promise<Corners> {
  await scannedDocument.detectCorners();

  const { width, height } = scannedDocument.originalFile.getDimensions();

  return (
    scannedDocument.corners ?? {
      topLeft: { x: 0, y: 0 },
      topRight: { x: width, y: 0 },
      bottomRight: { x: width, y: height },
      bottomLeft: { x: 0, y: height },
    }
  );
}
