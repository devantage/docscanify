import type { Corner } from '../models';
import { CornersPerimeter } from './corners-perimeter.class';

describe('CornersPerimeter', (): void => {
  it('lists the corners in the order they are connected', (): void => {
    const topLeft: Corner = { x: 0, y: 0 };
    const topRight: Corner = { x: 1, y: 0 };
    const bottomRight: Corner = { x: 1, y: 1 };
    const bottomLeft: Corner = { x: 0, y: 1 };

    expect(
      CornersPerimeter.of({ topLeft, topRight, bottomLeft, bottomRight }),
    ).toEqual([topLeft, topRight, bottomRight, bottomLeft]);
  });
});
