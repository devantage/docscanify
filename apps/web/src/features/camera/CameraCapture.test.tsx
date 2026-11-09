import { act, render, screen } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import {
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  type MockInstance,
  vi,
} from 'vitest';

import { ToastProvider } from '@/components/toast';
import { TranslateProvider } from '@/i18n';
import { frameFromVideo } from '@/lib/image';

import { CameraCapture } from './CameraCapture';
import {
  type CameraError,
  useCameraStream,
  useGuideBox,
} from './useCameraStream';

vi.mock('./useCameraStream', () => ({
  useCameraStream: vi.fn(),
  useGuideBox: vi.fn(() => null),
}));

vi.mock('@/lib/image', () => ({
  fileStamp: vi.fn(() => '202611060930'),
  frameFromVideo: vi.fn(),
}));

interface StreamState {
  ready: boolean;
  error: CameraError | null;
  stop: Mock<() => void>;
}

/**
 * Makes the mocked {@link useCameraStream} return this state: ready and without error unless
 * given otherwise.
 *
 * @returns The state, with its `stop` spy.
 */
function mockStream(
  state: Partial<Omit<StreamState, 'stop'>> = {},
): StreamState {
  const stream: StreamState = {
    ready: state.ready ?? true,
    error: state.error ?? null,
    stop: vi.fn<() => void>(),
  };
  vi.mocked(useCameraStream).mockReturnValue(stream);
  return stream;
}

interface Rendered {
  onDone: Mock<(photos: File[]) => void>;
  onCancel: Mock<() => void>;
}

/** Renders the camera with spy callbacks, inside the translation and toast providers. */
function renderCamera(): Rendered {
  const onDone: Mock<(photos: File[]) => void> =
    vi.fn<(photos: File[]) => void>();
  const onCancel: Mock<() => void> = vi.fn<() => void>();
  render(
    <TranslateProvider>
      <ToastProvider>
        <CameraCapture onDone={onDone} onCancel={onCancel} />
      </ToastProvider>
    </TranslateProvider>,
  );
  return { onDone, onCancel };
}

/** Each frame becomes a distinct PNG photo named after the requested name. */
function framesAsPhotos(): void {
  vi.mocked(frameFromVideo).mockImplementation(
    async (_video: HTMLVideoElement, name: string): Promise<File> =>
      Promise.resolve(new File(['png'], `${name}.png`, { type: 'image/png' })),
  );
}

describe('CameraCapture', (): void => {
  let createObjectURL: MockInstance<(obj: Blob | MediaSource) => string>;
  let revokeObjectURL: MockInstance<(url: string) => void>;

  beforeEach((): void => {
    let next: number = 0;
    createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((): string => `blob:photo-${++next}`);
    revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation((): void => undefined);
    framesAsPhotos();
  });

  describe('before any photo', (): void => {
    it('asks to frame the document, with Done disabled', (): void => {
      mockStream();
      renderCamera();

      expect(screen.getByRole('status')).toHaveTextContent(
        'Frame the document',
      );
      const done: HTMLElement = screen.getByTestId('camera-done');
      expect(done).toBeDisabled();
      expect(done).toHaveAccessibleName('Done');
      expect(screen.getByTestId('shutter')).toBeEnabled();
      expect(screen.getByTestId('shutter')).toHaveAccessibleName('Take photo');
    });

    it('disables the shutter and hides the hint until the video plays', (): void => {
      mockStream({ ready: false });
      renderCamera();

      expect(screen.getByTestId('shutter')).toBeDisabled();
      expect(screen.queryByText('Frame the document')).not.toBeInTheDocument();
    });
  });

  describe('taking photos', (): void => {
    it('keeps a frame of the video per shot and counts them', async (): Promise<void> => {
      mockStream();
      const user: UserEvent = userEvent.setup();
      renderCamera();

      await user.click(screen.getByTestId('shutter'));

      expect(frameFromVideo).toHaveBeenCalledTimes(1);
      expect(frameFromVideo).toHaveBeenCalledWith(
        screen.getByTestId('camera-video'),
        'document-202611060930-1',
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        '1 photo · take the next one or finish',
      );
      const done: HTMLElement = screen.getByTestId('camera-done');
      expect(done).toBeEnabled();
      expect(done).toHaveAccessibleName('Done with 1 photo');
      expect(done.querySelector('.camera-done-count')).toHaveTextContent(/^1$/);
      expect(done.querySelector('img')).toHaveAttribute('src', 'blob:photo-1');
    });

    it('stays open for the next photo and numbers it in sequence', async (): Promise<void> => {
      mockStream();
      const user: UserEvent = userEvent.setup();
      renderCamera();

      await user.click(screen.getByTestId('shutter'));
      await user.click(screen.getByTestId('shutter'));

      expect(vi.mocked(frameFromVideo).mock.calls[1][1]).toBe(
        'document-202611060930-2',
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        '2 photos · take the next one or finish',
      );
      const done: HTMLElement = screen.getByTestId('camera-done');
      expect(done).toHaveAccessibleName('Done with 2 photos');
      expect(done.querySelector('.camera-done-count')).toHaveTextContent(/^2$/);
      // The thumbnail shows the last photo and the previous one is released
      expect(done.querySelector('img')).toHaveAttribute('src', 'blob:photo-2');
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
      expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:photo-2');
    });

    it('ignores the shutter while a photo is being taken', async (): Promise<void> => {
      mockStream();
      let finish: (photo: File) => void = (): void => undefined;
      vi.mocked(frameFromVideo).mockImplementationOnce(
        async (): Promise<File> =>
          new Promise<File>((resolve: (photo: File) => void): void => {
            finish = resolve;
          }),
      );
      const user: UserEvent = userEvent.setup();
      renderCamera();

      await user.click(screen.getByTestId('shutter'));
      expect(screen.getByTestId('shutter')).toBeDisabled();
      await user.click(screen.getByTestId('shutter'));

      expect(frameFromVideo).toHaveBeenCalledTimes(1);

      await act(async (): Promise<void> => {
        finish(new File(['png'], 'photo.png', { type: 'image/png' }));
        await Promise.resolve();
      });
      expect(screen.getByTestId('shutter')).toBeEnabled();
      expect(screen.getByTestId('camera-done')).toHaveAccessibleName(
        'Done with 1 photo',
      );
    });

    it('releases the last thumbnail when leaving the camera', async (): Promise<void> => {
      mockStream();
      const user: UserEvent = userEvent.setup();
      const { unmount } = render(
        <TranslateProvider>
          <ToastProvider>
            <CameraCapture onDone={vi.fn()} onCancel={vi.fn()} />
          </ToastProvider>
        </TranslateProvider>,
      );
      await user.click(screen.getByTestId('shutter'));
      expect(createObjectURL).toHaveBeenCalledTimes(1);

      unmount();

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
    });
  });

  describe('finishing', (): void => {
    it('turns the camera off and hands over the photos in the order taken', async (): Promise<void> => {
      const stream: StreamState = mockStream();
      const user: UserEvent = userEvent.setup();
      const { onDone, onCancel } = renderCamera();

      await user.click(screen.getByTestId('shutter'));
      await user.click(screen.getByTestId('shutter'));
      await user.click(screen.getByTestId('shutter'));
      await user.click(screen.getByTestId('camera-done'));

      expect(stream.stop).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledTimes(1);
      const photos: File[] = onDone.mock.calls[0][0];
      expect(photos.map((photo: File) => photo.name)).toEqual([
        'document-202611060930-1.png',
        'document-202611060930-2.png',
        'document-202611060930-3.png',
      ]);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('does nothing on Done without photos', async (): Promise<void> => {
      const stream: StreamState = mockStream();
      const user: UserEvent = userEvent.setup();
      const { onDone } = renderCamera();

      await user.click(screen.getByTestId('camera-done'));

      expect(onDone).not.toHaveBeenCalled();
      expect(stream.stop).not.toHaveBeenCalled();
    });

    it('goes back without handing over the photos', async (): Promise<void> => {
      mockStream();
      const user: UserEvent = userEvent.setup();
      const { onDone, onCancel } = renderCamera();

      await user.click(screen.getByTestId('shutter'));
      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onDone).not.toHaveBeenCalled();
    });
  });

  describe('errors', (): void => {
    it.each<[CameraError, string]>([
      [
        'unsupported',
        'The camera is not available. Use "Upload images" instead',
      ],
      [
        'denied',
        'Camera access was denied. Allow it in your browser settings and try again.',
      ],
      ['notFound', 'No camera found on this device.'],
      ['unknown', 'The camera could not be opened.'],
    ])(
      'shows the %s error as an error toast',
      (error: CameraError, message: string): void => {
        mockStream({ ready: false, error });
        renderCamera();

        const alert: HTMLElement = screen.getByRole('alert');
        expect(alert).toHaveTextContent(message);
        expect(alert).toHaveAttribute('data-kind', 'error');
        expect(screen.getAllByTestId('toast')).toHaveLength(1);
        expect(screen.getByTestId('shutter')).toBeDisabled();
      },
    );

    it('hides the framing hint when the camera fails after playing', (): void => {
      mockStream({ ready: true, error: 'unknown' });
      renderCamera();

      expect(screen.queryByText('Frame the document')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The camera could not be opened.',
      );
    });

    it('replaces the error message when the error changes, instead of stacking another', (): void => {
      mockStream({ ready: false, error: 'denied' });
      const { rerender } = render(
        <TranslateProvider>
          <ToastProvider>
            <CameraCapture onDone={vi.fn()} onCancel={vi.fn()} />
          </ToastProvider>
        </TranslateProvider>,
      );

      mockStream({ ready: false, error: 'unknown' });
      rerender(
        <TranslateProvider>
          <ToastProvider>
            <CameraCapture onDone={vi.fn()} onCancel={vi.fn()} />
          </ToastProvider>
        </TranslateProvider>,
      );

      expect(screen.getAllByTestId('toast')).toHaveLength(1);
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The camera could not be opened.',
      );
    });

    it('shows the framing marks while the camera works', (): void => {
      vi.mocked(useGuideBox).mockReturnValue({ left: 10, top: 10 });
      mockStream({ ready: true });
      const { container } = render(
        <TranslateProvider>
          <ToastProvider>
            <CameraCapture onDone={vi.fn()} onCancel={vi.fn()} />
          </ToastProvider>
        </TranslateProvider>,
      );

      expect(container.querySelector('.camera-guide')).toHaveStyle({
        left: '10px',
        top: '10px',
      });
    });

    it('hides the framing marks when the camera fails after playing', (): void => {
      vi.mocked(useGuideBox).mockReturnValue({ left: 10, top: 10 });
      mockStream({ ready: true, error: 'unknown' });
      const { container } = render(
        <TranslateProvider>
          <ToastProvider>
            <CameraCapture onDone={vi.fn()} onCancel={vi.fn()} />
          </ToastProvider>
        </TranslateProvider>,
      );

      expect(container.querySelector('.camera-guide')).toBeNull();
    });

    it('shows no toast while the camera works', (): void => {
      mockStream();
      renderCamera();

      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    });
  });
});
