// Copies the OpenCV.js that docscanify uses to public/, where it is loaded on demand
// (~9 MB; kept out of the main bundle so the interface opens fast)
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

console.log('Copying lib opencv.js to "apps/web/public/"');

const require = createRequire(import.meta.url);

// A dependency of docscanify, installed at the root of the monorepo
const src = require.resolve('@techstark/opencv-js');

const dst = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'opencv.js',
);

mkdirSync(dirname(dst), { recursive: true });

copyFileSync(src, dst);

console.log('Lib opencv.js successfully copied to "apps/web/public/"');
