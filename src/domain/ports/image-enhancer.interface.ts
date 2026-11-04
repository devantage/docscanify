/** Improves the cropped document, before the filter. */
export interface ImageEnhancer {
  /**
   * Improves the document.
   *
   * @param buffer a copy of the document, always a PNG
   * @returns the enhanced document, as a PNG
   */
  enhance(buffer: Uint8Array): Promise<Uint8Array>;
}
