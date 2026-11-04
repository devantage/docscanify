import type { ExportedFile } from './exported-file.interface';
import type { ScanReport } from './scan-report.interface';

/** What exporting a document returns. */
export interface DocumentOutput {
  /** The exported file */
  file: ExportedFile;

  /** What was done to get to the exported file */
  report: ScanReport;
}
