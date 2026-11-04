import { CanvasImageDecoder } from './adapters/decoders/canvas-image-decoder.class';
import { PdfDocumentEncoder } from './adapters/encoders/pdf-document-encoder.class';
import { PngImageEncoder } from './adapters/encoders/png-image-encoder.class';
import { OpenCvCornersDetector } from './adapters/opencv/opencv-corners-detector.class';
import { OpenCvImageCropper } from './adapters/opencv/opencv-image-cropper.class';
import { OpenCvImageResizer } from './adapters/opencv/opencv-image-resizer.class';
import { OpenCvLoader } from './adapters/opencv/opencv-loader.class';
import { createDefaultAdapters, DEFAULT_ADAPTERS } from './default-adapters';
import { createBlankPhoto } from './test-helpers';

describe('DEFAULT_ADAPTERS', (): void => {
  it('has an adapter for each abstraction of the document', (): void => {
    expect(DEFAULT_ADAPTERS.imageDecoder).toBeInstanceOf(CanvasImageDecoder);
    expect(DEFAULT_ADAPTERS.imageResizer).toBeInstanceOf(OpenCvImageResizer);
    expect(DEFAULT_ADAPTERS.imageCropper).toBeInstanceOf(OpenCvImageCropper);
    expect(DEFAULT_ADAPTERS.cornersDetector).toBeInstanceOf(
      OpenCvCornersDetector,
    );
    expect(DEFAULT_ADAPTERS.imageEncoder).toBeInstanceOf(PngImageEncoder);
    expect(DEFAULT_ADAPTERS.pdfEncoder).toBeInstanceOf(PdfDocumentEncoder);
  });

  it('gives the OpenCV options to the adapters', async (): Promise<void> => {
    const load: jest.SpyInstance = jest.spyOn(OpenCvLoader, 'load');

    await createDefaultAdapters({
      scriptUrl: '/opencv.js',
    }).imageResizer.resize(createBlankPhoto(60, 40), { width: 30, height: 20 });

    expect(load).toHaveBeenCalledWith({ scriptUrl: '/opencv.js' });
    load.mockRestore();
  });
});
