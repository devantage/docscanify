import { fireEvent, render, screen } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TranslateProvider } from '@/i18n';

import { EmptyState } from './EmptyState';

interface Rendered {
  onFiles: Mock<(files: File[]) => void>;
  onCamera: Mock<() => void>;
  container: HTMLElement;
}

function renderEmptyState(over: boolean = false): Rendered {
  const onFiles: Mock<(files: File[]) => void> =
    vi.fn<(files: File[]) => void>();
  const onCamera: Mock<() => void> = vi.fn<() => void>();
  const { container } = render(
    <TranslateProvider>
      <EmptyState over={over} onFiles={onFiles} onCamera={onCamera} />
    </TranslateProvider>,
  );
  return { onFiles, onCamera, container };
}

function grantCamera(): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn() },
  });
}

function imageFile(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' });
}

describe('EmptyState', (): void => {
  afterEach((): void => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('invites the user to take photos or upload images', (): void => {
    renderEmptyState();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Take photos or upload images of your documents',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Upload one or more images of the documents you want to scan.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('upload-camera')).toHaveTextContent('Take photo');
    expect(screen.getByTestId('upload-files')).toHaveTextContent(
      'Upload images',
    );
    expect(screen.getByText('or drag the images here')).toBeInTheDocument();
  });

  it('tells the user the images never leave the device', (): void => {
    const { container } = renderEmptyState();

    expect(container.querySelector('.upload-privacy')).toHaveTextContent(
      'Images are processed on your device and are never sent to a server.',
    );
  });

  it('highlights the card while images are dragged over the screen', (): void => {
    const { container } = renderEmptyState(true);

    expect(container.querySelector('.add-card')).toHaveClass('is-over');
  });

  it('does not highlight the card otherwise', (): void => {
    const { container } = renderEmptyState(false);

    expect(container.querySelector('.add-card')).not.toHaveClass('is-over');
  });

  it('opens the file picker for multiple images and passes them in order', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const { onFiles, onCamera } = renderEmptyState();
    const input: HTMLInputElement = screen.getByTestId('file-input');
    const click: Mock<() => void> = vi.fn<() => void>();
    input.addEventListener('click', click);

    await user.click(screen.getByRole('button', { name: 'Upload images' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input.multiple).toBe(true);

    const files: File[] = [imageFile('first.jpg'), imageFile('second.jpg')];
    await user.upload(input, files);

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles).toHaveBeenCalledWith(files);
    expect(onCamera).not.toHaveBeenCalled();
  });

  it('opens the file picker, not the camera, from Upload images even with camera access', async (): Promise<void> => {
    grantCamera();
    const user: UserEvent = userEvent.setup();
    const { onCamera } = renderEmptyState();
    const input: HTMLInputElement = screen.getByTestId('file-input');
    const click: Mock<() => void> = vi.fn<() => void>();
    input.addEventListener('click', click);

    await user.click(screen.getByRole('button', { name: 'Upload images' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(onCamera).not.toHaveBeenCalled();
  });

  // Known bug: without camera access, the file input always carries capture="environment", so on
  // phones "Upload images" opens the native camera too and images cannot be picked from the
  // gallery (the README only expects "Take photo" to open the native camera)
  it.fails(
    'opens the file picker without the camera hint from Upload images, without camera access',
    async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderEmptyState();
      const input: HTMLInputElement = screen.getByTestId('file-input');
      let captureOnOpen: string | null = 'not opened';
      input.addEventListener('click', (): void => {
        captureOnOpen = input.getAttribute('capture');
      });

      await user.click(screen.getByRole('button', { name: 'Upload images' }));

      expect(captureOnOpen).toBeNull();
    },
  );

  it('clears the input after a choice, so the same image can be chosen again', (): void => {
    const { onFiles } = renderEmptyState();
    const input: HTMLInputElement = screen.getByTestId('file-input');
    const file: File = imageFile('same.jpg');

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(input.value).toBe('');
  });

  it('opens the in-app camera when the browser gives camera access', async (): Promise<void> => {
    grantCamera();
    const user: UserEvent = userEvent.setup();
    const { onCamera } = renderEmptyState();
    const input: HTMLInputElement = screen.getByTestId('file-input');
    const click: Mock<() => void> = vi.fn<() => void>();
    input.addEventListener('click', click);

    await user.click(screen.getByRole('button', { name: 'Take photo' }));

    expect(onCamera).toHaveBeenCalledTimes(1);
    expect(click).not.toHaveBeenCalled();
    expect(input).not.toHaveAttribute('capture');
  });

  it('opens the native camera through the file picker without camera access', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const { onCamera } = renderEmptyState();
    const input: HTMLInputElement = screen.getByTestId('file-input');
    const click: Mock<() => void> = vi.fn<() => void>();
    input.addEventListener('click', click);

    await user.click(screen.getByRole('button', { name: 'Take photo' }));

    expect(onCamera).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute('capture', 'environment');
  });
});
