import type {
  Corner,
  Corners,
  DocumentScannerOptions,
} from '@devantage/docscanify';
import { z } from 'zod';

/** The arguments of the scan_document tool, validated. */
export interface ScanDocumentInput extends Omit<
  DocumentScannerOptions,
  'name'
> {
  imageBase64?: string;

  imageUrl?: string;

  imagePath?: string;

  fileName?: string;

  outputPath?: string;
}

/** The structured content of the scan_document tool. */
export interface ScanDocumentOutput {
  detected: boolean;

  corners: Corners | null;

  width: number;

  height: number;

  mimeType: string;

  fileName: string;

  savedTo?: string;

  /** PDF only. How the document was laid out on the page */
  pdf?: ScanPdfLayout;
}

/** A rectangle on the PDF page, in points, from the top left corner of the page. */
export interface ScanPdfArea {
  x: number;

  y: number;

  width: number;

  height: number;
}

/** How the document was laid out on the PDF page, as the tool returns it. */
export interface ScanPdfLayout {
  unit: 'pt';

  page: {
    width: number;

    height: number;

    orientation: 'portrait' | 'landscape';
  };

  image: ScanPdfArea;

  pixelsPerPoint: number;
}

const POINT_SCHEMA: z.ZodType<Corner> = z.object({
  x: z.number(),
  y: z.number(),
});

/** The arguments of the scan_document tool. */
export const SCAN_DOCUMENT_INPUT_SCHEMA: z.ZodType<ScanDocumentInput> =
  z.object({
    imageBase64: z
      .string()
      .optional()
      .describe(
        'The image file (JPG, PNG, WebP and other common formats) in base64, or as a data URL. Send exactly one of imageBase64, imageUrl or imagePath',
      ),
    imageUrl: z
      .string()
      .optional()
      .describe('An http or https URL the server downloads the image from'),
    imagePath: z
      .string()
      .optional()
      .describe(
        'Path of the image on the machine of the server. Only with the stdio transport',
      ),
    fileName: z
      .string()
      .optional()
      .describe(
        'Name of the output file. Default: the name of the image with the extension of the output format, or "scan"',
      ),
    outputFormat: z
      .enum(['pdf', 'image'])
      .optional()
      .describe(
        'pdf returns the scanned document inside a PDF page; image returns only the scanned image (JPEG, or PNG for the bw filter). Default: pdf',
      ),
    filter: z
      .enum(['none', 'grayscale', 'bw'])
      .optional()
      .describe(
        'none keeps the colors, grayscale removes them, bw is a black and white document mode (adaptive threshold). Default: none',
      ),
    noiseReduction: z
      .boolean()
      .optional()
      .describe(
        'Whether to smooth the noise of the document, preserving the edges of the text. Default: false',
      ),
    sharpness: z
      .enum(['off', 'soft', 'strong'])
      .optional()
      .describe('Sharpens the document. Default: off'),
    rotation: z
      .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
      .optional()
      .describe(
        'Rotates the scanned document clockwise, in degrees. Default: 0',
      ),
    pageSize: z
      .enum(['a4', 'letter', 'image'])
      .optional()
      .describe(
        'PDF only. a4, letter, or image (page sized to the image at 150 DPI). Default: a4',
      ),
    margin: z
      .number()
      .min(0)
      .optional()
      .describe('PDF only. Page margin in points (1/72 in). Default: 0'),
    maxDimension: z
      .number()
      .int()
      .min(500)
      .optional()
      .describe(
        'Downscales the image so its longest side is at most this size (px) before processing. Saves memory. Default: 3000',
      ),
    jpegQuality: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe(
        'Quality of the JPEG image. Not used by the bw filter, which is encoded as PNG. Default: 85',
      ),
    onNotDetected: z
      .enum(['error', 'original'])
      .optional()
      .describe(
        'What to do if no document is detected: error fails the call, original uses the whole image. Default: error',
      ),
    outputPath: z
      .string()
      .optional()
      .describe(
        'Also saves the result on the machine of the server: a file path, or a directory to save it in with fileName. Only with the stdio transport',
      ),
  });

const PDF_LAYOUT_SCHEMA: z.ZodType<ScanPdfLayout> = z.object({
  unit: z.literal('pt').describe('Unit of every measure: points, 1/72 in'),
  page: z
    .object({
      width: z.number(),
      height: z.number(),
      orientation: z.enum(['portrait', 'landscape']),
    })
    .describe(
      'The page, already turned to landscape when the document is wider than it is tall',
    ),
  image: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .describe(
      'Where the document was drawn, with x and y from the top left corner of the page',
    ),
  pixelsPerPoint: z
    .number()
    .describe(
      'Pixels of the document image per point: a point at px, py pixels of the image is at image.x + px / pixelsPerPoint, image.y + py / pixelsPerPoint on the page',
    ),
});

/** What the scan_document tool returns, besides the file. */
export const SCAN_DOCUMENT_OUTPUT_SCHEMA: z.ZodType<ScanDocumentOutput> =
  z.object({
    detected: z
      .boolean()
      .describe(
        'Whether a document was detected; when not, the whole image was used',
      ),
    corners: z
      .object({
        topLeft: POINT_SCHEMA,
        topRight: POINT_SCHEMA,
        bottomRight: POINT_SCHEMA,
        bottomLeft: POINT_SCHEMA,
      })
      .nullable()
      .describe(
        'The corners the document was cropped from, in pixels of the original image, or null if it was not cropped',
      ),
    width: z.number().describe('Width of the scanned document, in pixels'),
    height: z.number().describe('Height of the scanned document, in pixels'),
    mimeType: z.string().describe('MIME type of the output file'),
    fileName: z.string().describe('Name of the output file'),
    savedTo: z
      .string()
      .optional()
      .describe(
        'Absolute path the file was saved to, when outputPath was given',
      ),
    pdf: PDF_LAYOUT_SCHEMA.optional().describe(
      'PDF only. How the document was laid out on the page, to place fields such as signatures on it',
    ),
  });
