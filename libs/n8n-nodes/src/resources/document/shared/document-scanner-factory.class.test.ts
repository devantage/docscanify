import { createDocumentPhoto } from '../../../test-helpers';
import { DocumentScannerFactory } from './document-scanner-factory.class';

describe('DocumentScannerFactory', (): void => {
  const photo: Buffer = createDocumentPhoto().buffer;

  it('logs the candidate quadrilaterals with DEBUG_SCAN', async (): Promise<void> => {
    const error: jest.SpyInstance<void, unknown[]> = jest
      .spyOn(console, 'error')
      .mockImplementation((): void => undefined);
    let messages: unknown[][];

    process.env.DEBUG_SCAN = '1';

    try {
      await DocumentScannerFactory.create().scan(photo);
    } finally {
      messages = [...error.mock.calls];
      delete process.env.DEBUG_SCAN;
      error.mockRestore();
    }

    const candidates: Record<string, unknown>[] = JSON.parse(
      String(messages[0][0]),
    ) as Record<string, unknown>[];

    expect(candidates.length).toBeGreaterThan(0);
    expect(Object.keys(candidates[0])).toEqual([
      'topLeftCorner',
      'topRightCorner',
      'bottomLeftCorner',
      'bottomRightCorner',
      'area',
      'support',
    ]);
    expect(typeof candidates[0].support).toBe('number');
  });

  it('logs nothing without DEBUG_SCAN', async (): Promise<void> => {
    const error: jest.SpyInstance = jest.spyOn(console, 'error');

    await DocumentScannerFactory.create().scan(photo);

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
