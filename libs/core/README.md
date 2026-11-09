![Logo](https://s3.devantage.com.br/devantage-public/logo-100x100.png)

# DocScanify

Detect, crop and correct the perspective of documents in images on Node.js and browsers, and output them as images or PDFs.

It works like a "CamScanner" app: give it a photo of a document and get back only the document, straightened, with an optional black and white or grayscale filter. It has no install scripts and needs no system libraries, so it also works in environments that install packages with `--ignore-scripts`.

[Installation](#installation)  
[Usage](#usage)  
[API](#api)  
[Architecture](#architecture)  
[Adapters](#adapters)  
[Browsers](#browsers)  
[How detection works](#how-detection-works)  
[License](#license)

## Installation

```bash
npm install @devantage/docscanify
```

Requires Node.js 20 or later. The native module, [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas), ships prebuilt binaries for Linux (including Alpine), macOS and Windows.

## Usage

```ts
import { readFileSync, writeFileSync } from 'node:fs';

import { DEFAULT_ADAPTERS, OpenCvBlackAndWhiteFilter, ScannedDocument } from '@devantage/docscanify';

const document = await ScannedDocument.fromImage(readFileSync('photo.jpg'), DEFAULT_ADAPTERS);

await document.detectCorners();
document.applyFilter(new OpenCvBlackAndWhiteFilter());

// PNG preview, before exporting
const preview = await document.render();

// A4 PDF
const pdf = await document.toPdf();

writeFileSync('document.pdf', pdf.file.buffer);

// PNG image
const image = await document.toImage();

writeFileSync(`document.${image.file.fileExtension}`, image.file.buffer);
```

## API

`ScannedDocument` works only with PNG buffers and abstractions: everything that touches pixels is done by an [adapter](#adapters). Its state is private: tell it what to do and take the final output from it.

### Creating a document

#### `ScannedDocument.fromImage(buffer, adapters, options?)`

Creates a document from an image file (`Uint8Array` or `Buffer`). The file is decoded to PNG, and the document always works on PNG buffers, to keep the maximum quality while processing it. The original file is kept as it was received. Until `detectCorners` is called or `corners` is set, the document is the whole image.

What it accepts is up to the `imageDecoder` adapter. The default one, `CanvasImageDecoder`, reads what the canvas can read: PNG, JPEG, WebP, AVIF, GIF, BMP, ICO and SVG on Node.js, and what the browser can read on browsers. TIFF and HEIC need your own decoder on Node.js.

| Option          | Default | Description                                                                                                         |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `name`          | `null`  | Name of the original file, kept in `originalFile`                                                                   |
| `maxDimension`  | `3000`  | Longest side (px) of the image before processing                                                                    |
| `onNotDetected` | `error` | `error` makes `detectCorners` reject if no document is detected. `original` uses the whole image, resized if needed |

### Changing a document

The document only keeps what was asked for: the corners, the enhancers and the filter. Nothing is cropped, enhanced or filtered until you call `render`, `toImage` or `toPdf`, and each of these calls does the work again, always in the same order: the image (the original file decoded to PNG and limited to `maxDimension`), the crop if there are corners, the enhancers, and the filter if there is one. The buffer of the original file never changes.

#### `document.detectCorners(cornersDetector?)`

Finds the document and keeps its corners. By default it uses the `cornersDetector` adapter of the document. It rejects corners that do not form a quadrilateral or are outside of the image.

#### `document.applyEnhancements(enhancers)`

Keeps what improves the cropped document before the filter, replacing the current enhancers. They run in the given order, and an empty list removes them. Like the filter, they only run when rendering or exporting, so that is when a failure of one of them shows up.

```ts
document.applyEnhancements([new OpenCvNoiseReductionEnhancer(), new OpenCvSharpnessEnhancer({ level: 'soft' }), new OpenCvRotationEnhancer({ quarterTurns: 1 })]);
```

| Enhancer                       | Options                                                             | Description                                                    |
| ------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| `OpenCvNoiseReductionEnhancer` |                                                                     | Smooths the noise, preserving the edges of the text            |
| `OpenCvSharpnessEnhancer`      | `level`: `soft` (default) or `strong`                               | Sharpens the image                                             |
| `OpenCvRotationEnhancer`       | `quarterTurns`: clockwise if positive, counterclockwise if negative | Rotates the image. `report.corners` stay in the original image |

#### `document.applyFilter(filter)`

Keeps the filter of the cropped document, replacing the current one. `null` removes it. The filter only runs when rendering or exporting, so that is when a failure of it shows up: `render`, `toImage` and `toPdf` reject until the filter is replaced.

#### `document.corners`

Keeps the corners to crop the document from, for example to let a user correct the detection. The corners are in pixels of the original image. `null` goes back to the whole image. They must form a quadrilateral inside of the image, otherwise it throws an error. Reading it gives the corners set or found by `detectCorners`, also in pixels of the original image, or `null` if the document is the whole image.

### Getting the output

| Method                            | Returns                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `document.toPdf(pdfEncoder?)`     | A promise of the exported PDF. By default, uses the `pdfEncoder` adapter          |
| `document.toImage(imageEncoder?)` | A promise of the exported image. By default, uses the `imageEncoder` adapter      |
| `document.render()`               | A promise of the document as a PNG (`Uint8Array`), to preview it before exporting |
| `document.toOriginalBuffer()`     | A copy of the original file, as a `Uint8Array`                                    |

`toPdf` and `toImage` use what was asked for up to the moment they are called, and resolve the exported `file` and the `report` of the document:

```ts
const { file, report } = await document.toPdf();
```

| `file` property | Description                        |
| --------------- | ---------------------------------- |
| `buffer`        | The exported file (`Uint8Array`)   |
| `mimeType`      | The `mimeType` of the encoder      |
| `fileExtension` | The `fileExtension` of the encoder |

| `report` property | Description                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corners`         | `topLeft`, `topRight`, `bottomLeft` and `bottomRight` the document was cropped from, in pixels of the original image, or `null` if it was not cropped |
| `dimensions`      | `width` and `height` of the document, whatever the encoder does to it                                                                                 |
| `originalFile`    | `name`, `mimeType`, `dimensions` (`width` and `height`, in pixels) and `size` (in bytes) of the original file                                         |

### Scanning in a single call

`DocumentScanner` is a ready-made recipe over `ScannedDocument`, for when the steps do not need to be controlled one by one: it detects the document, applies the enhancers and the filter chosen by name, and exports it. It is what the [n8n node](https://github.com/devantage/docscanify/tree/main/libs/n8n-nodes) and the [MCP server](https://github.com/devantage/docscanify/tree/main/apps/mcp) use.

```ts
import { DocumentScanner } from '@devantage/docscanify';

const { file, report } = await new DocumentScanner().scan(readFileSync('photo.jpg'), {
  outputFormat: 'image',
  filter: 'bw',
  rotation: 90,
});
```

`new DocumentScanner(adapters?, openCvOptions?)` uses `DEFAULT_ADAPTERS` by default. `openCvOptions` goes to the enhancers and filters it creates: on browsers, it must have the `scriptUrl`. `scan(buffer, options?)` resolves the same `{ file, report }` as `toPdf` and `toImage`, and rejects if no document is detected, unless `onNotDetected` is `original`.

| Option           | Default | Description                                                                                |
| ---------------- | ------- | ------------------------------------------------------------------------------------------ |
| `name`           |         | Name of the original file, kept in `report.originalFile`                                   |
| `outputFormat`   | `pdf`   | `pdf` or `image`                                                                           |
| `filter`         | `none`  | `none`, `grayscale` or `bw` (black and white)                                              |
| `noiseReduction` | `false` | Smooths the noise, preserving the edges of the text                                        |
| `sharpness`      | `off`   | `off`, `soft` or `strong`                                                                  |
| `rotation`       | `0`     | Clockwise, in degrees: `0`, `90`, `180` or `270`                                           |
| `pageSize`       | `a4`    | PDF only. `a4`, `letter` or `image`                                                        |
| `margin`         | `0`     | PDF only. Page margin in points                                                            |
| `maxDimension`   | `3000`  | Longest side (px) of the image before processing                                           |
| `jpegQuality`    | `85`    | Quality of the JPEG image. The `bw` filter is encoded as a PNG, which keeps the text sharp |
| `onNotDetected`  | `error` | `error` or `original` (uses the whole image)                                               |

The enhancers run in the order noise, sharpness, rotation, and PDFs embed the image the same way as the `image` output.

## Architecture

```text
src/
  domain/               Depends on nothing outside of itself
    entities/           ScannedDocument
    services/           CornersValidator, DocumentIngestion
    value-objects/      CornersPerimeter, FileContent, ImageScale
    ports/              The interfaces the document depends on
    models/             The data it receives and returns
  adapters/             Implement the ports, and depend only on the domain
    canvas/             Canvas helpers, for Node.js and browsers
    decoders/           CanvasImageDecoder
    encoders/           PNG, JPEG and PDF
    opencv/             Detection, cropping, resizing, enhancers and filters
  default-adapters.ts   The adapters of this package, ready to use
  document-scanner.class.ts   DocumentScanner, a ready-made recipe over the document
```

## Adapters

The document depends only on interfaces, and each one is implemented by an adapter. `DEFAULT_ADAPTERS` has the ones of this package, and any of them can be replaced:

```ts
const document = await ScannedDocument.fromImage(buffer, {
  ...DEFAULT_ADAPTERS,
  cornersDetector: new MyCornersDetector(),
});
```

Every adapter receives a copy of a buffer, always a PNG unless stated otherwise, and is responsible for whatever it needs to do with it, such as decoding it to a canvas. Unless stated otherwise, it must return a PNG, and the document rejects anything else.

| Interface         | Method                              | Returns                                            | Implementations                                                                     |
| ----------------- | ----------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ImageDecoder`    | `decode(buffer)`                    | The image as a PNG, and the `mimeType` of the file | `CanvasImageDecoder`                                                                |
| `ImageResizer`    | `resize(buffer, { width, height })` | The resized image                                  | `OpenCvImageResizer`                                                                |
| `CornersDetector` | `detect(buffer)`                    | The corners in the image, or `null`                | `OpenCvCornersDetector`                                                             |
| `ImageCropper`    | `crop(buffer, corners)`             | The cropped document, in its corrected perspective | `OpenCvImageCropper`                                                                |
| `ImageEnhancer`   | `enhance(buffer)`                   | The enhanced document                              | `OpenCvNoiseReductionEnhancer`, `OpenCvSharpnessEnhancer`, `OpenCvRotationEnhancer` |
| `ImageFilter`     | `filter(buffer)`                    | The filtered document                              | `OpenCvBlackAndWhiteFilter`, `OpenCvGrayscaleFilter`                                |
| `ImageEncoder`    | `encode(buffer)`                    | The exported image, in any format                  | `PngImageEncoder`, `JpegImageEncoder`                                               |
| `PdfEncoder`      | `encode(buffer)`                    | The exported PDF                                   | `PdfDocumentEncoder`                                                                |

`ImageDecoder` receives the file as it came, and resolves the image as a PNG (`png`) and the `mimeType` of the received file (`originalMimeType`), which goes to `originalFile`. `CanvasImageDecoder` decodes every file, even a PNG, and recognizes its `mimeType` by its first bytes, or uses `application/octet-stream` if it does not know them.

```ts
import type { CornersDetector, Corners } from '@devantage/docscanify';

class MyCornersDetector implements CornersDetector {
  public async detect(buffer: Uint8Array): Promise<Corners | null> {
    return callMyModel(buffer);
  }
}
```

`detect` receives the image after `maxDimension`, and resolves the corners in the coordinate system of that image.

### Encoders

An encoder declares the `mimeType` and the `fileExtension` of the file it exports, which become the ones of the output:

```ts
import type { ImageEncoder } from '@devantage/docscanify';

class WebpEncoder implements ImageEncoder {
  public readonly mimeType: string = 'image/webp';

  public readonly fileExtension: string = 'webp';

  public async encode(buffer: Uint8Array): Promise<Uint8Array> {
    return convertToWebp(buffer);
  }
}

const image = await document.toImage(new WebpEncoder());
```

`JpegImageEncoder` accepts `{ quality }`, limited to 1 to 100 (default 85). `PdfDocumentEncoder` accepts:

| Option         | Default           | Description                                                                                  |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `pageFormat`   | `a4`              | `a4`, `letter` or `image` (page sized to the image)                                          |
| `margin`       | `0`               | Page margin in points. It must leave room for the image                                      |
| `imageDpi`     | `150`             | Resolution used to size the page when `pageFormat` is `image`                                |
| `imageEncoder` | `PngImageEncoder` | Encodes the image embedded in the PDF, to a JPEG or a PNG. A JPEG is much smaller for photos |

```ts
const pdf = await document.toPdf(
  new PdfDocumentEncoder({
    pageFormat: 'letter',
    imageEncoder: new JpegImageEncoder({ quality: 85 }),
  }),
);
```

## Browsers

The package also works on browsers. Your bundler must support the `browser` field of `package.json` (Vite, webpack and esbuild do), which keeps the Node.js-only dependencies out of the bundle.

OpenCV.js has about 9 MB, so it is loaded from a script tag instead of being bundled. Serve `@techstark/opencv-js/dist/opencv.js` with your static files and give its URL to the adapters:

```ts
import { createDefaultAdapters, OpenCvBlackAndWhiteFilter, ScannedDocument } from '@devantage/docscanify';

const scriptUrl = '/opencv.js';

const document = await ScannedDocument.fromImage(new Uint8Array(await file.arrayBuffer()), createDefaultAdapters({ scriptUrl }));

await document.detectCorners();
document.applyFilter(new OpenCvBlackAndWhiteFilter({ scriptUrl }));

const pdf = await document.toPdf();
```

Filters and enhancers are created outside of the document, so they also need to receive the URL.

## How detection works

Detection based only on the largest contour fails on textured backgrounds (granite, wood, fabric), because the document outline blends into the texture. So `OpenCvCornersDetector`:

1. shrinks the image to about 800 px
2. uses morphological closing and opening to erase the document's text and the background texture
3. generates candidates from three masks (Otsu, inverted Otsu and Canny)
4. accepts only convex quadrilaterals and scores each one by the fraction of its perimeter that lies on real edges
5. picks the largest well-supported quadrilateral

Detection works best with the document on a contrasting background and all 4 edges visible. To diagnose a result, give `OpenCvCornersDetector` an `onCandidates` callback, which receives the quadrilaterals considered and their scores, in the coordinates of the image:

```ts
const cornersDetector = new OpenCvCornersDetector({
  onCandidates: (candidates) => console.log(candidates),
});
```

It falls back to the largest contour when no quadrilateral is well supported. On Node.js, OpenCV.js is loaded on the first use (about 1 s) and reused afterwards.

## License

This package is licensed under [MIT](LICENSE.md) terms.
