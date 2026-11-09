import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import type { TransportName } from '../../cli/cli-options.class';

/** Where the image comes from. Exactly one of them must be given. */
export interface ImageSource {
  /** The image file in base64, or as a data URL */
  imageBase64?: string;

  /** An http or https URL the image is downloaded from */
  imageUrl?: string;

  /** A path on the machine of the server (stdio transport only) */
  imagePath?: string;
}

/** The image file, ready to scan. */
export interface ResolvedImage {
  buffer: Uint8Array;

  /** Name of the file, from its path or URL, if it has one */
  name: string | undefined;
}

/** How the images are obtained. */
export interface ImageSourceResolverOptions {
  /** The transport of the server: paths are only read with stdio */
  transport: TransportName;

  /** Largest image accepted from a URL, in bytes. Default: 50 MB */
  maxDownloadBytes?: number;

  /** How long a download may take, in milliseconds. Default: 30 s */
  downloadTimeoutMs?: number;

  /** Replaces the global fetch, for tests */
  fetch?: typeof fetch;
}

const DEFAULT_MAX_DOWNLOAD_BYTES: number = 50 * 1024 * 1024;

const DEFAULT_DOWNLOAD_TIMEOUT_MS: number = 30_000;

const DATA_URL_PREFIX: RegExp = /^data:[^,]*;base64,/i;

/** Standard and URL-safe alphabets, with optional padding. */
const BASE64_PATTERN: RegExp = /^[A-Za-z0-9+/_-]+={0,2}$/;

/** Reads the image file of a scan from base64, a URL or a local path. */
export class ImageSourceResolver {
  private readonly maxDownloadBytes: number;

  private readonly downloadTimeoutMs: number;

  private readonly fetch: typeof fetch;

  public constructor(private readonly options: ImageSourceResolverOptions) {
    this.maxDownloadBytes =
      options.maxDownloadBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES;
    this.downloadTimeoutMs =
      options.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
    this.fetch = options.fetch ?? fetch;
  }

  /**
   * @throws with a message for the client if not exactly one source is given,
   * or if the image cannot be read from it
   */
  public async resolve(source: ImageSource): Promise<ResolvedImage> {
    const given: (keyof ImageSource)[] = (
      ['imageBase64', 'imageUrl', 'imagePath'] as const
    ).filter((key: keyof ImageSource): boolean => Boolean(source[key]));

    if (given.length !== 1) {
      throw new Error(
        'Send exactly one of imageBase64, imageUrl or imagePath' +
          (given.length ? `, not ${given.join(' and ')}` : ''),
      );
    }

    if (source.imageBase64) {
      return { buffer: this.decodeBase64(source.imageBase64), name: undefined };
    }

    if (source.imageUrl) {
      return this.download(source.imageUrl);
    }

    return this.readPath(source.imagePath ?? '');
  }

  private decodeBase64(value: string): Uint8Array {
    const base64: string = value
      .replace(DATA_URL_PREFIX, '')
      .replace(/\s/g, '');

    if (!BASE64_PATTERN.test(base64)) {
      throw new Error('imageBase64 is not valid base64');
    }

    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  private async download(value: string): Promise<ResolvedImage> {
    const url: URL = this.parseUrl(value);
    const response: Response = await this.fetch(url, {
      signal: AbortSignal.timeout(this.downloadTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `Could not download the image from ${url.href}: HTTP ${String(response.status)}`,
      );
    }

    if (
      Number(response.headers.get('content-length')) > this.maxDownloadBytes
    ) {
      await response.body?.cancel();

      throw this.createTooLargeError();
    }

    return {
      buffer: await this.readLimited(response),
      name: this.getUrlFileName(url),
    };
  }

  private parseUrl(value: string): URL {
    let url: URL;

    try {
      url = new URL(value);
    } catch {
      throw new Error(`imageUrl "${value}" is not a valid URL`);
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`imageUrl must use http or https, not ${url.protocol}`);
    }

    return url;
  }

  /** Reads the body, counting the bytes, since the content length may be missing or wrong. */
  private async readLimited(response: Response): Promise<Uint8Array> {
    if (!response.body) {
      return new Uint8Array();
    }

    const reader: ReadableStreamDefaultReader<Uint8Array> =
      response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size: number = 0;

    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      size += value.byteLength;

      if (size > this.maxDownloadBytes) {
        await reader.cancel();

        throw this.createTooLargeError();
      }

      chunks.push(value);
    }

    return new Uint8Array(Buffer.concat(chunks));
  }

  private createTooLargeError(): Error {
    return new Error(
      `The image at imageUrl is larger than ${String(this.maxDownloadBytes / 1024 / 1024)} MB`,
    );
  }

  private getUrlFileName(url: URL): string | undefined {
    const segment: string = url.pathname.split('/').pop() ?? '';

    try {
      return decodeURIComponent(segment) || undefined;
    } catch {
      return segment || undefined;
    }
  }

  private async readPath(path: string): Promise<ResolvedImage> {
    if (this.options.transport !== 'stdio') {
      throw new Error(
        'imagePath is only available with the stdio transport; send imageBase64 or imageUrl',
      );
    }

    const absolutePath: string = resolve(path);

    try {
      return {
        buffer: new Uint8Array(await readFile(absolutePath)),
        name: basename(absolutePath),
      };
    } catch (error) {
      throw new Error(
        `Could not read the image at ${absolutePath}: ${(error as Error).message}`,
      );
    }
  }
}
