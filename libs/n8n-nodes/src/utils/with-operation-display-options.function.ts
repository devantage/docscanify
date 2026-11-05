import type { INodeProperties } from 'n8n-workflow';

/**
 * The framework renders operation properties as-is, so every property must
 * declare the resource/operation pair it belongs to.
 */
export function withOperationDisplayOptions(
  resource: string,
  operation: string,
  properties: INodeProperties[],
): INodeProperties[] {
  return properties.map((curProperty: INodeProperties): INodeProperties => ({
    ...curProperty,
    displayOptions: {
      ...curProperty.displayOptions,
      show: {
        resource: [resource],
        operation: [operation],
        ...curProperty.displayOptions?.show,
      },
    },
  }));
}
