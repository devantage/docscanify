/** The environment the package is running on. */
export class Runtime {
  /**
   * Checks if the package is running on Node.js.
   *
   * @returns `true` wherever there is no DOM, which includes Web Workers
   */
  public static isNode(): boolean {
    return typeof document === 'undefined';
  }
}
