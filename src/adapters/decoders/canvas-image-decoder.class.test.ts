import {
  type Canvas,
  createCanvas,
  type Image,
  loadImage,
  type SKRSContext2D,
} from '@napi-rs/canvas';

import type { DecodedImage } from '../../domain/models';
import { CanvasImageDecoder } from './canvas-image-decoder.class';

function createTestCanvas(): Canvas {
  const canvas: Canvas = createCanvas(60, 40);
  const context: SKRSContext2D = canvas.getContext('2d');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 60, 40);
  context.fillStyle = '#cc0000';
  context.fillRect(0, 0, 30, 40);

  return canvas;
}

async function getPixel(
  png: Uint8Array,
  x: number,
  y: number,
): Promise<number[]> {
  const image: Image = await loadImage(png);
  const canvas: Canvas = createCanvas(image.width, image.height);
  const context: SKRSContext2D = canvas.getContext('2d');

  context.drawImage(image, 0, 0);

  return Array.from(context.getImageData(x, y, 1, 1).data);
}

describe('CanvasImageDecoder', (): void => {
  const canvas: Canvas = createTestCanvas();
  const decoder: CanvasImageDecoder = new CanvasImageDecoder();

  it.each<[string, () => Buffer]>([
    ['image/png', (): Buffer => canvas.toBuffer('image/png')],
    ['image/jpeg', (): Buffer => canvas.toBuffer('image/jpeg', 100)],
    ['image/webp', (): Buffer => canvas.toBuffer('image/webp', 100)],
  ])(
    'decodes a %s file to PNG, keeping its dimensions and pixels',
    async (mimeType: string, encode: () => Buffer): Promise<void> => {
      const { png, originalMimeType }: DecodedImage =
        await decoder.decode(encode());
      const image: Image = await loadImage(png);

      expect(originalMimeType).toBe(mimeType);
      expect(Buffer.from(png).subarray(1, 4).toString()).toBe('PNG');
      expect({ width: image.width, height: image.height }).toEqual({
        width: 60,
        height: 40,
      });

      const [red, green] = await getPixel(png, 10, 20);
      const [white] = await getPixel(png, 50, 20);

      expect(red).toBeGreaterThan(190);
      expect(green).toBeLessThan(20);
      expect(white).toBeGreaterThan(240);
    },
  );

  it('decodes even a PNG, instead of keeping it as it is', async (): Promise<void> => {
    const file: Buffer = canvas.toBuffer('image/png');
    const { png }: DecodedImage = await decoder.decode(file);

    expect(png).not.toBe(file);
    expect(Buffer.from(png).subarray(1, 4).toString()).toBe('PNG');
  });

  it('recognizes a BMP file', async (): Promise<void> => {
    // 1x1 and 24 bits, written by hand because the canvas cannot encode this format
    const bmp: Buffer = Buffer.alloc(58);

    bmp.write('BM');
    bmp.writeUInt32LE(58, 2);
    bmp.writeUInt32LE(54, 10);
    bmp.writeUInt32LE(40, 14);
    bmp.writeInt32LE(1, 18);
    bmp.writeInt32LE(1, 22);
    bmp.writeUInt16LE(1, 26);
    bmp.writeUInt16LE(24, 28);

    await expect(decoder.decode(bmp)).resolves.toMatchObject({
      originalMimeType: 'image/bmp',
    });
  });

  it('recognizes an ICO file', async (): Promise<void> => {
    // An icon directory with a single entry, whose image is a PNG
    const png: Buffer = canvas.toBuffer('image/png');
    const directory: Buffer = Buffer.alloc(22);

    directory.writeUInt16LE(1, 2);
    directory.writeUInt16LE(1, 4);
    directory[6] = 60;
    directory[7] = 40;
    directory.writeUInt16LE(1, 10);
    directory.writeUInt16LE(32, 12);
    directory.writeUInt32LE(png.length, 14);
    directory.writeUInt32LE(22, 18);

    await expect(
      decoder.decode(Buffer.concat([directory, png])),
    ).resolves.toMatchObject({ originalMimeType: 'image/x-icon' });
  });

  it('uses the unknown type for a readable file it does not recognize', async (): Promise<void> => {
    const svg: Buffer = Buffer.from(
      '  <svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    );

    await expect(decoder.decode(svg)).resolves.toMatchObject({
      originalMimeType: 'application/octet-stream',
    });
  });

  it('rejects a file the canvas cannot read', async (): Promise<void> => {
    await expect(decoder.decode(Buffer.from([1, 2, 3, 4]))).rejects.toThrow();
  });
});
