import { ResourceOperation } from '@devantage/n8n-custom-nodes-framework';
import type {
  IBinaryData,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import * as path from 'path';

import { withOperationDisplayOptions } from '../../../utils';
import {
  DocumentScanner,
  type DocumentScannerOptions,
  type OutputFormat,
  type ScanResult,
} from '../shared';

/** The options collection of the operation. */
type ScanOperationOptions = Omit<DocumentScannerOptions, 'outputFormat'> & {
  fileName?: string;
};

export class ScanOperation extends ResourceOperation {
  public readonly name: string = 'scan';

  public readonly displayName: string = 'Scan Document';

  public readonly description: string = 'Scan a document from an image';

  public readonly properties: INodeProperties[] = withOperationDisplayOptions(
    this.resource,
    this.name,
    [
      {
        name: 'binaryPropertyName',
        displayName: 'Input Binary Field',
        description:
          'Binary field that contains the image (JPG, PNG, WebP and other common formats)',
        type: 'string',
        required: true,
        default: 'data',
      },
      {
        name: 'outputFormat',
        displayName: 'Output Format',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'PDF',
            value: 'pdf',
            description: 'Return the scanned document inside a PDF page',
          },
          {
            name: 'Image',
            value: 'image',
            description:
              'Return only the scanned image (JPEG, or PNG for the Black & White filter)',
          },
        ],
        default: 'pdf',
      },
      {
        name: 'outputBinaryPropertyName',
        displayName: 'Output Binary Field',
        description: 'Binary field where the result will be written',
        type: 'string',
        required: true,
        default: 'data',
      },
      {
        name: 'options',
        displayName: 'Options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            name: 'fileName',
            displayName: 'File Name',
            description:
              'Output file name. Leave empty to use the image name with the extension of the output format.',
            type: 'string',
            default: '',
          },
          {
            name: 'filter',
            displayName: 'Filter',
            type: 'options',
            options: [
              { name: 'None (Color)', value: 'none' },
              { name: 'Grayscale', value: 'grayscale' },
              { name: 'Black & White (Document)', value: 'bw' },
            ],
            default: 'none',
          },
          {
            name: 'noiseReduction',
            displayName: 'Reduce Noise',
            description:
              'Whether to smooth the noise of the document, preserving the edges of the text',
            type: 'boolean',
            default: false,
          },
          {
            name: 'sharpness',
            displayName: 'Sharpen',
            type: 'options',
            options: [
              { name: 'Off', value: 'off' },
              { name: 'Soft', value: 'soft' },
              { name: 'Strong', value: 'strong' },
            ],
            default: 'off',
          },
          {
            name: 'rotation',
            displayName: 'Rotation',
            description: 'Rotates the scanned document clockwise',
            type: 'options',
            options: [
              { name: 'None', value: 0 },
              { name: '90°', value: 90 },
              { name: '180°', value: 180 },
              { name: '270°', value: 270 },
            ],
            default: 0,
          },
          {
            name: 'pageSize',
            displayName: 'Page Size',
            type: 'options',
            options: [
              { name: 'A4', value: 'a4' },
              { name: 'Letter', value: 'letter' },
              { name: 'Same as Image (150 DPI)', value: 'image' },
            ],
            default: 'a4',
            displayOptions: { show: { '/outputFormat': ['pdf'] } },
          },
          {
            name: 'margin',
            displayName: 'Margin (Pt)',
            type: 'number',
            typeOptions: { minValue: 0 },
            default: 0,
            displayOptions: { show: { '/outputFormat': ['pdf'] } },
          },
          {
            name: 'maxDimension',
            displayName: 'Max Dimension (Px)',
            description:
              'Downscales the image so its longest side is at most this size before processing. Saves memory.',
            type: 'number',
            typeOptions: { minValue: 500 },
            default: 3000,
          },
          {
            name: 'jpegQuality',
            displayName: 'JPEG Quality',
            description:
              'Quality of the JPEG image. Not used by the Black & White filter, which is encoded as PNG.',
            type: 'number',
            typeOptions: { minValue: 1, maxValue: 100 },
            default: 85,
          },
          {
            name: 'onNotDetected',
            displayName: 'If No Document Detected',
            type: 'options',
            options: [
              { name: 'Throw Error', value: 'error' },
              { name: 'Use Original Image', value: 'original' },
            ],
            default: 'error',
          },
        ],
      },
    ],
  );

  public async execute(
    this: IExecuteFunctions,
    itemIndex: number,
  ): Promise<INodeExecutionData> {
    const binaryPropertyName: string = this.getNodeParameter(
      'binaryPropertyName',
      itemIndex,
    );

    const outputFormat: OutputFormat = this.getNodeParameter(
      'outputFormat',
      itemIndex,
    ) as OutputFormat;

    const outputBinaryPropertyName: string = this.getNodeParameter(
      'outputBinaryPropertyName',
      itemIndex,
    ) as string;

    const { fileName, ...scannerOptions } = this.getNodeParameter(
      'options',
      itemIndex,
      {},
    ) as ScanOperationOptions;

    const item: INodeExecutionData = this.getInputData()[itemIndex];

    const binaryData: IBinaryData = this.helpers.assertBinaryData(
      itemIndex,
      binaryPropertyName,
    );

    const imageBuffer: Buffer = await this.helpers.getBinaryDataBuffer(
      itemIndex,
      binaryPropertyName,
    );

    const result: ScanResult = await new DocumentScanner().scan(imageBuffer, {
      ...scannerOptions,
      outputFormat,
    });

    const baseName: string = binaryData.fileName
      ? path.parse(binaryData.fileName).name
      : 'scan';

    const outputBinaryData: IBinaryData = await this.helpers.prepareBinaryData(
      result.data,
      fileName || `${baseName}.${result.fileExtension}`,
      result.mimeType,
    );

    return {
      json: {
        ...item.json,
        scan: {
          detected: result.detected,
          corners: result.corners ? { ...result.corners } : null,
          width: result.width,
          height: result.height,
        },
      },
      binary: {
        ...item.binary,
        [outputBinaryPropertyName]: outputBinaryData,
      },
      pairedItem: itemIndex,
    };
  }
}
