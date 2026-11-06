![Logo](https://s3.devantage.com.br/devantage-public/logo-100x100.png)

# n8n-nodes-docscanify

This is an n8n community node that works like a "CamScanner": it takes a photo of a document, detects its edges, corrects the perspective and returns a PDF or an image.

The scanning is done by [DocScanify](https://www.npmjs.com/package/@devantage/docscanify), which lives in the same repository.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The published package's name is: `@devantage/n8n-nodes-docscanify`

The package has no install scripts, so it works with the n8n community nodes installer. Its native module, [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas), ships prebuilt binaries for Linux (including Alpine), macOS and Windows.

## Operations

These are the currently available resources and it's respective operations.

### Document

- Scan Document

| Parameter               | Default | Description                                                                         |
| ----------------------- | ------- | ----------------------------------------------------------------------------------- |
| Input Binary Field      | `data`  | Binary field containing the image (JPG, PNG, WebP and other common formats)         |
| Output Format           | `pdf`   | `pdf` (document inside a PDF page) or `image` (only the scanned image)              |
| Output Binary Field     | `data`  | Field where the result is written                                                   |
| File Name               | (empty) | Output file name. Empty uses the image name with the extension of the output format |
| Filter                  | `none`  | `none`, `grayscale` or `bw` (document mode, adaptive threshold)                     |
| Reduce Noise            | `false` | Smooths the noise, preserving the edges of the text                                 |
| Sharpen                 | `off`   | `off`, `soft` or `strong`                                                           |
| Rotation                | `0`     | Rotates the scanned document clockwise: `0`, `90`, `180` or `270` degrees           |
| Page Size               | `a4`    | PDF only. `a4`, `letter` or `image` (page sized to the image at 150 DPI)            |
| Margin (Pt)             | `0`     | PDF only. Page margin                                                               |
| Max Dimension (Px)      | `3000`  | Downscales large photos before processing                                           |
| JPEG Quality            | `85`    | Quality of the JPEG image (does not apply to `bw`, which uses PNG)                  |
| If No Document Detected | `error` | `error` or `original` (uses the whole photo)                                        |

The document is cropped, then enhanced (noise, sharpness and rotation, in this order), then filtered. With the `image` output format, the result is a JPEG, or a PNG when the `bw` filter is used. PDFs embed the image the same way.

The output JSON gets `scan.detected`, `scan.corners` (in original image pixels, even when the document is rotated), `scan.width` and `scan.height`.

## Compatibility

The current version is compatible with n8n installations above v1.0.0.

This package replaces `@devantage/n8n-nodes-scanify`. It keeps the parameters and the output of its node, and adds the Reduce Noise, Sharpen and Rotation options. n8n identifies community nodes by their package, so workflows that use the old package need its node replaced with this one.

## Usage

### How detection works

Detection based only on the largest contour fails on textured backgrounds (granite, wood, fabric), because the document outline blends into the texture. So DocScanify:

1. shrinks the image to about 800 px
2. uses morphological closing and opening to erase the document's text and the background texture
3. generates candidates from three masks (Otsu, inverted Otsu and Canny)
4. accepts only convex quadrilaterals and scores each one by the fraction of its perimeter that lies on real edges
5. picks the largest well-supported quadrilateral. If none qualifies, it falls back to the largest contour of the image

### Notes

- OpenCV.js is loaded once per process (about 1 s on the first run). Later runs reuse it.
- Detection works best with the document on a contrasting background and all 4 edges visible.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [DocScanify](https://www.npmjs.com/package/@devantage/docscanify)
- [OpenCV.js](https://docs.opencv.org/4.7.0/d5/d10/tutorial_js_root.html)
