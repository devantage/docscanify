import { createBlankPhoto } from '../../test-helpers';
import { FileContent } from './file-content.class';

describe('FileContent', (): void => {
  const png: Buffer = createBlankPhoto(60, 40);

  it('reads a PNG', (): void => {
    expect(FileContent.fromPng(png).toMetadata()).toEqual({
      name: null,
      mimeType: 'image/png',
      dimensions: { width: 60, height: 40 },
      size: png.length,
    });
  });

  it.each<[string, Uint8Array]>([
    ['a JPEG', new Uint8Array([0xff, 0xd8, 0xff])],
    ['a PNG without its header', new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
  ])('rejects %s', (_name: string, buffer: Uint8Array): void => {
    expect((): FileContent => FileContent.fromPng(buffer)).toThrow(
      'Invalid image, expected a PNG',
    );
  });

  it('compares the bytes of two files', (): void => {
    const file: FileContent = FileContent.fromPng(png);

    expect(file.hasSameBytes(FileContent.fromPng(png))).toBe(true);
    expect(file.hasSameBytes(FileContent.fromPng(createBlankPhoto(6, 4)))).toBe(
      false,
    );
  });

  it('describes the given characteristics', (): void => {
    expect(
      new FileContent({
        buffer: new Uint8Array(4),
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        dimensions: { width: 2, height: 1 },
      }).toMetadata(),
    ).toEqual({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      dimensions: { width: 2, height: 1 },
      size: 4,
    });
  });

  it('does not follow later changes to the given buffer', (): void => {
    const buffer: Buffer = Buffer.from(png);
    const file: FileContent = FileContent.fromPng(buffer);

    buffer.fill(0);

    expect(Buffer.from(file.toBuffer()).equals(png)).toBe(true);
  });

  it('does not let its buffer be changed', (): void => {
    const file: FileContent = FileContent.fromPng(png);

    file.toBuffer().fill(0);

    expect(Buffer.from(file.toBuffer()).equals(png)).toBe(true);
  });

  it('does not let its metadata change it', (): void => {
    const file: FileContent = FileContent.fromPng(png);

    file.toMetadata().dimensions.width = 0;
    file.getDimensions().height = 0;

    expect(file.getDimensions()).toEqual({ width: 60, height: 40 });
  });
});
