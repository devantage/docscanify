import { type ChangeEvent, type JSX, type RefObject, useRef } from 'react';

interface Options {
  /** Called with the chosen images, in the order received. */
  onFiles(files: File[]): void;
  /** Called by `takePhoto` when the browser gives access to the camera. */
  onCamera(): void;
}

/** Without getUserMedia (e.g. plain HTTP on a phone), the camera only works through the file picker. */
const canUseCamera = (): boolean => {
  // `mediaDevices` is undefined outside secure contexts (plain HTTP), which the DOM types don't model
  const mediaNavigator: { mediaDevices?: MediaDevices } = navigator;
  return !!mediaNavigator.mediaDevices?.getUserMedia;
};

/** What `useImagePicker` returns. */
export interface UseImagePickerResult {
  /** Opens the in-app camera, or the native camera through the file picker. */
  takePhoto(): void;
  /** Opens the file picker. */
  chooseFiles(): void;
  /** Hidden file input that both use; render it once. */
  fileInput: JSX.Element;
}

/**
 * The two ways of adding images: taking photos or choosing files.
 *
 * @returns
 * - `takePhoto()`: opens the in-app camera, or the native camera through the file picker when the
 *   browser does not give camera access.
 * - `chooseFiles()`: opens the file picker.
 * - `fileInput`: hidden file input that both use; render it once.
 */
export function useImagePicker({
  onFiles,
  onCamera,
}: Options): UseImagePickerResult {
  const inputRef: RefObject<HTMLInputElement | null> =
    useRef<HTMLInputElement>(null);
  const cameraAvailable: boolean = canUseCamera();

  const chooseFiles = (): void => {
    inputRef.current?.click();
  };
  const takePhoto = (): void => {
    cameraAvailable ? onCamera() : chooseFiles();
  };

  const fileInput: JSX.Element = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      // The `capture` attribute makes the file picker offer the native camera
      {...(cameraAvailable ? {} : { capture: 'environment' })}
      hidden
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) onFiles(Array.from(e.target.files));
        e.target.value = '';
      }}
      data-testid="file-input"
    />
  );

  return { takePhoto, chooseFiles, fileInput };
}
