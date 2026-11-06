import * as resourcesModule from './index';

describe('resources index', (): void => {
  it('loads the resources barrel file', (): void => {
    expect(resourcesModule).toBeDefined();
  });
});
