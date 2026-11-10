import type {
  Corners,
  PageFormat,
  ScannedDocument,
  SharpnessLevel,
} from '@devantage/docscanify';

/** Color filter applied to a document: original colors, grayscale, or black and white. */
export type Filter = 'none' | 'grayscale' | 'bw';

/** Sharpness level: no adjustment or one of the docscanify levels. */
export type Sharpen = 'off' | SharpnessLevel;

export type ExportFormat = 'pdf' | 'png' | 'jpg';

/** Adjustments of a single document, chosen in the Enhance step. */
export interface EnhanceOptions {
  filter: Filter;
  /** Clockwise quarter turns; negative values rotate counterclockwise. */
  turns: number;
  /** Any level other than `"off"` also reduces the noise before sharpening. */
  sharpen: Sharpen;
}

/** Export options, chosen in the Export step. They apply to every document. */
export interface ExportSettings {
  format: ExportFormat;
  /** PDF page size. Only used when `format` is `"pdf"`. */
  pageFormat: PageFormat;
  /** PDF page margins, in centimeters with up to 2 decimal places, the same on every side. */
  margins: number;
  /**
   * With more than one document as PDF: `true` makes a single PDF with one page per document;
   * `false` makes one PDF per document, inside a ZIP. PNG and JPG are always one file per document.
   */
  combine: boolean;
}

/** Input image (uploaded file or camera photo) and the document created from it. */
export interface SourceImage {
  /** The image as received, shown in the corner editor. Corners are in its coordinates. */
  image: HTMLImageElement;
  /** Object URL of the received image. Must be revoked when the document is discarded. */
  url: string;
  /** Base file name, without extension. Used to name the exported file. */
  name: string;
  /** Document created from the received image: it detects, crops, and enhances. */
  scannedDocument: ScannedDocument;
}

/** A document in the list, with its crop and adjustments. */
export interface DocumentItem {
  /** Unique id within the list. */
  id: string;
  source: SourceImage;
  /** Crop corners; null when the edge detector could not be loaded. */
  corners: Corners | null;
  /** Whether the document accepted the current corners; crossed corners are rejected. */
  valid: boolean;
  /** Whether the edge detector could not be loaded for this document. */
  detectorFailed: boolean;
  options: EnhanceOptions;
}
