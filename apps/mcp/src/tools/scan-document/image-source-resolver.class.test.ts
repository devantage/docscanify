import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ImageSourceResolver,
  type ResolvedImage,
} from './image-source-resolver.class';

const IMAGE: Buffer = Buffer.from('image bytes');

/**
 * A fetch that answers with a fixed response.
 *
 * @param body what the response streams
 * @param init status and headers of the response
 */
function createFetch(
  body: ConstructorParameters<typeof Response>[0] = IMAGE.toString(),
  init: ResponseInit = { status: 200 },
): jest.MockedFunction<typeof fetch> {
  return jest.fn<Promise<Response>, Parameters<typeof fetch>>(
    async (): Promise<Response> => Promise.resolve(new Response(body, init)),
  );
}

describe('ImageSourceResolver', (): void => {
  describe('sources', (): void => {
    const resolver: ImageSourceResolver = new ImageSourceResolver({
      transport: 'stdio',
      fetch: createFetch(),
    });

    it('rejects no source', async (): Promise<void> => {
      await expect(resolver.resolve({})).rejects.toThrow(
        'Send exactly one of imageBase64, imageUrl or imagePath',
      );
    });

    it('rejects more than one source', async (): Promise<void> => {
      await expect(
        resolver.resolve({
          imageBase64: 'aGk=',
          imageUrl: 'https://a.b/c.png',
        }),
      ).rejects.toThrow(', not imageBase64 and imageUrl');
    });

    it('ignores empty sources', async (): Promise<void> => {
      const image: ResolvedImage = await resolver.resolve({
        imageBase64: IMAGE.toString('base64'),
        imagePath: '',
      });

      expect(Buffer.from(image.buffer)).toEqual(IMAGE);
    });
  });

  describe('imageBase64', (): void => {
    const resolver: ImageSourceResolver = new ImageSourceResolver({
      transport: 'http',
    });

    it('decodes base64, with no name', async (): Promise<void> => {
      const image: ResolvedImage = await resolver.resolve({
        imageBase64: IMAGE.toString('base64'),
      });

      expect(Buffer.from(image.buffer)).toEqual(IMAGE);
      expect(image.name).toBeUndefined();
    });

    it('decodes a data URL with line breaks', async (): Promise<void> => {
      const base64: string = IMAGE.toString('base64');
      const image: ResolvedImage = await resolver.resolve({
        imageBase64: `data:image/png;base64,${base64.slice(0, 4)}\n${base64.slice(4)}`,
      });

      expect(Buffer.from(image.buffer)).toEqual(IMAGE);
    });

    it('rejects invalid base64', async (): Promise<void> => {
      await expect(
        resolver.resolve({ imageBase64: 'not base64!' }),
      ).rejects.toThrow('imageBase64 is not valid base64');
    });
  });

  describe('imageUrl', (): void => {
    it('downloads the image, named after the last segment of the URL', async (): Promise<void> => {
      const fetchMock: jest.MockedFunction<typeof fetch> = createFetch();
      const image: ResolvedImage = await new ImageSourceResolver({
        transport: 'http',
        fetch: fetchMock,
      }).resolve({ imageUrl: 'https://example.com/scans/my%20photo.jpg?x=1' });

      expect(Buffer.from(image.buffer)).toEqual(IMAGE);
      expect(image.name).toBe('my photo.jpg');
      expect(fetchMock).toHaveBeenCalledWith(
        new URL('https://example.com/scans/my%20photo.jpg?x=1'),
        { signal: expect.any(AbortSignal) as unknown },
      );
    });

    it('has no name when the URL has no path', async (): Promise<void> => {
      const image: ResolvedImage = await new ImageSourceResolver({
        transport: 'http',
        fetch: createFetch(),
      }).resolve({ imageUrl: 'https://example.com' });

      expect(image.name).toBeUndefined();
    });

    it.each([
      ['not a url', 'imageUrl "not a url" is not a valid URL'],
      ['file:///etc/passwd', 'imageUrl must use http or https, not file:'],
    ])(
      'rejects %s',
      async (imageUrl: string, message: string): Promise<void> => {
        const fetchMock: jest.MockedFunction<typeof fetch> = createFetch();

        await expect(
          new ImageSourceResolver({
            transport: 'http',
            fetch: fetchMock,
          }).resolve({
            imageUrl,
          }),
        ).rejects.toThrow(message);
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    it('rejects an error status', async (): Promise<void> => {
      await expect(
        new ImageSourceResolver({
          transport: 'http',
          fetch: createFetch('missing', { status: 404 }),
        }).resolve({ imageUrl: 'https://example.com/a.png' }),
      ).rejects.toThrow(
        'Could not download the image from https://example.com/a.png: HTTP 404',
      );
    });

    it('rejects an image whose content length is above the limit', async (): Promise<void> => {
      await expect(
        new ImageSourceResolver({
          transport: 'http',
          maxDownloadBytes: 4,
          fetch: createFetch(IMAGE.toString(), {
            status: 200,
            headers: { 'content-length': String(IMAGE.byteLength) },
          }),
        }).resolve({ imageUrl: 'https://example.com/a.png' }),
      ).rejects.toThrow('The image at imageUrl is larger than');
    });

    it('rejects a streamed image above the limit', async (): Promise<void> => {
      const stream: ReadableStream<Uint8Array> = new ReadableStream({
        start(controller: ReadableStreamDefaultController<Uint8Array>): void {
          controller.enqueue(new Uint8Array(3));
          controller.enqueue(new Uint8Array(3));
          controller.close();
        },
      });

      await expect(
        new ImageSourceResolver({
          transport: 'http',
          maxDownloadBytes: 4,
          fetch: createFetch(stream),
        }).resolve({ imageUrl: 'https://example.com/a.png' }),
      ).rejects.toThrow('The image at imageUrl is larger than');
    });
  });

  describe('imagePath', (): void => {
    let directory: string;

    beforeAll(async (): Promise<void> => {
      directory = await mkdtemp(join(tmpdir(), 'docscanify-mcp-'));
      await writeFile(join(directory, 'photo.png'), IMAGE);
    });

    afterAll(async (): Promise<void> => {
      await rm(directory, { recursive: true, force: true });
    });

    it('reads the file with the stdio transport', async (): Promise<void> => {
      const image: ResolvedImage = await new ImageSourceResolver({
        transport: 'stdio',
      }).resolve({ imagePath: join(directory, 'photo.png') });

      expect(Buffer.from(image.buffer)).toEqual(IMAGE);
      expect(image.name).toBe('photo.png');
    });

    it('rejects a missing file', async (): Promise<void> => {
      await expect(
        new ImageSourceResolver({ transport: 'stdio' }).resolve({
          imagePath: join(directory, 'missing.png'),
        }),
      ).rejects.toThrow(
        `Could not read the image at ${join(directory, 'missing.png')}`,
      );
    });

    it('rejects paths with the http transport', async (): Promise<void> => {
      await expect(
        new ImageSourceResolver({ transport: 'http' }).resolve({
          imagePath: join(directory, 'photo.png'),
        }),
      ).rejects.toThrow(
        'imagePath is only available with the stdio transport; send imageBase64 or imageUrl',
      );
    });
  });
});
