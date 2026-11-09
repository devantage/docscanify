#!/usr/bin/env node
import { DocScanifyMcpApplication } from './application.class';
import type { TransportRunner } from './transports/transport-runner.interface';

/** Starts the server, stopping it on SIGINT and SIGTERM. */
async function main(): Promise<void> {
  const runner: TransportRunner | null =
    await new DocScanifyMcpApplication().run(process.argv.slice(2));

  if (!runner) {
    return;
  }

  const stop = (): void => {
    void runner.stop().finally((): never => process.exit(0));
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((error: unknown): void => {
  console.error(error);
  process.exit(1);
});
