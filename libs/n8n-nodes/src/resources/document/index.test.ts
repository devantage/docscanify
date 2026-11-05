import * as documentModule from './index';

describe('document index', (): void => {
  it('loads the document barrel file', (): void => {
    expect(documentModule).toBeDefined();
  });
});
