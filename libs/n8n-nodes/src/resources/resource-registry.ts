import { ResourceRegistry } from '@devantage/n8n-custom-nodes-framework';

import { DocumentResource } from './document';

export const resourceRegistry: ResourceRegistry = new ResourceRegistry(
  new DocumentResource(),
);
