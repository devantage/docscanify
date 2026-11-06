import { ResourceNode } from '@devantage/n8n-custom-nodes-framework';

import { resourceRegistry } from '../resources';

export class DocScanify extends ResourceNode {
  public constructor() {
    super(resourceRegistry, {
      displayName: 'DocScanify',
      name: 'docScanify',
      icon: 'file:../../icons/icon.svg',
      version: 1,
      description:
        'Detects a document in an image, corrects its perspective, and outputs it as an image or PDF',
      credentials: [],
    });
  }
}
