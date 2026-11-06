import type { Corner } from './corner.interface';

/** The four corners of a document in an image. */
export interface Corners {
  topLeft: Corner;

  topRight: Corner;

  bottomLeft: Corner;

  bottomRight: Corner;
}
