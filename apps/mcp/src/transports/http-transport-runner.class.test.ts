import { type ClientRequest, type IncomingMessage, request } from 'node:http';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { DocScanifyMcpServer } from '../server/docscanify-mcp-server.class';
import { createDocumentPhoto } from '../test-helpers';
import { HttpTransportRunner } from './http-transport-runner.class';

const INITIALIZE_REQUEST: string = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' },
  },
});

const MCP_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

describe('HttpTransportRunner', (): void => {
  const servers: DocScanifyMcpServer = new DocScanifyMcpServer({
    version: '1.0.0',
    transport: 'http',
  });
  let runner: HttpTransportRunner;
  let baseUrl: string;

  beforeAll(async (): Promise<void> => {
    runner = new HttpTransportRunner(
      (): ReturnType<DocScanifyMcpServer['create']> => servers.create(),
      {
        host: '127.0.0.1',
        port: 0,
        path: '/mcp',
        maxBodyBytes: 4 * 1024 * 1024,
      },
    );
    await runner.start();
    baseUrl = `http://127.0.0.1:${String(runner.address.port)}`;
  });

  afterAll(async (): Promise<void> => {
    await runner.stop();
  });

  it('serves the tools to an MCP client', async (): Promise<void> => {
    const client: Client = new Client({ name: 'test', version: '1.0.0' });

    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)),
    );

    try {
      const result: CallToolResult = (await client.callTool({
        name: 'scan_document',
        arguments: {
          imageBase64: createDocumentPhoto().toString('base64'),
          outputFormat: 'image',
        },
      })) as CallToolResult;

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        detected: true,
        mimeType: 'image/jpeg',
      });
    } finally {
      await client.close();
    }
  });

  it('answers the health check', async (): Promise<void> => {
    const response: Response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it.each(['GET', 'DELETE'])(
    'refuses %s on the MCP endpoint, since it is stateless',
    async (method: string): Promise<void> => {
      const response: Response = await fetch(`${baseUrl}/mcp`, { method });

      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
    },
  );

  it('answers 404 outside of the MCP endpoint', async (): Promise<void> => {
    const response: Response = await fetch(`${baseUrl}/other`, {
      method: 'POST',
      headers: MCP_HEADERS,
      body: INITIALIZE_REQUEST,
    });

    expect(response.status).toBe(404);
  });

  it('refuses a body above the limit', async (): Promise<void> => {
    const response: Response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: MCP_HEADERS,
      body: JSON.stringify({ padding: 'x'.repeat(5 * 1024 * 1024) }),
    });

    expect(response.status).toBe(413);
  });

  it('refuses a body that is not JSON', async (): Promise<void> => {
    const response: Response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: MCP_HEADERS,
      body: '{',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: -32700 },
    });
  });

  it('refuses a request addressed to another host, against DNS rebinding', async (): Promise<void> => {
    // fetch does not let the Host header be changed
    const status: number = await new Promise<number>(
      (
        resolve: (status: number) => void,
        reject: (error: Error) => void,
      ): void => {
        const outgoing: ClientRequest = request(
          `${baseUrl}/mcp`,
          {
            method: 'POST',
            headers: { ...MCP_HEADERS, Host: 'evil.example.com' },
          },
          (response: IncomingMessage): void => {
            response.resume();
            resolve(response.statusCode ?? 0);
          },
        );

        outgoing.on('error', reject);
        outgoing.end(INITIALIZE_REQUEST);
      },
    );

    expect(status).toBe(403);
  });
});
