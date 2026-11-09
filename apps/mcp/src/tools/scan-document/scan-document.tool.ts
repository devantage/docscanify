import { parse } from 'node:path';

import type { DocumentOutput, DocumentScanner } from '@devantage/docscanify';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  CallToolResult,
  ContentBlock,
} from '@modelcontextprotocol/sdk/types.js';

import type { TransportName } from '../../cli/cli-options.class';
import type {
  ImageSourceResolver,
  ResolvedImage,
} from './image-source-resolver.class';
import {
  SCAN_DOCUMENT_INPUT_SCHEMA,
  SCAN_DOCUMENT_OUTPUT_SCHEMA,
  type ScanDocumentInput,
  type ScanDocumentOutput,
} from './scan-document.schema';
import type { ScanOutputWriter } from './scan-output-writer.class';

/** What the scan_document tool works with. */
export interface ScanDocumentToolDependencies {
  scanner: DocumentScanner;

  imageSourceResolver: ImageSourceResolver;

  scanOutputWriter: ScanOutputWriter;

  /** The transport of the server: files are only saved with stdio */
  transport: TransportName;
}

/**
 * The scan_document tool: detects the document in an image, corrects its
 * perspective, enhances and filters it, and returns it as a PDF or an image.
 */
export class ScanDocumentTool {
  public static readonly NAME: string = 'scan_document';

  public constructor(
    private readonly dependencies: ScanDocumentToolDependencies,
  ) {}

  public register(server: McpServer): void {
    server.registerTool(
      ScanDocumentTool.NAME,
      {
        title: 'Scan document',
        description:
          'Scans a document out of a photo, like a "CamScanner" app: detects the edges of the document, crops it, corrects its perspective, optionally reduces the noise, sharpens, rotates and applies a grayscale or black and white filter, and returns it as a PDF or an image, with the corners it was cropped from.',
        inputSchema: SCAN_DOCUMENT_INPUT_SCHEMA,
        outputSchema: SCAN_DOCUMENT_OUTPUT_SCHEMA,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async (input: ScanDocumentInput): Promise<CallToolResult> =>
        this.call(input),
    );
  }

  /**
   * Scans the image of the arguments. Failures are returned as tool errors,
   * so the client can read them, instead of failing the request.
   */
  public async call(input: ScanDocumentInput): Promise<CallToolResult> {
    try {
      return await this.scan(input);
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  private async scan(input: ScanDocumentInput): Promise<CallToolResult> {
    if (input.outputPath && this.dependencies.transport !== 'stdio') {
      throw new Error('outputPath is only available with the stdio transport');
    }

    const image: ResolvedImage =
      await this.dependencies.imageSourceResolver.resolve(input);
    const { file, report }: DocumentOutput =
      await this.dependencies.scanner.scan(image.buffer, {
        name: image.name,
        outputFormat: input.outputFormat,
        filter: input.filter,
        noiseReduction: input.noiseReduction,
        sharpness: input.sharpness,
        rotation: input.rotation,
        pageSize: input.pageSize,
        margin: input.margin,
        maxDimension: input.maxDimension,
        jpegQuality: input.jpegQuality,
        onNotDetected: input.onNotDetected,
      });
    const fileName: string =
      input.fileName ||
      `${image.name ? parse(image.name).name : 'scan'}.${file.fileExtension}`;
    const savedTo: string | undefined = input.outputPath
      ? await this.dependencies.scanOutputWriter.write(
          input.outputPath,
          fileName,
          file.buffer,
        )
      : undefined;
    const output: ScanDocumentOutput = {
      detected: report.corners !== null,
      corners: report.corners,
      width: report.dimensions.width,
      height: report.dimensions.height,
      mimeType: file.mimeType,
      fileName,
      ...(savedTo && { savedTo }),
    };

    return {
      content: [
        this.createFileContent(file.buffer, file.mimeType, fileName),
        { type: 'text', text: JSON.stringify(output) },
      ],
      structuredContent: { ...output },
    };
  }

  /** Images go as image content, which clients show; other files as an embedded resource. */
  private createFileContent(
    buffer: Uint8Array,
    mimeType: string,
    fileName: string,
  ): ContentBlock {
    const data: string = Buffer.from(buffer).toString('base64');

    if (mimeType.startsWith('image/')) {
      return { type: 'image', data, mimeType };
    }

    return {
      type: 'resource',
      resource: {
        uri: `docscanify://scans/${encodeURIComponent(fileName)}`,
        mimeType,
        blob: data,
      },
    };
  }
}
