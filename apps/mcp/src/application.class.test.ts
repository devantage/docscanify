import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  type ApplicationOutput,
  DocScanifyMcpApplication,
} from './application.class';
import { CliOptions } from './cli/cli-options.class';
import { HttpTransportRunner } from './transports/http-transport-runner.class';
import type { TransportRunner } from './transports/transport-runner.interface';

interface RecordedOutput extends ApplicationOutput {
  stdout: { write: jest.Mock };

  stderr: { write: jest.Mock };
}

/** An output that records what is written to it. */
function createOutput(): RecordedOutput {
  return {
    stdout: { write: jest.fn().mockReturnValue(true) },
    stderr: { write: jest.fn().mockReturnValue(true) },
  };
}

describe('DocScanifyMcpApplication', (): void => {
  afterEach((): void => {
    process.exitCode = undefined;
  });

  it('reads the version of the package', (): void => {
    expect(DocScanifyMcpApplication.readVersion()).toBe(
      (
        JSON.parse(
          readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
        ) as { version: string }
      ).version,
    );
  });

  it('shows the help', async (): Promise<void> => {
    const output: RecordedOutput = createOutput();

    await expect(
      new DocScanifyMcpApplication(output).run(['--help'], {}),
    ).resolves.toBeNull();
    expect(output.stdout.write).toHaveBeenCalledWith(`${CliOptions.USAGE}\n`);
  });

  it('shows the version', async (): Promise<void> => {
    const output: RecordedOutput = createOutput();

    await new DocScanifyMcpApplication(output).run(['--version'], {});

    expect(output.stdout.write).toHaveBeenCalledWith(
      `${DocScanifyMcpApplication.readVersion()}\n`,
    );
  });

  it('fails on invalid arguments, writing only to stderr', async (): Promise<void> => {
    const output: RecordedOutput = createOutput();

    await expect(
      new DocScanifyMcpApplication(output).run(['--transport', 'sse'], {}),
    ).resolves.toBeNull();
    expect(process.exitCode).toBe(1);
    expect(output.stdout.write).not.toHaveBeenCalled();
    expect(output.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('Invalid --transport "sse"'),
    );
  });

  it('starts the http transport set by the environment', async (): Promise<void> => {
    const output: RecordedOutput = createOutput();
    const runner: TransportRunner | null = await new DocScanifyMcpApplication(
      output,
    ).run([], { DOCSCANIFY_MCP_TRANSPORT: 'http', DOCSCANIFY_MCP_PORT: '0' });

    try {
      expect(runner).toBeInstanceOf(HttpTransportRunner);
      expect(output.stderr.write).toHaveBeenCalledWith(
        expect.stringMatching(
          /^DocScanify MCP server listening on http:\/\/127\.0\.0\.1:\d+\/mcp\n$/,
        ),
      );
    } finally {
      await runner?.stop();
    }
  });
});
