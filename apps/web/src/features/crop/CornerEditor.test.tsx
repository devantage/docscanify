import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { type JSX, useState } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

import type { SourceImage } from '@/lib/types';

import { CornerEditor } from './CornerEditor';

/** A 2D affine matrix, enough of `DOMMatrix` for the editor. */
interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  inverse(): Matrix;
}

function matrix(a: number, d: number, e: number, f: number): Matrix {
  return {
    a,
    b: 0,
    c: 0,
    d,
    e,
    f,
    inverse: (): Matrix => matrix(1 / a, 1 / d, -e / a, -f / d),
  };
}

/** Point of `createSVGPoint`, transformed by a `Matrix`. */
interface Point {
  x: number;
  y: number;
  matrixTransform(m: Matrix): Point;
}

function point(x: number, y: number): Point {
  return {
    x,
    y,
    matrixTransform(m: Matrix): Point {
      return point(
        m.a * this.x + m.c * this.y + m.e,
        m.b * this.x + m.d * this.y + m.f,
      );
    },
  };
}

// The 1000 × 800 image is shown at half size, with its top-left corner at (10, 20) on screen
const IMAGE_W: number = 1000;
const IMAGE_H: number = 800;
const SCREEN: Matrix = matrix(0.5, 0.5, 10, 20);
const EDITOR_RECT: DOMRect = {
  left: 10,
  top: 20,
  right: 510,
  bottom: 420,
  width: 500,
  height: 400,
  x: 10,
  y: 20,
  toJSON: (): unknown => ({}),
};

const CORNERS: Corners = {
  topLeft: { x: 100, y: 100 },
  topRight: { x: 900, y: 100 },
  bottomRight: { x: 900, y: 700 },
  bottomLeft: { x: 100, y: 700 },
};

/** Screen position of a point in image coordinates. */
const toScreen = (
  x: number,
  y: number,
): { clientX: number; clientY: number } => ({
  clientX: x * SCREEN.a + SCREEN.e,
  clientY: y * SCREEN.d + SCREEN.f,
});

function makeSource(): SourceImage {
  const image: HTMLImageElement = document.createElement('img');
  Object.defineProperty(image, 'naturalWidth', { value: IMAGE_W });
  Object.defineProperty(image, 'naturalHeight', { value: IMAGE_H });
  return {
    image,
    url: 'blob:photo',
    name: 'photo',
    scannedDocument: {} as unknown as ScannedDocument,
  };
}

/** A fake `ResizeObserver`: its callback and the elements it observes. */
interface Observer {
  callback(): void;
  targets: Element[];
}

let observers: Observer[];
let setPointerCapture: Mock<(pointerId: number) => void>;

beforeEach((): void => {
  observers = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly observer: Observer;

      public constructor(callback: () => void) {
        this.observer = { callback, targets: [] };
        observers.push(this.observer);
      }

      // The tests call the callbacks themselves, for the observed elements
      public observe(target: Element): void {
        this.observer.targets.push(target);
      }

      public disconnect(): void {
        // Nothing to release
      }
    },
  );
  // jsdom does no SVG layout: the editor's transform is provided here
  Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: (): Matrix => SCREEN,
  });
  Object.defineProperty(SVGSVGElement.prototype, 'createSVGPoint', {
    configurable: true,
    value: (): Point => point(0, 0),
  });
  setPointerCapture = vi.fn<(pointerId: number) => void>();
  Object.defineProperty(Element.prototype, 'setPointerCapture', {
    configurable: true,
    value: setPointerCapture,
  });
  vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue(
    EDITOR_RECT,
  );
  // The loupe draws on a canvas, which jsdom does not implement
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    new Proxy(
      {},
      { get: (): (() => void) => (): void => undefined },
    ) as unknown as CanvasRenderingContext2D,
  );
});

afterEach((): void => {
  vi.unstubAllGlobals();
});

/** The editor with its corners kept in state, as the Crop step does. */
function ControlledEditor({
  onChange,
  onDraggingChange,
}: {
  onChange?(corners: Corners): void;
  onDraggingChange?(dragging: boolean): void;
}): JSX.Element {
  const [corners, setCorners] = useState<Corners>(CORNERS);
  const [source] = useState<SourceImage>(makeSource);
  return (
    <CornerEditor
      source={source}
      corners={corners}
      onChange={(next: Corners) => {
        setCorners(next);
        onChange?.(next);
      }}
      onDraggingChange={onDraggingChange}
    />
  );
}

const corner = (index: number): HTMLElement =>
  screen.getByTestId(`corner-${index}`);

const centerOf = (index: number): { cx: string | null; cy: string | null } => {
  const dot: Element | null = corner(index).querySelector('.corner-dot');
  return {
    cx: dot?.getAttribute('cx') ?? null,
    cy: dot?.getAttribute('cy') ?? null,
  };
};

describe('CornerEditor', (): void => {
  it('shows the image in its own coordinates, with a corner at each crop corner', (): void => {
    const source: SourceImage = makeSource();
    render(
      <CornerEditor source={source} corners={CORNERS} onChange={vi.fn()} />,
    );

    const svg: HTMLElement = screen.getByTestId('corner-editor');
    expect(svg).toHaveAttribute('viewBox', '0 0 1000 800');
    const image: Element | null = svg.querySelector('image');
    expect(image).toHaveAttribute('href', 'blob:photo');
    expect(image).toHaveAttribute('width', '1000');
    expect(image).toHaveAttribute('height', '800');

    expect(centerOf(0)).toEqual({ cx: '100', cy: '100' });
    expect(centerOf(1)).toEqual({ cx: '900', cy: '100' });
    expect(centerOf(2)).toEqual({ cx: '900', cy: '700' });
    expect(centerOf(3)).toEqual({ cx: '100', cy: '700' });
    expect(screen.queryByTestId('corner-4')).not.toBeInTheDocument();
  });

  it('outlines the crop in corner order and dims everything outside it', (): void => {
    render(
      <CornerEditor
        source={makeSource()}
        corners={CORNERS}
        onChange={vi.fn()}
      />,
    );

    const svg: HTMLElement = screen.getByTestId('corner-editor');
    expect(svg.querySelector('.editor-outline')).toHaveAttribute(
      'points',
      '100,100 900,100 900,700 100,700',
    );
    expect(svg.querySelector('.editor-outline-halo')).toHaveAttribute(
      'points',
      '100,100 900,100 900,700 100,700',
    );
    const shade: Element | null = svg.querySelector('.editor-shade');
    expect(shade).toHaveAttribute(
      'd',
      'M0 0H1000V800H0Z M100 100L900 100L900 700L100 700Z',
    );
    expect(shade).toHaveAttribute('fill-rule', 'evenodd');
  });

  it('keeps the handles at a fixed size on screen, whatever the image scale', (): void => {
    render(
      <CornerEditor
        source={makeSource()}
        corners={CORNERS}
        onChange={vi.fn()}
      />,
    );

    // Shown at half size: each screen pixel is 2 image units, so a 26 px handle is 52 units
    expect(corner(0).querySelector('.corner-hit')).toHaveAttribute('r', '52');
    expect(corner(0).querySelector('.corner-dot')).toHaveAttribute('r', '7');
  });

  it('draws each crop mark along the two edges that meet at its corner', (): void => {
    render(
      <CornerEditor
        source={makeSource()}
        corners={CORNERS}
        onChange={vi.fn()}
      />,
    );

    // Arms of 26 screen px (52 image units), toward the previous and the next corner
    expect(corner(0).querySelector('.corner-mark')).toHaveAttribute(
      'points',
      '100,152 100,100 152,100',
    );
    expect(corner(2).querySelector('.corner-mark')).toHaveAttribute(
      'points',
      '900,648 900,700 848,700',
    );
  });

  it('resizes the handles when the editor is resized', (): void => {
    render(
      <CornerEditor
        source={makeSource()}
        corners={CORNERS}
        onChange={vi.fn()}
      />,
    );
    Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
      configurable: true,
      value: (): Matrix => matrix(0.25, 0.25, 10, 20),
    });

    // Only the observers of the editor see its resize
    const editor: HTMLElement = screen.getByTestId('corner-editor');
    act((): void => {
      observers
        .filter((observer: Observer) => observer.targets.includes(editor))
        .forEach((observer: Observer) => {
          observer.callback();
        });
    });

    expect(corner(0).querySelector('.corner-hit')).toHaveAttribute('r', '104');
  });

  it('keeps the handle size while the editor has no size on screen', (): void => {
    // Before layout, or while hidden, the editor scale is 0: the handles keep 1 unit per pixel
    Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
      configurable: true,
      value: (): Matrix => matrix(0, 0, 0, 0),
    });
    render(
      <CornerEditor
        source={makeSource()}
        corners={CORNERS}
        onChange={vi.fn()}
      />,
    );

    expect(corner(0).querySelector('.corner-hit')).toHaveAttribute('r', '26');
    expect(corner(0).querySelector('.corner-dot')).toHaveAttribute('r', '3.5');
  });

  it('moves the dragged corner in image coordinates, keeping the grab offset', (): void => {
    const onChange: Mock<(corners: Corners) => void> = vi.fn();
    render(<ControlledEditor onChange={onChange} />);

    // Grabbed 4 image units right of and below the corner: the corner keeps that distance
    fireEvent.pointerDown(corner(0), { ...toScreen(104, 104), pointerId: 7 });
    fireEvent.pointerMove(
      screen.getByTestId('corner-editor'),
      toScreen(304, 254),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({
      ...CORNERS,
      topLeft: { x: 300, y: 250 },
    });
    expect(centerOf(0)).toEqual({ cx: '300', cy: '250' });
    expect(
      screen.getByTestId('corner-editor').querySelector('.editor-outline'),
    ).toHaveAttribute('points', '300,250 900,100 900,700 100,700');
  });

  it('only changes the corner being dragged', (): void => {
    const onChange: Mock<(corners: Corners) => void> = vi.fn();
    render(<ControlledEditor onChange={onChange} />);

    fireEvent.pointerDown(corner(2), { ...toScreen(900, 700), pointerId: 1 });
    fireEvent.pointerMove(
      screen.getByTestId('corner-editor'),
      toScreen(850, 600),
    );
    fireEvent.pointerMove(
      screen.getByTestId('corner-editor'),
      toScreen(800, 650),
    );

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({
      ...CORNERS,
      bottomRight: { x: 800, y: 650 },
    });
  });

  it('clamps a corner dragged outside the image to its edges', (): void => {
    const onChange: Mock<(corners: Corners) => void> = vi.fn();
    render(<ControlledEditor onChange={onChange} />);
    const svg: HTMLElement = screen.getByTestId('corner-editor');

    fireEvent.pointerDown(corner(1), { ...toScreen(900, 100), pointerId: 1 });
    fireEvent.pointerMove(svg, toScreen(1500, -300));
    expect(onChange).toHaveBeenLastCalledWith({
      ...CORNERS,
      topRight: { x: 1000, y: 0 },
    });

    fireEvent.pointerMove(svg, toScreen(-50, 2000));
    expect(onChange).toHaveBeenLastCalledWith({
      ...CORNERS,
      topRight: { x: 0, y: 800 },
    });
  });

  it('ignores pointer moves when no corner is being dragged', (): void => {
    const onChange: Mock<(corners: Corners) => void> = vi.fn();
    render(<ControlledEditor onChange={onChange} />);
    const svg: HTMLElement = screen.getByTestId('corner-editor');

    fireEvent.pointerMove(svg, toScreen(300, 300));
    fireEvent.pointerDown(corner(0), { ...toScreen(100, 100), pointerId: 1 });
    fireEvent.pointerUp(svg, toScreen(100, 100));
    fireEvent.pointerMove(svg, toScreen(500, 500));

    expect(onChange).not.toHaveBeenCalled();
    expect(centerOf(0)).toEqual({ cx: '100', cy: '100' });
  });

  it('captures the pointer on the editor and prevents the default action', (): void => {
    render(<ControlledEditor />);

    const notCancelled: boolean = fireEvent.pointerDown(corner(3), {
      ...toScreen(100, 700),
      pointerId: 42,
    });

    expect(notCancelled).toBe(false);
    expect(setPointerCapture).toHaveBeenCalledWith(42);
    expect(setPointerCapture.mock.contexts[0]).toBe(
      screen.getByTestId('corner-editor'),
    );
  });

  it('reports when a drag starts and when it ends', (): void => {
    const onDraggingChange: Mock<(dragging: boolean) => void> = vi.fn();
    render(<ControlledEditor onDraggingChange={onDraggingChange} />);
    const svg: HTMLElement = screen.getByTestId('corner-editor');

    fireEvent.pointerDown(corner(0), { ...toScreen(100, 100), pointerId: 1 });
    expect(onDraggingChange.mock.calls).toEqual([[true]]);

    fireEvent.pointerMove(svg, toScreen(150, 150));
    expect(onDraggingChange.mock.calls).toEqual([[true]]);

    fireEvent.pointerUp(svg);
    expect(onDraggingChange.mock.calls).toEqual([[true], [false]]);

    // A pointer up without a drag reports nothing
    fireEvent.pointerUp(svg);
    expect(onDraggingChange.mock.calls).toEqual([[true], [false]]);
  });

  it('ends the drag when the pointer is cancelled', (): void => {
    const onDraggingChange: Mock<(dragging: boolean) => void> = vi.fn();
    const onChange: Mock<(corners: Corners) => void> = vi.fn();
    render(
      <ControlledEditor
        onChange={onChange}
        onDraggingChange={onDraggingChange}
      />,
    );
    const svg: HTMLElement = screen.getByTestId('corner-editor');

    fireEvent.pointerDown(corner(0), { ...toScreen(100, 100), pointerId: 1 });
    fireEvent.pointerCancel(svg);
    fireEvent.pointerMove(svg, toScreen(400, 400));

    expect(onDraggingChange.mock.calls).toEqual([[true], [false]]);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('loupe')).not.toBeInTheDocument();
  });

  it('reports the end of the drag when it unmounts mid-drag', (): void => {
    const onDraggingChange: Mock<(dragging: boolean) => void> = vi.fn();
    const { unmount } = render(
      <ControlledEditor onDraggingChange={onDraggingChange} />,
    );

    fireEvent.pointerDown(corner(1), { ...toScreen(900, 100), pointerId: 1 });
    unmount();

    expect(onDraggingChange.mock.calls).toEqual([[true], [false]]);
  });

  it('reports nothing when it unmounts without a drag', (): void => {
    const onDraggingChange: Mock<(dragging: boolean) => void> = vi.fn();
    const { unmount } = render(
      <ControlledEditor onDraggingChange={onDraggingChange} />,
    );

    unmount();

    expect(onDraggingChange).not.toHaveBeenCalled();
  });

  it('highlights the dragged corner and shows the loupe only while dragging', (): void => {
    render(<ControlledEditor />);
    expect(screen.queryByTestId('loupe')).not.toBeInTheDocument();

    fireEvent.pointerDown(corner(2), {
      ...toScreen(900, 700),
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(corner(2)).toHaveClass('corner', 'is-active');
    expect(corner(0)).not.toHaveClass('is-active');
    expect(screen.getByTestId('loupe')).toBeInTheDocument();

    fireEvent.pointerUp(screen.getByTestId('corner-editor'));

    expect(corner(2)).not.toHaveClass('is-active');
    expect(screen.queryByTestId('loupe')).not.toBeInTheDocument();
  });

  it('places the loupe beside a mouse pointer near the top, inside the editor', (): void => {
    render(<ControlledEditor />);

    // At (52, 52) in the editor: no room above, so 32 px to the right, held at the top edge
    fireEvent.pointerDown(corner(0), {
      ...toScreen(104, 104),
      pointerId: 1,
      pointerType: 'mouse',
    });

    const loupe: HTMLElement = screen.getByTestId('loupe');
    expect(loupe.style.left).toBe('84px');
    expect(loupe.style.top).toBe('0px');
    expect(loupe.style.width).toBe('128px');
  });

  it('keeps the loupe farther from a finger than from a mouse', (): void => {
    render(<ControlledEditor />);

    fireEvent.pointerDown(corner(0), {
      ...toScreen(104, 104),
      pointerId: 1,
      pointerType: 'touch',
    });

    expect(screen.getByTestId('loupe').style.left).toBe('116px');
  });

  it('moves the loupe with the pointer', (): void => {
    render(<ControlledEditor />);
    const svg: HTMLElement = screen.getByTestId('corner-editor');

    fireEvent.pointerDown(corner(3), {
      ...toScreen(100, 700),
      pointerId: 1,
      pointerType: 'mouse',
    });
    // At (300, 300) in the editor there is room above: centered, 32 px over the pointer
    fireEvent.pointerMove(svg, { ...toScreen(600, 600), pointerType: 'mouse' });

    const loupe: HTMLElement = screen.getByTestId('loupe');
    expect(loupe.style.left).toBe('236px');
    expect(loupe.style.top).toBe('140px');
  });
});
