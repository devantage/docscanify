import type { Corners, ImageDimensions } from '../models';
import { CornersValidator } from './corners-validator.class';

const RECTANGLE: Corners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 100, y: 0 },
  bottomRight: { x: 100, y: 50 },
  bottomLeft: { x: 0, y: 50 },
};

describe('CornersValidator', (): void => {
  describe('assertWithin', (): void => {
    it('accepts corners on the edges of the image', (): void => {
      expect((): void => {
        CornersValidator.assertWithin(RECTANGLE, { width: 100, height: 50 });
      }).not.toThrow();
    });

    it.each([
      { width: 99, height: 50 },
      { width: 100, height: 49 },
    ])('rejects corners outside of %j', (dimensions: ImageDimensions): void => {
      expect((): void => {
        CornersValidator.assertWithin(RECTANGLE, dimensions);
      }).toThrow('The corners are outside of the image');
    });

    it('rejects negative coordinates', (): void => {
      expect((): void => {
        CornersValidator.assertWithin(
          { ...RECTANGLE, topLeft: { x: -1, y: 0 } },
          { width: 100, height: 50 },
        );
      }).toThrow('The corners are outside of the image');
    });
  });

  describe('assertQuadrilateral', (): void => {
    it.each<[string, Corners]>([
      ['a rectangle', RECTANGLE],
      [
        'a document in perspective',
        {
          topLeft: { x: 10, y: 5 },
          topRight: { x: 90, y: 20 },
          bottomRight: { x: 100, y: 90 },
          bottomLeft: { x: 0, y: 70 },
        },
      ],
      [
        'a concave quadrilateral',
        {
          topLeft: { x: 0, y: 0 },
          topRight: { x: 100, y: 0 },
          bottomRight: { x: 30, y: 30 },
          bottomLeft: { x: 0, y: 100 },
        },
      ],
    ])('accepts %s', (_name: string, corners: Corners): void => {
      expect((): void => {
        CornersValidator.assertQuadrilateral(corners);
      }).not.toThrow();
    });

    it.each<[string, Corners]>([
      [
        'crossing sides',
        {
          topLeft: { x: 0, y: 0 },
          topRight: { x: 100, y: 50 },
          bottomRight: { x: 100, y: 0 },
          bottomLeft: { x: 0, y: 50 },
        },
      ],
      [
        'three corners on the same line',
        {
          topLeft: { x: 0, y: 0 },
          topRight: { x: 50, y: 0 },
          bottomRight: { x: 100, y: 0 },
          bottomLeft: { x: 0, y: 50 },
        },
      ],
      ['repeated corners', { ...RECTANGLE, bottomRight: { x: 100, y: 0 } }],
      [
        'all corners in the same place',
        {
          topLeft: { x: 5, y: 5 },
          topRight: { x: 5, y: 5 },
          bottomRight: { x: 5, y: 5 },
          bottomLeft: { x: 5, y: 5 },
        },
      ],
      [
        'coordinates that are not numbers',
        { ...RECTANGLE, topLeft: { x: Number.NaN, y: 0 } },
      ],
      [
        'infinite coordinates',
        { ...RECTANGLE, topRight: { x: Number.POSITIVE_INFINITY, y: 0 } },
      ],
    ])('rejects %s', (_name: string, corners: Corners): void => {
      expect((): void => {
        CornersValidator.assertQuadrilateral(corners);
      }).toThrow('The corners do not form a quadrilateral');
    });
  });
});
