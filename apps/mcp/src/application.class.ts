import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CliOptions } from './cli/cli-options.class';
import { DocScanifyMcpServer } from './server/docscanify-mcp-server.class';
import { HttpTransportRunner } from './transports/http-transport-runner.class';
import { StdioTransportRunner } from './transports/stdio-transport-runner.class';
import type { TransportRunner } from './transports/transport-runner.interface';

/** Where the application writes what is not the MCP protocol. */
export interface ApplicationOutput {
  /** Help and version */
  stdout: Pick<NodeJS.WriteStream, 'write'>;

  /** Errors and logs, which must never go to stdout, since stdio uses it for the protocol */
  stderr: Pick<NodeJS.WriteStream, 'write'>;
}

/** The docscanify-mcp command. */
export class DocScanifyMcpApplication {
  public constructor(
    private readonly output: ApplicationOutput = {
      stdout: process.stdout,
      stderr: process.stderr,
    },
  ) {}

  /**
   * The version of the package, read from the package.json next to the
   * folder of the sources, both in the repository and in the published package.
   */
  public static readVersion(): string {
    const packageJson: { version: string } = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
    ) as { version: string };

    return packageJson.version;
  }

  /**
   * Parses the arguments and starts the chosen transport.
   *
   * @param args the arguments, without the node executable and the script
   * @param env the environment variables, which set the options not given
   * @returns the started transport, or null if only help or version was
   * shown, or if the arguments were invalid, which sets `process.exitCode`
   */
  public async run(
    args: string[],
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<TransportRunner | null> {
    let options: CliOptions;

    try {
      options = CliOptions.parse(args, env);
    } catch (error) {
      this.output.stderr.write(
        `${(error as Error).message}\n\n${CliOptions.USAGE}\n`,
      );
      process.exitCode = 1;

      return null;
    }

    if (options.help) {
      this.output.stdout.write(`${CliOptions.USAGE}\n`);

      return null;
    }

    if (options.version) {
      this.output.stdout.write(`${DocScanifyMcpApplication.readVersion()}\n`);

      return null;
    }

    const runner: TransportRunner = this.createRunner(options);

    await runner.start();
    this.logStarted(options, runner);

    return runner;
  }

  private createRunner(options: CliOptions): TransportRunner {
    const servers: DocScanifyMcpServer = new DocScanifyMcpServer({
      version: DocScanifyMcpApplication.readVersion(),
      transport: options.transport,
    });
    const createServer = (): ReturnType<DocScanifyMcpServer['create']> =>
      servers.create();

    return options.transport === 'http'
      ? new HttpTransportRunner(createServer, options.http)
      : new StdioTransportRunner(createServer);
  }

  private logStarted(options: CliOptions, runner: TransportRunner): void {
    if (runner instanceof HttpTransportRunner) {
      const host: string = runner.address.address.includes(':')
        ? `[${runner.address.address}]`
        : runner.address.address;

      this.output.stderr.write(
        `DocScanify MCP server listening on http://${host}:${String(runner.address.port)}${options.http.path}\n`,
      );
    } else {
      this.output.stderr.write('DocScanify MCP server running on stdio\n');
    }
  }
}
