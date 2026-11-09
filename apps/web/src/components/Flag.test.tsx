import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type FlagCode, LOCALES } from '@/i18n';

import { Flag } from './Flag';

function renderFlag(code: FlagCode): SVGSVGElement {
  const { container } = render(<Flag code={code} />);
  const svg: SVGSVGElement | null = container.querySelector('svg');
  if (!svg) throw new Error('Flag rendered no svg');
  return svg;
}

/** Fill colors of the elements of a flag, in drawing order. */
const fills = (svg: SVGSVGElement, selector: string): (string | null)[] =>
  Array.from(svg.querySelectorAll(selector)).map((el: Element) =>
    el.getAttribute('fill'),
  );

describe('Flag', (): void => {
  it('is a decorative 3:2 svg hidden from screen readers', (): void => {
    const svg: SVGSVGElement = renderFlag('br');

    expect(svg).toHaveClass('flag');
    expect(svg).toHaveAttribute('viewBox', '0 0 30 20');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws Brazil: green field, yellow rhombus, blue globe', (): void => {
    const svg: SVGSVGElement = renderFlag('br');

    expect(fills(svg, 'rect')).toEqual(['#009739']);
    expect(fills(svg, 'path')).toEqual(['#fedd00', 'none']);
    expect(fills(svg, 'circle')).toEqual(['#012169']);
  });

  it('draws the United States: 7 red stripes on white, a blue canton with 20 stars', (): void => {
    const svg: SVGSVGElement = renderFlag('us');

    const rects: (string | null)[] = fills(svg, 'rect');
    expect(rects[0]).toBe('#fff');
    expect(rects.filter((f: string | null) => f === '#b22234')).toHaveLength(7);
    expect(rects.at(-1)).toBe('#3c3b6e');
    expect(svg.querySelectorAll('g[fill="#fff"] circle')).toHaveLength(20);
  });

  it('staggers the rows of stars of the United States, keeping them inside the canton', (): void => {
    const svg: SVGSVGElement = renderFlag('us');
    const stars: Element[] = Array.from(
      svg.querySelectorAll('g[fill="#fff"] circle'),
    );
    const cx = (star: Element): number => Number(star.getAttribute('cx'));
    const cy = (star: Element): number => Number(star.getAttribute('cy'));
    /** Horizontal position of the first star of each row, top to bottom. */
    const rowStarts: number[] = [
      ...new Set(stars.map((star: Element) => cy(star))),
    ].map((y: number) =>
      Math.min(
        ...stars
          .filter((star: Element) => cy(star) === y)
          .map((star: Element) => cx(star)),
      ),
    );

    expect(rowStarts).toHaveLength(4);
    expect(rowStarts[1]).toBeGreaterThan(rowStarts[0]);
    expect(rowStarts[2]).toBe(rowStarts[0]);
    expect(rowStarts[3]).toBe(rowStarts[1]);
    // The canton is 12 wide
    stars.forEach((star: Element) => {
      expect(cx(star)).toBeGreaterThan(0);
      expect(cx(star)).toBeLessThan(12);
    });
  });

  it('draws Spain: red, yellow band', (): void => {
    const svg: SVGSVGElement = renderFlag('es');

    expect(fills(svg, 'rect')).toEqual(['#aa151b', '#f1bf00']);
    expect(svg.querySelectorAll('path, circle')).toHaveLength(0);
  });

  it('draws a flag for every language of the picker', (): void => {
    LOCALES.forEach(({ flag }: { flag: FlagCode }) => {
      expect(renderFlag(flag).children.length).toBeGreaterThan(0);
    });
  });
});
