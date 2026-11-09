import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import type { TransportRunner } from './transport-runner.interface';

/** Serves a single client over stdin and stdout. */
export class StdioTransportRunner implements TransportRunner {
  private server: McpServer | null = null;

  public constructor(private readonly createServer: () => McpServer) {}

  public async start(): Promise<void> {
    this.server = this.createServer();

    await this.server.connect(new StdioServerTransport());
  }

  public async stop(): Promise<void> {
    await this.server?.close();
    this.server = null;
  }
}
