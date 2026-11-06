import { Resource } from '@devantage/n8n-custom-nodes-framework';

import { ScanOperation } from './scan';

export class DocumentResource extends Resource {
  public constructor() {
    super('document', 'Document', ScanOperation);
  }
}
