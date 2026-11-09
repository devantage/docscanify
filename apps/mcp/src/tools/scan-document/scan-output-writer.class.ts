import type { Stats } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

/** Saves scanned documents on the machine of the server. */
export class ScanOutputWriter {
  /**
   * @param outputPath a file, or a directory (an existing one, or a path
   * ending with a separator) to save the file in with `fileName`. Missing
   * parent directories are created
   * @param fileName name of the file when `outputPath` is a directory
   * @param buffer the scanned document
   * @returns the absolute path of the saved file
   */
  public async write(
    outputPath: string,
    fileName: string,
    buffer: Uint8Array,
  ): Promise<string> {
    const target: string = (await this.isDirectory(outputPath))
      ? join(resolve(outputPath), fileName)
      : resolve(outputPath);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer);

    return target;
  }

  private async isDirectory(outputPath: string): Promise<boolean> {
    if (outputPath.endsWith(sep) || outputPath.endsWith('/')) {
      return true;
    }

    const stats: Stats | undefined = await stat(outputPath).catch(
      (): undefined => undefined,
    );

    return stats?.isDirectory() ?? false;
  }
}
