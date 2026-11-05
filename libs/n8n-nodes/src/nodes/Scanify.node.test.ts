import {
  ExecuteFunctionsMock,
  TestUtil,
} from '@devantage/n8n-custom-nodes-framework';
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { resourceRegistry } from '../resources';
import { Scanify } from './Scanify.node';

function mockOperation(execute: jest.Mock<Promise<unknown>, [number]>): void {
  jest.spyOn(resourceRegistry, 'getResource').mockReturnValue({
    getOperation: jest.fn().mockReturnValue({ execute }),
  } as never);
}

describe('Scanify node', (): void => {
  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('describes the node with the registry properties and no credentials', (): void => {
    const node: Scanify = new Scanify();

    expect(node.description.name).toBe('scanify');
    expect(node.description.icon).toBe('file:../../icons/icon.svg');
    expect(node.description.credentials).toEqual([]);
    expect(node.description.properties[0].name).toBe('resource');
    expect(node.description.properties[0].options).toEqual([
      { name: 'Document', value: 'document' },
    ]);
  });

  it('executes the selected resource operation for every item', async (): Promise<void> => {
    const context: ExecuteFunctionsMock = TestUtil.createExecuteFunctionsMock({
      resource: 'document',
      operation: 'scan',
    });
    const executeMock: jest.Mock<Promise<unknown>, [number]> = jest
      .fn<Promise<unknown>, [number]>()
      .mockResolvedValue({ json: { ok: true } });

    mockOperation(executeMock);

    const node: Scanify = new Scanify();
    const result: INodeExecutionData[][] = await TestUtil.executeNode(
      node,
      context as unknown as IExecuteFunctions,
    );

    expect(result).toEqual([[{ json: { ok: true } }]]);
    expect(executeMock).toHaveBeenCalledWith(0);
  });

  it('throws when the resource is missing', async (): Promise<void> => {
    const context: ExecuteFunctionsMock = TestUtil.createExecuteFunctionsMock({
      operation: 'scan',
    });

    const node: Scanify = new Scanify();

    await expect(
      TestUtil.executeNode(node, context as unknown as IExecuteFunctions),
    ).rejects.toThrow(NodeOperationError);
  });

  it('returns item errors instead of throwing when continueOnFail is enabled', async (): Promise<void> => {
    const context: ExecuteFunctionsMock = TestUtil.createExecuteFunctionsMock({
      resource: 'document',
      operation: 'scan',
    });

    context.continueOnFail.mockReturnValue(true);

    mockOperation(
      jest
        .fn<Promise<unknown>, [number]>()
        .mockRejectedValue(new Error('No document detected in the image')),
    );

    const node: Scanify = new Scanify();
    const result: INodeExecutionData[][] = await TestUtil.executeNode(
      node,
      context as unknown as IExecuteFunctions,
    );

    expect(result[0][0].error?.message).toBe(
      'No document detected in the image',
    );
  });
});
