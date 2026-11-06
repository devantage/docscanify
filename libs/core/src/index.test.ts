import * as docscanify from './index';

describe('public API', (): void => {
  it('exports the document, its default adapters and the OpenCV loader', (): void => {
    expect(Object.keys(docscanify).sort()).toEqual([
      'CanvasImageDecoder',
      'DEFAULT_ADAPTERS',
      'JpegImageEncoder',
      'OpenCvBlackAndWhiteFilter',
      'OpenCvCornersDetector',
      'OpenCvGrayscaleFilter',
      'OpenCvImageCropper',
      'OpenCvImageResizer',
      'OpenCvNoiseReductionEnhancer',
      'OpenCvRotationEnhancer',
      'OpenCvSharpnessEnhancer',
      'PdfDocumentEncoder',
      'PngImageEncoder',
      'ScannedDocument',
      'createDefaultAdapters',
    ]);
  });
});
