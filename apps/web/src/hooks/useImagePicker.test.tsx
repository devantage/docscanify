import { fireEvent, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { JSX } from 'react';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { useImagePicker } from './useImagePicker';

/** Renders the hook's input and buttons for its two actions. */
function Picker({
  onFiles,
  onCamera,
}: {
  onFiles(files: File[]): void;
  onCamera(): void;
}): JSX.Element {
  const { takePhoto, chooseFiles, fileInput } = useImagePicker({
    onFiles,
    onCamera,
  });
  return (
    <>
      <button type="button" onClick={takePhoto}>
        Take photo
      </button>
      <button type="button" onClick={chooseFiles}>
        Upload
      </button>
      {fileInput}
    </>
  );
}

/** Makes `navigator.mediaDevices` what a browser would have, or removes it. */
function setMediaDevices(value: Partial<MediaDevices> | undefined): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value,
  });
}

afterEach((): void => {
  // jsdom has no mediaDevices of its own
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

/** The hidden file input that the hook renders. */
const input = (): HTMLInputElement =>
  screen.getByTestId<HTMLInputElement>('file-input');

/** A tiny JPEG file with the given name. */
const image = (name: string): File =>
  new File(['x'], name, { type: 'image/jpeg' });

/** Renders the picker, counting the clicks that open the file picker. */
function renderPicker(): {
  onFiles: Mock<(files: File[]) => void>;
  onCamera: Mock<() => void>;
  pickerOpens: Mock<() => void>;
} {
  const onFiles: Mock<(files: File[]) => void> = vi.fn();
  const onCamera: Mock<() => void> = vi.fn();
  const pickerOpens: Mock<() => void> = vi.fn();
  render(<Picker onFiles={onFiles} onCamera={onCamera} />);
  // Clicking the file input is what opens the browser's file dialog
  input().addEventListener('click', (): void => {
    pickerOpens();
  });
  return { onFiles, onCamera, pickerOpens };
}

describe('useImagePicker', (): void => {
  it('renders a hidden input that accepts several images', (): void => {
    renderPicker();

    const el: HTMLInputElement = input();
    expect(el.type).toBe('file');
    expect(el).toHaveAttribute('accept', 'image/*');
    expect(el.multiple).toBe(true);
    expect(el.hidden).toBe(true);
  });

  it('opens the file picker with chooseFiles', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const { pickerOpens, onCamera } = renderPicker();

    await user.click(screen.getByRole('button', { name: 'Upload' }));
    expect(pickerOpens).toHaveBeenCalledTimes(1);
    expect(onCamera).not.toHaveBeenCalled();
  });

  describe('with camera access (getUserMedia)', (): void => {
    it('opens the in-app camera with takePhoto, not the file picker', async (): Promise<void> => {
      setMediaDevices({ getUserMedia: vi.fn() });
      const user: UserEvent = userEvent.setup();
      const { pickerOpens, onCamera } = renderPicker();

      await user.click(screen.getByRole('button', { name: 'Take photo' }));
      expect(onCamera).toHaveBeenCalledTimes(1);
      expect(pickerOpens).not.toHaveBeenCalled();
    });

    it('does not ask the file picker for the native camera', (): void => {
      setMediaDevices({ getUserMedia: vi.fn() });
      renderPicker();

      expect(input()).not.toHaveAttribute('capture');
    });
  });

  describe.each([
    ['without navigator.mediaDevices (plain HTTP)', undefined],
    ['with mediaDevices but no getUserMedia', {}],
  ])(
    '%s',
    (_case: string, mediaDevices: Partial<MediaDevices> | undefined): void => {
      it('opens the file picker with takePhoto instead of the camera', async (): Promise<void> => {
        setMediaDevices(mediaDevices);
        const user: UserEvent = userEvent.setup();
        const { pickerOpens, onCamera } = renderPicker();

        await user.click(screen.getByRole('button', { name: 'Take photo' }));
        expect(pickerOpens).toHaveBeenCalledTimes(1);
        expect(onCamera).not.toHaveBeenCalled();
      });

      it('asks the file picker for the rear native camera', (): void => {
        setMediaDevices(mediaDevices);
        renderPicker();

        expect(input()).toHaveAttribute('capture', 'environment');
      });
    },
  );

  it('passes the chosen images in order, then clears the input so the same files can be chosen again', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const { onFiles } = renderPicker();
    const files: File[] = [image('2.jpg'), image('1.jpg')];

    await user.upload(input(), files);
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0].map((f: File) => f.name)).toEqual([
      '2.jpg',
      '1.jpg',
    ]);
    expect(input().value).toBe('');

    await user.upload(input(), files);
    expect(onFiles).toHaveBeenCalledTimes(2);
  });

  it('does not call onFiles when the picker is closed without a choice', (): void => {
    const { onFiles } = renderPicker();

    fireEvent.change(input(), { target: { files: [] } });
    expect(onFiles).not.toHaveBeenCalled();
  });
});
