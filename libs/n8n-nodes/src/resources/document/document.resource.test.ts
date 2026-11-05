import { DocumentResource } from './document.resource';
import { ScanOperation } from './scan';

describe('DocumentResource', (): void => {
  it('registers the scan operation', (): void => {
    const resource: DocumentResource = new DocumentResource();

    expect(resource.getOperation('scan')).toBeInstanceOf(ScanOperation);
  });
});
