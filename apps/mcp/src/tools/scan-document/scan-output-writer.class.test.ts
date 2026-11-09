import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

import { ScanOutputWriter } from './scan-output-writer.class';

const FILE: Uint8Array = new Uint8Array(Buffer.from('pdf'));

describe('ScanOutputWriter', (): void => {
  const writer: ScanOutputWriter = new ScanOutputWriter();
  let directory: string;

  beforeEach(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'docscanify-mcp-'));
  });

  afterEach(async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  });

  it('saves to a file path, creating the missing directories', async (): Promise<void> => {
    const target: string = join(directory, 'a', 'b', 'out.pdf');

    await expect(writer.write(target, 'scan.pdf', FILE)).resolves.toBe(target);
    expect(await readFile(target, 'utf8')).toBe('pdf');
  });

  it('saves in an existing directory with the file name', async (): Promise<void> => {
    await mkdir(join(directory, 'scans'));

    await expect(
      writer.write(join(directory, 'scans'), 'scan.pdf', FILE),
    ).resolves.toBe(join(directory, 'scans', 'scan.pdf'));
  });

  it('saves in a new directory when the path ends with a separator', async (): Promise<void> => {
    const target: string = join(directory, 'new', 'scan.pdf');

    await expect(
      writer.write(`${join(directory, 'new')}${sep}`, 'scan.pdf', FILE),
    ).resolves.toBe(target);
    expect(await readFile(target, 'utf8')).toBe('pdf');
  });
});
