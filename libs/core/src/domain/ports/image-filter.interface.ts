/** Changes the look of the document, after the enhancers. */
export interface ImageFilter {
  /**
   * Applies the filter to the document.
   *
   * @param buffer a copy of the enhanced document, always a PNG
   * @returns the filtered document, as a PNG
   */
  filter(buffer: Uint8Array): Promise<Uint8Array>;
}
