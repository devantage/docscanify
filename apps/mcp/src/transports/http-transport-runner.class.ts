import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import type { HttpListenOptions } from '../cli/cli-options.class';
import type { TransportRunner } from './transport-runner.interface';

/** Where and how the HTTP server listens. */
export interface HttpTransportRunnerOptions extends HttpListenOptions {
  /** Largest request body accepted, in bytes. Default: 64 MB, room for an image in base64 */
  maxBodyBytes?: number;
}

/** A JSON-RPC error code of the MCP SDK for requests the transport refuses. */
const JSON_RPC_SERVER_ERROR: number = -32000;

const JSON_RPC_PARSE_ERROR: number = -32700;

const DEFAULT_MAX_BODY_BYTES: number = 64 * 1024 * 1024;

const LOOPBACK_HOSTS: readonly string[] = ['127.0.0.1', 'localhost', '::1'];

/** Thrown while reading a request body larger than the limit. */
class BodyTooLargeError extends Error {}

/**
 * Serves clients over streamable HTTP, statelessly: every POST to the MCP
 * endpoint gets its own server and transport, closed with the response, so
 * any instance can answer any request. Also answers GET /health.
 */
export class HttpTransportRunner implements TransportRunner {
  private readonly maxBodyBytes: number;

  private readonly httpServer: Server;

  public constructor(
    private readonly createMcpServer: () => McpServer,
    private readonly options: HttpTransportRunnerOptions,
  ) {
    this.maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
    this.httpServer = createServer(
      (request: IncomingMessage, response: ServerResponse): void => {
        void this.handle(request, response);
      },
    );
  }

  /** The address it listens on, once started. Useful with port 0. */
  public get address(): AddressInfo {
    return this.httpServer.address() as AddressInfo;
  }

  public async start(): Promise<void> {
    await new Promise<void>(
      (resolve: () => void, reject: (error: Error) => void): void => {
        this.httpServer.once('error', reject);
        this.httpServer.listen(
          this.options.port,
          this.options.host,
          (): void => {
            this.httpServer.off('error', reject);
            resolve();
          },
        );
      },
    );
  }

  public async stop(): Promise<void> {
    if (!this.httpServer.listening) {
      return;
    }

    await new Promise<void>(
      (resolve: () => void, reject: (error: Error) => void): void => {
        this.httpServer.close((error?: Error): void => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
        this.httpServer.closeAllConnections();
      },
    );
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');

    if (pathname === '/health') {
      this.handleHealth(request, response);

      return;
    }

    if (pathname !== this.options.path) {
      this.sendJson(response, 404, { error: 'Not found' });

      return;
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      this.sendJsonRpcError(
        response,
        405,
        JSON_RPC_SERVER_ERROR,
        'Method not allowed: this server is stateless and only accepts POST',
      );

      return;
    }

    await this.handleMcp(request, response);
  }

  private handleHealth(
    request: IncomingMessage,
    response: ServerResponse,
  ): void {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      this.sendJson(response, 405, { error: 'Method not allowed' });

      return;
    }

    this.sendJson(response, 200, { status: 'ok' });
  }

  private async handleMcp(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    let body: unknown;

    try {
      body = JSON.parse((await this.readBody(request)).toString('utf8'));
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        this.sendJsonRpcError(
          response,
          413,
          JSON_RPC_SERVER_ERROR,
          `Request body larger than ${String(this.maxBodyBytes / 1024 / 1024)} MB`,
        );
      } else {
        this.sendJsonRpcError(
          response,
          400,
          JSON_RPC_PARSE_ERROR,
          'Parse error',
        );
      }

      return;
    }

    const server: McpServer = this.createMcpServer();
    const transport: StreamableHTTPServerTransport =
      new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
        ...this.createDnsRebindingProtection(),
      });

    response.on('close', (): void => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, body);
    } catch (error) {
      console.error('Failed to handle an MCP request:', error);

      if (!response.headersSent) {
        this.sendJsonRpcError(
          response,
          500,
          JSON_RPC_SERVER_ERROR,
          'Internal server error',
        );
      }
    }
  }

  /**
   * Reads the body up to the limit. Past it, the rest is drained without being
   * kept, so the client still gets the 413 response instead of a reset.
   */
  private async readBody(request: IncomingMessage): Promise<Buffer> {
    if (Number(request.headers['content-length']) > this.maxBodyBytes) {
      request.resume();

      return Promise.reject(new BodyTooLargeError());
    }

    return new Promise<Buffer>(
      (
        resolve: (body: Buffer) => void,
        reject: (error: Error) => void,
      ): void => {
        const chunks: Buffer[] = [];
        let size: number = 0;

        request.on('data', (chunk: Buffer): void => {
          size += chunk.byteLength;

          if (size <= this.maxBodyBytes) {
            chunks.push(chunk);
          }
        });
        request.on('end', (): void => {
          if (size > this.maxBodyBytes) {
            reject(new BodyTooLargeError());
          } else {
            resolve(Buffer.concat(chunks));
          }
        });
        request.on('error', reject);
      },
    );
  }

  /**
   * On a loopback host, accepts only requests addressed to it, so a web page
   * cannot reach the server through DNS rebinding.
   */
  private createDnsRebindingProtection(): {
    enableDnsRebindingProtection?: boolean;
    allowedHosts?: string[];
  } {
    if (!LOOPBACK_HOSTS.includes(this.options.host)) {
      return {};
    }

    const port: string = String(this.address.port);

    return {
      enableDnsRebindingProtection: true,
      allowedHosts: [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`],
    };
  }

  private sendJsonRpcError(
    response: ServerResponse,
    status: number,
    code: number,
    message: string,
  ): void {
    this.sendJson(response, status, {
      jsonrpc: '2.0',
      error: { code, message },
      id: null,
    });
  }

  private sendJson(
    response: ServerResponse,
    status: number,
    body: unknown,
  ): void {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  }
}
