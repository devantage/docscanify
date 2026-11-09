import { type DocumentOutput, DocumentScanner } from '@devantage/docscanify';
import { TestUtil } from '@devantage/n8n-custom-nodes-framework';
import type {
  IBinaryData,
  INodeExecutionData,
  INodeProperties,
  INodePropertyOptions,
} from 'n8n-workflow';

import { ScanOperation } from './scan.operation';

type ScanContext = ReturnType<typeof TestUtil.createExecuteFunctionsMock>;

const SCAN_RESULT: DocumentOutput = {
  file: {
    buffer: new Uint8Array(Buffer.from('pdf')),
    mimeType: 'application/pdf',
    fileExtension: 'pdf',
  },
  report: {
    corners: {
      topLeft: { x: 1, y: 2 },
      topRight: { x: 3, y: 4 },
      bottomRight: { x: 5, y: 6 },
      bottomLeft: { x: 7, y: 8 },
    },
    dimensions: { width: 100, height: 200 },
    originalFile: {
      name: null,
      mimeType: 'image/jpeg',
      dimensions: { width: 800, height: 900 },
      size: 9,
    },
  },
};

const SCAN_CORNERS: Record<string, { x: number; y: number }> = {
  topLeftCorner: { x: 1, y: 2 },
  topRightCorner: { x: 3, y: 4 },
  bottomRightCorner: { x: 5, y: 6 },
  bottomLeftCorner: { x: 7, y: 8 },
};

const IMAGE_BINARY_DATA: IBinaryData = TestUtil.createBinaryData({
  fileName: 'photo.jpg',
  mimeType: 'image/jpeg',
});

const OUTPUT_BINARY_DATA: IBinaryData = TestUtil.createBinaryData({
  fileName: 'photo.pdf',
});

function createContext(
  options: Record<string, unknown> = {},
  outputFormat: string = 'pdf',
  imageBinaryData: IBinaryData = IMAGE_BINARY_DATA,
): ScanContext {
  const context: ScanContext = TestUtil.createExecuteFunctionsMock(
    {
      binaryPropertyName: 'image',
      outputFormat,
      outputBinaryPropertyName: 'scan',
      options,
    },
    {
      getInputData: jest
        .fn<INodeExecutionData[], []>()
        .mockReturnValue([
          TestUtil.createNodeExecutionData(
            { id: 42 },
            { binary: { image: imageBinaryData } },
          ),
        ]),
      helpers: {
        prepareBinaryData: jest.fn().mockResolvedValue(OUTPUT_BINARY_DATA),
      } as never,
    },
  );

  context.helpers.assertBinaryData.mockReturnValue(imageBinaryData);

  return context;
}

function getPrepareBinaryDataMock(context: ScanContext): jest.Mock {
  return (context.helpers as unknown as { prepareBinaryData: jest.Mock })
    .prepareBinaryData;
}

function getOption(
  operation: ScanOperation,
  name: string,
): INodeProperties | undefined {
  const options: INodeProperties | undefined = operation.properties.find(
    (property: INodeProperties): boolean => property.name === 'options',
  );

  return (options?.options as INodeProperties[] | undefined)?.find(
    (option: INodeProperties): boolean => option.name === name,
  );
}

describe('ScanOperation', (): void => {
  let scan: jest.SpyInstance;

  beforeEach((): void => {
    scan = jest
      .spyOn(DocumentScanner.prototype, 'scan')
      .mockResolvedValue(SCAN_RESULT);
  });

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('declares its properties for the document resource only', (): void => {
    const operation: ScanOperation = new ScanOperation('document');

    expect(
      operation.properties.map(
        (property: INodeProperties): string => property.name,
      ),
    ).toEqual([
      'binaryPropertyName',
      'outputFormat',
      'outputBinaryPropertyName',
      'options',
    ]);

    for (const property of operation.properties) {
      expect(property.displayOptions?.show).toEqual({
        resource: ['document'],
        operation: ['scan'],
      });
    }
  });

  it('defaults the output format to PDF', (): void => {
    const operation: ScanOperation = new ScanOperation('document');
    const outputFormat: INodeProperties | undefined = operation.properties.find(
      (property: INodeProperties): boolean => property.name === 'outputFormat',
    );

    expect(outputFormat?.default).toBe('pdf');
  });

  it.each(['pageSize', 'margin'])(
    'shows the %s option only for PDF output',
    (name: string): void => {
      const operation: ScanOperation = new ScanOperation('document');

      expect(getOption(operation, name)?.displayOptions).toEqual({
        show: { '/outputFormat': ['pdf'] },
      });
    },
  );

  it.each([
    ['noiseReduction', false],
    ['sharpness', 'off'],
    ['rotation', 0],
  ])(
    'leaves the %s enhancement off by default',
    (name: string, value: unknown): void => {
      const operation: ScanOperation = new ScanOperation('document');

      expect(getOption(operation, name)?.default).toBe(value);
    },
  );

  it('offers the rotations in quarter turns', (): void => {
    const operation: ScanOperation = new ScanOperation('document');

    expect(
      (getOption(operation, 'rotation')?.options as INodePropertyOptions[]).map(
        (option: INodePropertyOptions): unknown => option.value,
      ),
    ).toEqual([0, 90, 180, 270]);
  });

  it('scans the image and adds the PDF to the item', async (): Promise<void> => {
    const context: ScanContext = createContext({
      filter: 'bw',
      pageSize: 'letter',
    });

    const operation: ScanOperation = new ScanOperation('document');
    const result: INodeExecutionData = await operation.execute.call(
      context as never,
      0,
    );

    expect(context.helpers.getBinaryDataBuffer).toHaveBeenCalledWith(
      0,
      'image',
    );
    expect(scan).toHaveBeenCalledWith(Buffer.from('test file'), {
      filter: 'bw',
      pageSize: 'letter',
      outputFormat: 'pdf',
    });
    expect(getPrepareBinaryDataMock(context)).toHaveBeenCalledWith(
      Buffer.from('pdf'),
      'photo.pdf',
      'application/pdf',
    );
    expect(result).toEqual({
      json: {
        id: 42,
        scan: {
          detected: true,
          corners: SCAN_CORNERS,
          width: 100,
          height: 200,
        },
      },
      binary: {
        image: IMAGE_BINARY_DATA,
        scan: OUTPUT_BINARY_DATA,
      },
      pairedItem: 0,
    });
  });

  it('passes the enhancements to the scanner', async (): Promise<void> => {
    const context: ScanContext = createContext({
      noiseReduction: true,
      sharpness: 'soft',
      rotation: 270,
    });

    const operation: ScanOperation = new ScanOperation('document');

    await operation.execute.call(context as never, 0);

    expect(scan).toHaveBeenCalledWith(expect.any(Buffer), {
      noiseReduction: true,
      sharpness: 'soft',
      rotation: 270,
      outputFormat: 'pdf',
    });
  });

  it('returns the scan as an image when the output format is image', async (): Promise<void> => {
    scan.mockResolvedValueOnce({
      ...SCAN_RESULT,
      file: {
        buffer: new Uint8Array(Buffer.from('png')),
        mimeType: 'image/png',
        fileExtension: 'png',
      },
    });

    const context: ScanContext = createContext({ filter: 'bw' }, 'image');

    const operation: ScanOperation = new ScanOperation('document');

    await operation.execute.call(context as never, 0);

    expect(scan).toHaveBeenCalledWith(expect.any(Buffer), {
      filter: 'bw',
      outputFormat: 'image',
    });
    expect(getPrepareBinaryDataMock(context)).toHaveBeenCalledWith(
      Buffer.from('png'),
      'photo.png',
      'image/png',
    );
  });

  it('uses the custom file name without passing it to the scanner', async (): Promise<void> => {
    const context: ScanContext = createContext({ fileName: 'id.pdf' });

    const operation: ScanOperation = new ScanOperation('document');

    await operation.execute.call(context as never, 0);

    expect(scan).toHaveBeenCalledWith(expect.any(Buffer), {
      outputFormat: 'pdf',
    });
    expect(getPrepareBinaryDataMock(context)).toHaveBeenCalledWith(
      Buffer.from('pdf'),
      'id.pdf',
      'application/pdf',
    );
  });

  it('names the output "scan" when the image has no file name', async (): Promise<void> => {
    const context: ScanContext = createContext({}, 'pdf', {
      ...IMAGE_BINARY_DATA,
      fileName: undefined,
    });

    const operation: ScanOperation = new ScanOperation('document');

    await operation.execute.call(context as never, 0);

    expect(getPrepareBinaryDataMock(context)).toHaveBeenCalledWith(
      Buffer.from('pdf'),
      'scan.pdf',
      'application/pdf',
    );
  });

  it('returns null corners when no document was detected', async (): Promise<void> => {
    scan.mockResolvedValueOnce({
      ...SCAN_RESULT,
      report: { ...SCAN_RESULT.report, corners: null },
    });

    const context: ScanContext = createContext();

    const operation: ScanOperation = new ScanOperation('document');
    const result: INodeExecutionData = await operation.execute.call(
      context as never,
      0,
    );

    expect(result.json.scan).toMatchObject({ detected: false, corners: null });
  });
});
