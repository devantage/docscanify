import type { INodeProperties } from 'n8n-workflow';

import { withOperationDisplayOptions } from './with-operation-display-options.function';

describe('withOperationDisplayOptions', (): void => {
  it('shows every property only for the resource and operation', (): void => {
    const [property]: INodeProperties[] = withOperationDisplayOptions(
      'document',
      'scan',
      [{ name: 'field', displayName: 'Field', type: 'string', default: '' }],
    );

    expect(property.displayOptions).toEqual({
      show: { resource: ['document'], operation: ['scan'] },
    });
  });

  it('keeps the display options already declared', (): void => {
    const [property]: INodeProperties[] = withOperationDisplayOptions(
      'document',
      'scan',
      [
        {
          name: 'field',
          displayName: 'Field',
          type: 'string',
          default: '',
          displayOptions: {
            show: { filter: ['bw'] },
            hide: { pageSize: ['image'] },
          },
        },
      ],
    );

    expect(property.displayOptions).toEqual({
      show: {
        resource: ['document'],
        operation: ['scan'],
        filter: ['bw'],
      },
      hide: { pageSize: ['image'] },
    });
  });
});
