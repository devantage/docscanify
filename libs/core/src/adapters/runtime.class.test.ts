import { Runtime } from './runtime.class';

describe('Runtime', (): void => {
  afterEach((): void => {
    delete (globalThis as { document?: unknown }).document;
  });

  it('is Node.js when there is no document', (): void => {
    expect(Runtime.isNode()).toBe(true);
  });

  it('is not Node.js when there is a document', (): void => {
    (globalThis as { document?: unknown }).document = {};

    expect(Runtime.isNode()).toBe(false);
  });
});
