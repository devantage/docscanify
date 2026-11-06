// Copia o OpenCV.js usado pelo docscanify para public/, onde é carregado sob demanda.
// (~9 MB; fica fora do bundle principal para a interface abrir rápido.)
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// O docscanify depende do pacote, instalado na raiz do monorepo
const src = require.resolve('@techstark/opencv-js');
const dst = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'opencv.js',
);
mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log('opencv.js copiado para apps/web/public/');
