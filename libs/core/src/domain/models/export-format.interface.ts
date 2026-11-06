/** The format of an exported file. */
export interface ExportFormat {
  /** For example, `image/png` */
  readonly mimeType: string;

  /** Without the dot, for example, `png` */
  readonly fileExtension: string;
}
