import type {
  ImageEnhancer,
  ImageFilter,
  ScannedDocument,
} from '@devantage/docscanify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createEnhancers,
  createFilter,
  createScannedDocument,
  NO_ENHANCEMENTS,
  renderWith,
} from './scan';
import type { EnhanceOptions } from './types';

interface Recorded {
  /** Options of the default adapters, which the module creates when it loads. */
  adapterOptions: unknown[];
  fromImageCalls: unknown[][];
}

const recorded: Recorded = vi.hoisted((): Recorded => ({
  adapterOptions: [],
  fromImageCalls: [],
}));

/** Fake OpenCV adapters that remember the options they were built with. */
vi.mock('@devantage/docscanify', (): Record<string, unknown> => {
  class FakeAdapter {
    public constructor(public readonly options: unknown) {}
  }
  class OpenCvNoiseReductionEnhancer extends FakeAdapter {}
  class OpenCvSharpnessEnhancer extends FakeAdapter {}
  class OpenCvRotationEnhancer extends FakeAdapter {}
  class OpenCvBlackAndWhiteFilter extends FakeAdapter {}
  class OpenCvGrayscaleFilter extends FakeAdapter {}
  return {
    createDefaultAdapters: (options: unknown): { adapters: true } => {
      recorded.adapterOptions.push(options);
      return { adapters: true };
    },
    ScannedDocument: {
      fromImage: async (...args: unknown[]): Promise<{ created: true }> => {
        recorded.fromImageCalls.push(args);
        return Promise.resolve({ created: true });
      },
    },
    OpenCvNoiseReductionEnhancer,
    OpenCvSharpnessEnhancer,
    OpenCvRotationEnhancer,
    OpenCvBlackAndWhiteFilter,
    OpenCvGrayscaleFilter,
  };
});

const SCRIPT_URL: string = `${import.meta.env.BASE_URL}opencv.js`;

/** Class name and options of an adapter built by the module. */
function describeAdapter(adapter: ImageEnhancer | ImageFilter | null): unknown {
  if (adapter === null) return null;
  return [
    adapter.constructor.name,
    (adapter as unknown as { options: unknown }).options,
  ];
}

/** {@link NO_ENHANCEMENTS}, with the given adjustments changed. */
function withOptions(overrides: Partial<EnhanceOptions>): EnhanceOptions {
  return { ...NO_ENHANCEMENTS, ...overrides };
}

beforeEach((): void => {
  recorded.fromImageCalls.length = 0;
});

describe('NO_ENHANCEMENTS', (): void => {
  it('keeps the original colors with no rotation, sharpening or noise reduction', (): void => {
    expect(NO_ENHANCEMENTS).toEqual({
      filter: 'none',
      turns: 0,
      sharpen: 'off',
    });
  });
});

describe('createScannedDocument', (): void => {
  it('creates the adapters once, loading OpenCV from the app base URL', (): void => {
    expect(SCRIPT_URL).toBe('/opencv.js');
    expect(recorded.adapterOptions).toEqual([{ scriptUrl: SCRIPT_URL }]);
  });

  it('creates the document from the bytes, keeping the whole image when nothing is detected', async (): Promise<void> => {
    const bytes: Uint8Array = new Uint8Array([1, 2, 3]);

    const doc: ScannedDocument = await createScannedDocument(
      bytes,
      'receipt.jpg',
    );

    expect(doc).toEqual({ created: true });
    expect(recorded.fromImageCalls).toEqual([
      [
        bytes,
        { adapters: true },
        { name: 'receipt.jpg', onNotDetected: 'original' },
      ],
    ]);
    expect(recorded.fromImageCalls[0][0]).toBe(bytes);
  });

  it('loads OpenCV from the base path the app is deployed under', async (): Promise<void> => {
    vi.stubEnv('BASE_URL', '/docscanify/');
    vi.resetModules();
    try {
      const scan: { createFilter: typeof createFilter } =
        await import('./scan');

      expect(recorded.adapterOptions.at(-1)).toEqual({
        scriptUrl: '/docscanify/opencv.js',
      });
      expect(describeAdapter(scan.createFilter('bw'))).toEqual([
        'OpenCvBlackAndWhiteFilter',
        { scriptUrl: '/docscanify/opencv.js' },
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('createEnhancers', (): void => {
  it('returns no enhancer when none is on', (): void => {
    expect(createEnhancers(NO_ENHANCEMENTS)).toEqual([]);
  });

  it('ignores the filter, which is not an enhancer', (): void => {
    expect(createEnhancers(withOptions({ filter: 'bw' }))).toEqual([]);
  });

  it.each(['soft', 'strong'] as const)(
    'adds noise reduction, then sharpness at the %s level',
    (level: 'soft' | 'strong'): void => {
      expect(
        createEnhancers(withOptions({ sharpen: level })).map(describeAdapter),
      ).toEqual([
        ['OpenCvNoiseReductionEnhancer', { scriptUrl: SCRIPT_URL }],
        ['OpenCvSharpnessEnhancer', { scriptUrl: SCRIPT_URL, level }],
      ]);
    },
  );

  it('adds neither noise reduction nor sharpness when sharpness is off', (): void => {
    expect(
      createEnhancers(withOptions({ sharpen: 'off', turns: 1 })).map(
        describeAdapter,
      ),
    ).toEqual([
      ['OpenCvRotationEnhancer', { scriptUrl: SCRIPT_URL, quarterTurns: 1 }],
    ]);
  });

  it.each([1, 2, 3, -1, -3, 5])(
    'adds rotation by %i quarter turns',
    (turns: number): void => {
      expect(
        createEnhancers(withOptions({ turns })).map(describeAdapter),
      ).toEqual([
        [
          'OpenCvRotationEnhancer',
          { scriptUrl: SCRIPT_URL, quarterTurns: turns },
        ],
      ]);
    },
  );

  it.each([0, 4, -4, 8])(
    'skips rotation for %i quarter turns, a full turn multiple',
    (turns: number): void => {
      expect(createEnhancers(withOptions({ turns }))).toEqual([]);
    },
  );

  it('orders them noise reduction, sharpness, rotation', (): void => {
    expect(
      createEnhancers({
        filter: 'grayscale',
        turns: 2,
        sharpen: 'strong',
      }).map(describeAdapter),
    ).toEqual([
      ['OpenCvNoiseReductionEnhancer', { scriptUrl: SCRIPT_URL }],
      ['OpenCvSharpnessEnhancer', { scriptUrl: SCRIPT_URL, level: 'strong' }],
      ['OpenCvRotationEnhancer', { scriptUrl: SCRIPT_URL, quarterTurns: 2 }],
    ]);
  });
});

describe('createFilter', (): void => {
  it('builds the black and white filter for bw', (): void => {
    expect(describeAdapter(createFilter('bw'))).toEqual([
      'OpenCvBlackAndWhiteFilter',
      { scriptUrl: SCRIPT_URL },
    ]);
  });

  it('builds the grayscale filter for grayscale', (): void => {
    expect(describeAdapter(createFilter('grayscale'))).toEqual([
      'OpenCvGrayscaleFilter',
      { scriptUrl: SCRIPT_URL },
    ]);
  });

  it('returns null for none, keeping the original colors', (): void => {
    expect(createFilter('none')).toBeNull();
  });
});

describe('renderWith', (): void => {
  interface FakeDocument {
    log: string[];
    enhancers: ImageEnhancer[][];
    filters: (ImageFilter | null)[];
    applyEnhancements(enhancers: ImageEnhancer[]): void;
    applyFilter(filter: ImageFilter | null): void;
    render(): Promise<Uint8Array>;
  }

  const PNG: Uint8Array = new Uint8Array([137, 80, 78, 71]);

  function fakeDocument(): FakeDocument {
    const doc: FakeDocument = {
      log: [],
      enhancers: [],
      filters: [],
      applyEnhancements: (enhancers: ImageEnhancer[]): void => {
        doc.log.push('applyEnhancements');
        doc.enhancers.push(enhancers);
      },
      applyFilter: (filter: ImageFilter | null): void => {
        doc.log.push('applyFilter');
        doc.filters.push(filter);
      },
      render: async (): Promise<Uint8Array> => {
        doc.log.push('render');
        return Promise.resolve(PNG);
      },
    };
    return doc;
  }

  it('applies the enhancers and the filter, then renders, returning the PNG', async (): Promise<void> => {
    const doc: FakeDocument = fakeDocument();

    const png: Uint8Array = await renderWith(
      doc as unknown as ScannedDocument,
      { filter: 'bw', turns: 1, sharpen: 'soft' },
    );

    expect(png).toBe(PNG);
    expect(doc.log).toEqual(['applyEnhancements', 'applyFilter', 'render']);
    expect(
      doc.enhancers.map((e: ImageEnhancer[]): unknown[] =>
        e.map(describeAdapter),
      ),
    ).toEqual([
      [
        ['OpenCvNoiseReductionEnhancer', { scriptUrl: SCRIPT_URL }],
        ['OpenCvSharpnessEnhancer', { scriptUrl: SCRIPT_URL, level: 'soft' }],
        ['OpenCvRotationEnhancer', { scriptUrl: SCRIPT_URL, quarterTurns: 1 }],
      ],
    ]);
    expect(doc.filters.map(describeAdapter)).toEqual([
      ['OpenCvBlackAndWhiteFilter', { scriptUrl: SCRIPT_URL }],
    ]);
  });

  it('clears earlier adjustments when rendering without any', async (): Promise<void> => {
    const doc: FakeDocument = fakeDocument();

    await renderWith(doc as unknown as ScannedDocument, NO_ENHANCEMENTS);

    expect(doc.enhancers).toEqual([[]]);
    expect(doc.filters).toEqual([null]);
  });

  it('starts the render in the same synchronous step as applying, so a concurrent render cannot interfere', async (): Promise<void> => {
    const doc: FakeDocument = fakeDocument();

    const first: Promise<Uint8Array> = renderWith(
      doc as unknown as ScannedDocument,
      withOptions({ filter: 'grayscale' }),
    );
    const second: Promise<Uint8Array> = renderWith(
      doc as unknown as ScannedDocument,
      withOptions({ filter: 'bw' }),
    );

    // Before awaiting anything, each render already started right after its own adjustments
    expect(doc.log).toEqual([
      'applyEnhancements',
      'applyFilter',
      'render',
      'applyEnhancements',
      'applyFilter',
      'render',
    ]);
    await Promise.all([first, second]);
  });
});
