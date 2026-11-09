import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { render, screen, waitFor, within } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import type { JSX } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/toast';
import { TranslateProvider } from '@/i18n';
import { detectCorners } from '@/lib/detect';
import { sourceFromFile } from '@/lib/image';
import type { SourceImage } from '@/lib/types';

import { App } from './App';

// Boundaries jsdom cannot run (decoding, OpenCV, canvas thumbnails) are mocked; the steps after
// Upload are covered by their own tests and only need to be told apart. The PWA virtual module
// resolves to a stand-in with no new version (see vitest.config.ts), so UpdatePrompt stays real.
vi.mock('@/features/crop/CropStep', () => ({
  CropStep: (): JSX.Element => <div data-testid="crop-step" />,
}));
vi.mock('@/features/result/ResultSteps', () => ({
  ResultSteps: (): JSX.Element => <div data-testid="result-steps" />,
}));
vi.mock('@/features/documents/usePreviews', () => ({
  usePreviews: (): Record<string, never> => ({}),
}));
vi.mock('@/components/useAnimatedProgress', () => ({
  useAnimatedProgress: (value: number): number => value,
}));
vi.mock('@/lib/loading', () => ({
  PAINT_DELAY: 0,
  MIN_LOADING_MS: 0,
  waitForPaint: async (): Promise<void> => {
    await Promise.resolve();
  },
  withMinDuration: async <T,>(work: () => Promise<T>): Promise<T> => work(),
}));
vi.mock('@/lib/image', () => ({
  sourceFromFile: vi.fn(),
  fileStamp: (): string => '202611060930',
  frameFromVideo: vi.fn(),
  thumbnailFrom: vi.fn(),
  thumbnailFromPng: vi.fn(),
  canvasFromPng: vi.fn(),
}));
vi.mock('@/lib/detect', () => ({ detectCorners: vi.fn() }));

const CORNERS: Corners = {
  topLeft: { x: 10, y: 10 },
  topRight: { x: 90, y: 10 },
  bottomLeft: { x: 10, y: 90 },
  bottomRight: { x: 90, y: 90 },
};

function imageFile(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' });
}

function renderApp(): void {
  render(
    <TranslateProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </TranslateProvider>,
  );
}

function step(index: number): HTMLElement {
  return screen.getByTestId(`step-${String(index)}`);
}

async function uploadImages(user: UserEvent, names: string[]): Promise<void> {
  await user.upload(screen.getByTestId('file-input'), names.map(imageFile));
  // The import ends when its progress goes away
  await waitFor(
    (): void => {
      expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument();
    },
    { timeout: 3000 },
  );
}

describe('App', (): void => {
  beforeEach((): void => {
    vi.mocked(sourceFromFile).mockImplementation(
      async (file: File): Promise<SourceImage> =>
        Promise.resolve({
          image: new Image(),
          url: `blob:${file.name}`,
          name: file.name,
          scannedDocument: {} as ScannedDocument,
        }),
    );
    vi.mocked(detectCorners).mockResolvedValue(CORNERS);
    // jsdom does not implement scrolling, which the carousel uses
    Object.defineProperty(Element.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach((): void => {
    Reflect.deleteProperty(Element.prototype, 'scrollTo');
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('starts on the Upload step, with nothing to crop yet', (): void => {
    renderApp();

    expect(
      screen.getByRole('heading', {
        name: 'Take photos or upload images of your documents',
      }),
    ).toBeInTheDocument();
    expect(step(0)).toHaveAttribute('aria-current', 'step');
    expect(step(1)).toBeDisabled();
    expect(step(2)).toBeDisabled();
    expect(step(3)).toBeDisabled();
  });

  it('imports images into the carousel and opens the next steps', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    renderApp();

    await uploadImages(user, ['first.jpg', 'second.jpg']);

    expect(
      screen.getByRole('heading', { name: 'You uploaded 2 images' }),
    ).toBeInTheDocument();
    const list: HTMLElement = screen.getByRole('list', { name: 'Documents' });
    expect(
      Array.from(list.querySelectorAll('img')).map((img: HTMLImageElement) =>
        img.getAttribute('src'),
      ),
    ).toEqual(['blob:first.jpg', 'blob:second.jpg']);
    expect(step(1)).toBeEnabled();
    expect(step(2)).toBeEnabled();
    expect(step(3)).toBeEnabled();
  });

  it('keeps Adjust and Export closed while a document has no corners', async (): Promise<void> => {
    vi.mocked(detectCorners).mockRejectedValue(new Error('OpenCV failed'));
    vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    const user: UserEvent = userEvent.setup();
    renderApp();

    await uploadImages(user, ['first.jpg']);

    expect(step(1)).toBeEnabled();
    expect(step(2)).toBeDisabled();
    expect(step(3)).toBeDisabled();
  });

  it('continues to Crop, marking Upload as done', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    renderApp();
    await uploadImages(user, ['first.jpg']);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByTestId('crop-step')).toBeInTheDocument();
    expect(step(1)).toHaveAttribute('aria-current', 'step');
    expect(step(0).closest('li')).toHaveClass('is-done');
  });

  it('moves between steps from the top bar', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    renderApp();
    await uploadImages(user, ['first.jpg']);

    await user.click(step(3));
    expect(screen.getByTestId('result-steps')).toBeInTheDocument();
    expect(step(3)).toHaveAttribute('aria-current', 'step');

    await user.click(step(0));
    expect(
      screen.getByRole('heading', { name: 'You uploaded 1 image' }),
    ).toBeInTheDocument();
  });

  it('goes back to the empty state after removing every document', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    renderApp();
    await uploadImages(user, ['first.jpg', 'second.jpg']);

    await user.click(screen.getByRole('button', { name: 'Remove document 1' }));
    expect(
      screen.getByRole('heading', { name: 'You uploaded 1 image' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Document 1' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Remove document 1' }));
    expect(
      screen.getByRole('heading', {
        name: 'Take photos or upload images of your documents',
      }),
    ).toBeInTheDocument();
    expect(step(1)).toBeDisabled();
  });

  it('tells the user when an image cannot be opened', async (): Promise<void> => {
    vi.mocked(sourceFromFile).mockRejectedValue(new Error('not an image'));
    vi.spyOn(console, 'error').mockImplementation((): void => undefined);
    const user: UserEvent = userEvent.setup();
    renderApp();

    await uploadImages(user, ['broken.txt']);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This file could not be opened. Upload a JPG, PNG, or WebP image.',
    );
    expect(
      screen.getByRole('heading', {
        name: 'Take photos or upload images of your documents',
      }),
    ).toBeInTheDocument();
  });

  it('opens the camera over the Upload step and goes back to it', async (): Promise<void> => {
    const denied: DOMException = new DOMException('denied', 'NotAllowedError');
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async (): Promise<MediaStream> =>
          Promise.reject(denied),
        ),
      },
    });
    const user: UserEvent = userEvent.setup();
    renderApp();

    await user.click(screen.getByTestId('upload-camera'));

    expect(screen.getByTestId('shutter')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: 'Take photos or upload images of your documents',
      }),
    ).not.toBeInTheDocument();
    // The top bar keeps showing where the user came from
    expect(step(0)).toHaveAttribute('aria-current', 'step');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Camera access was denied. Allow it in your browser settings and try again.',
    );

    await user.click(
      within(screen.getByRole('main')).getByRole('button', { name: 'Back' }),
    );

    expect(screen.queryByTestId('shutter')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Take photos or upload images of your documents',
      }),
    ).toBeInTheDocument();
  });

  it('closes the camera from the top bar', async (): Promise<void> => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(
          async (): Promise<MediaStream> =>
            new Promise<MediaStream>((): void => undefined),
        ),
      },
    });
    const user: UserEvent = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId('upload-camera'));
    expect(screen.getByTestId('shutter')).toBeInTheDocument();

    await user.click(step(0));

    expect(screen.queryByTestId('shutter')).not.toBeInTheDocument();
    expect(screen.getByTestId('upload-camera')).toBeInTheDocument();
  });
});
