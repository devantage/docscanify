import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
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

import { useSortable } from './useSortable';

/** Width of each item, in px. */
const WIDTH: number = 100;
/** Space between items, in px. */
const GAP: number = 10;
/** Visible width of the list, in px. */
const VIEWPORT: number = 400;

/** A sortable list that applies the new order, as the carousel does. */
function List({
  initial = ['A', 'B', 'C'],
  onReorder,
  onItemClick,
  ignore,
}: {
  initial?: string[];
  onReorder(from: number, to: number): void;
  onItemClick?(name: string): void;
  ignore?: string;
}): JSX.Element {
  const [items, setItems] = useState<string[]>(initial);
  const { containerRef, itemProps } = useSortable<HTMLDivElement>({
    onReorder: (from: number, to: number): void => {
      onReorder(from, to);
      setItems((list: string[]) => {
        const next: string[] = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    },
    ignore,
  });
  return (
    <div ref={containerRef} data-testid="list">
      {items.map((name: string, index: number) => (
        <div
          key={name}
          {...itemProps(index)}
          tabIndex={0}
          data-testid={`item-${name}`}
          onClick={() => onItemClick?.(name)}
        >
          {name}
          <button type="button" className="remove">
            Remove {name}
          </button>
        </div>
      ))}
    </div>
  );
}

/** A 100 px tall box at the given left edge, as `getBoundingClientRect` returns. */
const rect = (left: number, width: number): DOMRect =>
  new DOMRect(left, 0, width, 100);

let frames: Map<number, FrameRequestCallback>;
let lastFrame: number;

beforeEach((): void => {
  // Lays the items out in a row: item i spans [i * 110, i * 110 + 100]; the list spans [0, 400]
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function layout(this: HTMLElement): DOMRect {
      const index: string | null = this.getAttribute('data-sortable');
      if (index !== null)
        return rect(
          Number(index) * (WIDTH + GAP) - (this.parentElement?.scrollLeft ?? 0),
          WIDTH,
        );
      return rect(0, VIEWPORT);
    },
  );
  frames = new Map<number, FrameRequestCallback>();
  lastFrame = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    (callback: FrameRequestCallback): number => {
      lastFrame += 1;
      frames.set(lastFrame, callback);
      return lastFrame;
    },
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    frames.delete(id);
  });
});

afterEach((): void => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'vibrate');
});

/** Runs the pending animation frames once. */
function runFrame(): void {
  act(() => {
    const pending: FrameRequestCallback[] = [...frames.values()];
    frames.clear();
    pending.forEach((callback: FrameRequestCallback) => {
      callback(performance.now());
    });
  });
}

/** The item with the given name. */
const item = (name: string): HTMLElement => screen.getByTestId(`item-${name}`);
/** The scrolling list that contains the items. */
const list = (): HTMLElement => screen.getByTestId('list');

/** Names of the items, in DOM order. */
const order = (): string[] =>
  Array.from(list().querySelectorAll('[data-sortable]')).map(
    (el: Element) => el.firstChild?.textContent ?? '',
  );

interface PointerInit {
  pointerId?: number;
  pointerType?: 'mouse' | 'touch' | 'pen';
  button?: number;
  clientX: number;
  clientY?: number;
}

/** Presses the pointer on an element; returns false when the default was prevented. */
const pointerDown = (
  target: Element,
  {
    pointerId = 1,
    pointerType = 'mouse',
    button = 0,
    clientX,
    clientY = 50,
  }: PointerInit,
): boolean =>
  fireEvent.pointerDown(target, {
    pointerId,
    pointerType,
    button,
    clientX,
    clientY,
  });

/** Sends a pointer event to the window, as the browser does after a press. */
function pointerOnWindow(
  type: 'pointermove' | 'pointerup' | 'pointercancel',
  { pointerId = 1, pointerType = 'mouse', clientX, clientY = 50 }: PointerInit,
): PointerEvent {
  const event: PointerEvent = new PointerEvent(type, {
    pointerId,
    pointerType,
    clientX,
    clientY,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

/** Drags with the mouse from one x to another, through a point past the drag threshold. */
function mouseDrag(target: Element, fromX: number, toX: number): void {
  pointerDown(target, { clientX: fromX });
  pointerOnWindow('pointermove', { clientX: fromX + 10 });
  pointerOnWindow('pointermove', { clientX: toX });
  pointerOnWindow('pointerup', { clientX: toX });
}

describe('useSortable', (): void => {
  it('marks each item with its index', (): void => {
    render(<List onReorder={vi.fn()} />);

    expect(
      ['A', 'B', 'C'].map((name: string) =>
        item(name).getAttribute('data-sortable'),
      ),
    ).toEqual(['0', '1', '2']);
  });

  describe('keyboard', (): void => {
    it('moves the focused item right with Alt + ArrowRight and left with Alt + ArrowLeft', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);
      item('B').focus();

      await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
      expect(onReorder).toHaveBeenLastCalledWith(1, 2);
      expect(order()).toEqual(['A', 'C', 'B']);
      expect(item('B')).toHaveFocus();

      await user.keyboard('{Alt>}{ArrowLeft}{ArrowLeft}{/Alt}');
      expect(onReorder.mock.calls).toEqual([
        [1, 2],
        [2, 1],
        [1, 0],
      ]);
      expect(order()).toEqual(['B', 'A', 'C']);
    });

    it('does not move the first item further left nor the last one further right', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      item('A').focus();
      await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
      item('C').focus();
      await user.keyboard('{Alt>}{ArrowRight}{/Alt}');

      expect(onReorder).not.toHaveBeenCalled();
      expect(order()).toEqual(['A', 'B', 'C']);
    });

    it('prevents the default of Alt + arrow, and leaves the arrows alone without Alt', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      expect(
        fireEvent.keyDown(item('A'), { key: 'ArrowRight', altKey: true }),
      ).toBe(false);
      expect(onReorder).toHaveBeenCalledTimes(1);

      expect(fireEvent.keyDown(item('A'), { key: 'ArrowRight' })).toBe(true);
      expect(fireEvent.keyDown(item('A'), { key: 'Enter', altKey: true })).toBe(
        true,
      );
      expect(onReorder).toHaveBeenCalledTimes(1);
    });
  });

  describe('mouse', (): void => {
    it('drags the first item to the end, moving the others to make room, and reorders on drop', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      pointerDown(item('A'), { clientX: 50 });
      pointerOnWindow('pointermove', { clientX: 290 });

      expect(item('A')).toHaveClass('is-dragging');
      expect(list()).toHaveClass('is-sorting');
      expect(item('A').style.transform).toBe('translateX(240px)');
      // B and C slide left by one item plus the gap
      expect(item('B').style.transform).toBe('translateX(-110px)');
      expect(item('C').style.transform).toBe('translateX(-110px)');
      expect(onReorder).not.toHaveBeenCalled();

      pointerOnWindow('pointerup', { clientX: 290 });
      expect(onReorder).toHaveBeenCalledExactlyOnceWith(0, 2);
      expect(order()).toEqual(['B', 'C', 'A']);
      expect(item('A')).not.toHaveClass('is-dragging');
      expect(list()).not.toHaveClass('is-sorting');
      ['A', 'B', 'C'].forEach((name: string) => {
        expect(item(name).style.transform).toBe('');
        // The items snap into their new places instead of sliding back from their offsets
        expect(item(name).style.transition).toBe('none');
      });

      // From the next frame on, their transitions are back
      runFrame();
      ['A', 'B', 'C'].forEach((name: string) => {
        expect(item(name).style.transition).toBe('');
      });
    });

    it('drags an item to the start, moving the ones before it right', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      pointerDown(item('C'), { clientX: 270 });
      pointerOnWindow('pointermove', { clientX: 40 });
      expect(item('A').style.transform).toBe('translateX(110px)');
      expect(item('B').style.transform).toBe('translateX(110px)');

      pointerOnWindow('pointerup', { clientX: 40 });
      expect(onReorder).toHaveBeenCalledExactlyOnceWith(2, 0);
      expect(order()).toEqual(['C', 'A', 'B']);
    });

    it('moves only the items it passes over', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List initial={['A', 'B', 'C', 'D']} onReorder={onReorder} />);

      // From the center of A (50) to just past the center of B (160)
      mouseDrag(item('A'), 50, 170);
      expect(onReorder).toHaveBeenCalledExactlyOnceWith(0, 1);
      expect(order()).toEqual(['B', 'A', 'C', 'D']);
    });

    it('does not start a drag for movements under 5 px', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      pointerDown(item('A'), { clientX: 50 });
      const move: PointerEvent = pointerOnWindow('pointermove', {
        clientX: 53,
        clientY: 52,
      });
      expect(item('A')).not.toHaveClass('is-dragging');
      expect(move.defaultPrevented).toBe(false);

      pointerOnWindow('pointerup', { clientX: 53 });
      expect(onReorder).not.toHaveBeenCalled();
    });

    it('lets a plain click through, but swallows the click that ends a drag', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const onItemClick: Mock<(name: string) => void> = vi.fn();
      render(<List onReorder={vi.fn()} onItemClick={onItemClick} />);

      await user.click(item('B'));
      expect(onItemClick).toHaveBeenCalledExactlyOnceWith('B');

      onItemClick.mockClear();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      mouseDrag(item('A'), 50, 290);
      fireEvent.click(item('A'));
      expect(onItemClick).not.toHaveBeenCalled();

      // Only the click right after the drop is swallowed
      act(() => {
        vi.advanceTimersByTime(0);
      });
      fireEvent.click(item('A'));
      expect(onItemClick).toHaveBeenCalledExactlyOnceWith('A');
    });

    it('does not reorder when the item is dropped back at its place', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      pointerDown(item('B'), { clientX: 160 });
      pointerOnWindow('pointermove', { clientX: 200 });
      expect(item('B')).toHaveClass('is-dragging');
      pointerOnWindow('pointermove', { clientX: 165 });
      pointerOnWindow('pointerup', { clientX: 165 });

      expect(onReorder).not.toHaveBeenCalled();
      expect(item('B')).not.toHaveClass('is-dragging');
      expect(item('B').style.transform).toBe('');
    });

    it('cancels the drag on pointercancel, keeping the order', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      pointerDown(item('A'), { clientX: 50 });
      pointerOnWindow('pointermove', { clientX: 290 });
      pointerOnWindow('pointercancel', { clientX: 290 });

      expect(onReorder).not.toHaveBeenCalled();
      expect(order()).toEqual(['A', 'B', 'C']);
      expect(item('A')).not.toHaveClass('is-dragging');
      expect(item('C').style.transform).toBe('');

      // The session is over: later events do nothing
      pointerOnWindow('pointermove', { clientX: 100 });
      pointerOnWindow('pointerup', { clientX: 100 });
      expect(onReorder).not.toHaveBeenCalled();
    });

    it('ignores the events of another pointer', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      pointerDown(item('A'), { clientX: 50, pointerId: 1 });
      pointerOnWindow('pointermove', { clientX: 290, pointerId: 2 });
      expect(item('A')).not.toHaveClass('is-dragging');

      pointerOnWindow('pointermove', { clientX: 290, pointerId: 1 });
      pointerOnWindow('pointerup', { clientX: 290, pointerId: 2 });
      expect(onReorder).not.toHaveBeenCalled();
      pointerOnWindow('pointerup', { clientX: 290, pointerId: 1 });
      expect(onReorder).toHaveBeenCalledExactlyOnceWith(0, 2);
    });

    it('does not drag with a button other than the main one', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      pointerDown(item('A'), { clientX: 50, button: 2 });
      pointerOnWindow('pointermove', { clientX: 290 });
      pointerOnWindow('pointerup', { clientX: 290 });

      expect(item('A')).not.toHaveClass('is-dragging');
      expect(onReorder).not.toHaveBeenCalled();
    });

    it('does not start a drag from the elements matched by ignore', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} ignore=".remove" />);

      mouseDrag(screen.getByRole('button', { name: 'Remove A' }), 50, 290);
      expect(onReorder).not.toHaveBeenCalled();

      // The rest of the item still drags
      mouseDrag(item('A'), 50, 290);
      expect(onReorder).toHaveBeenCalledExactlyOnceWith(0, 2);
    });

    it('does not drag when there is a single item', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List initial={['A']} onReorder={onReorder} />);

      pointerDown(item('A'), { clientX: 50 });
      pointerOnWindow('pointermove', { clientX: 290 });
      expect(item('A')).not.toHaveClass('is-dragging');
      pointerOnWindow('pointerup', { clientX: 290 });
      expect(onReorder).not.toHaveBeenCalled();
    });

    it('scrolls the list while the item is held near its right edge', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(
        <List initial={['A', 'B', 'C', 'D', 'E']} onReorder={onReorder} />,
      );

      pointerDown(item('A'), { clientX: 50 });
      pointerOnWindow('pointermove', { clientX: 390 });
      expect(list().scrollLeft).toBe(0);

      runFrame();
      expect(list().scrollLeft).toBe(10);
      runFrame();
      expect(list().scrollLeft).toBe(20);

      // Away from the edges, it stops
      pointerOnWindow('pointermove', { clientX: 200 });
      runFrame();
      expect(list().scrollLeft).toBe(20);

      pointerOnWindow('pointerup', { clientX: 200 });
      expect(frames.size).toBe(1);
      expect(onReorder).toHaveBeenCalledTimes(1);
    });

    it('scrolls the list back while the item is held near its left edge', (): void => {
      render(<List initial={['A', 'B', 'C', 'D', 'E']} onReorder={vi.fn()} />);
      list().scrollLeft = 100;

      // C spans [120, 220] on screen once the list is scrolled by 100
      pointerDown(item('C'), { clientX: 150 });
      pointerOnWindow('pointermove', { clientX: 160 });
      // 30 px from the left edge of the list, inside its 48 px edge
      pointerOnWindow('pointermove', { clientX: 30 });

      runFrame();
      expect(list().scrollLeft).toBe(90);
      runFrame();
      expect(list().scrollLeft).toBe(80);

      // Away from the edges, it stops
      pointerOnWindow('pointermove', { clientX: 200 });
      runFrame();
      expect(list().scrollLeft).toBe(80);
      pointerOnWindow('pointerup', { clientX: 200 });
    });

    it('cancels a drag in progress on unmount', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      const { unmount } = render(<List onReorder={onReorder} />);

      pointerDown(item('A'), { clientX: 50 });
      pointerOnWindow('pointermove', { clientX: 290 });
      unmount();
      pointerOnWindow('pointerup', { clientX: 290 });

      expect(onReorder).not.toHaveBeenCalled();
    });
  });

  describe('touch', (): void => {
    beforeEach((): void => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    const hold = (ms: number): void => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    };

    it('starts dragging only after a 300 ms hold, with a short vibration', (): void => {
      const vibrate: Mock<(pattern: VibratePattern) => boolean> = vi.fn(
        (): boolean => true,
      );
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        value: vibrate,
      });
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      pointerDown(item('A'), { clientX: 50, pointerType: 'touch' });
      hold(299);
      expect(item('A')).not.toHaveClass('is-dragging');
      expect(vibrate).not.toHaveBeenCalled();

      hold(1);
      expect(item('A')).toHaveClass('is-dragging');
      expect(vibrate).toHaveBeenCalledExactlyOnceWith(10);

      const move: PointerEvent = pointerOnWindow('pointermove', {
        clientX: 290,
        pointerType: 'touch',
      });
      expect(move.defaultPrevented).toBe(true);
      pointerOnWindow('pointerup', { clientX: 290, pointerType: 'touch' });
      expect(onReorder).toHaveBeenCalledExactlyOnceWith(0, 2);
      expect(order()).toEqual(['B', 'C', 'A']);
    });

    it('tolerates a finger moving up to 8 px while holding', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      pointerDown(item('A'), { clientX: 50, pointerType: 'touch' });
      hold(100);
      pointerOnWindow('pointermove', {
        clientX: 56,
        clientY: 55,
        pointerType: 'touch',
      });
      hold(200);

      expect(item('A')).toHaveClass('is-dragging');
    });

    it('lets the finger scroll instead when it moves before the hold', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      pointerDown(item('A'), { clientX: 50, pointerType: 'touch' });
      hold(100);
      const move: PointerEvent = pointerOnWindow('pointermove', {
        clientX: 70,
        pointerType: 'touch',
      });
      expect(move.defaultPrevented).toBe(false);

      hold(500);
      expect(item('A')).not.toHaveClass('is-dragging');
      pointerOnWindow('pointermove', { clientX: 290, pointerType: 'touch' });
      pointerOnWindow('pointerup', { clientX: 290, pointerType: 'touch' });
      expect(onReorder).not.toHaveBeenCalled();
    });

    it('does not drag when the finger lifts before the hold', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      pointerDown(item('A'), { clientX: 50, pointerType: 'touch' });
      hold(200);
      pointerOnWindow('pointerup', { clientX: 50, pointerType: 'touch' });
      hold(500);

      expect(item('A')).not.toHaveClass('is-dragging');
      expect(onReorder).not.toHaveBeenCalled();
    });

    it('treats a pen like a finger: it waits for the hold instead of dragging on movement', (): void => {
      const onReorder: Mock<(from: number, to: number) => void> = vi.fn();
      render(<List onReorder={onReorder} />);

      pointerDown(item('A'), { clientX: 50, pointerType: 'pen' });
      const move: PointerEvent = pointerOnWindow('pointermove', {
        clientX: 70,
        pointerType: 'pen',
      });
      expect(move.defaultPrevented).toBe(false);
      expect(item('A')).not.toHaveClass('is-dragging');

      pointerOnWindow('pointerup', { clientX: 290, pointerType: 'pen' });
      expect(onReorder).not.toHaveBeenCalled();

      pointerDown(item('A'), { clientX: 50, pointerType: 'pen' });
      hold(300);
      expect(item('A')).toHaveClass('is-dragging');
    });

    it('cancels the hold of a finger that lifted, so it does not cut short the next hold', (): void => {
      render(<List onReorder={vi.fn()} />);

      pointerDown(item('A'), { clientX: 50, pointerType: 'touch' });
      hold(200);
      pointerOnWindow('pointerup', { clientX: 50, pointerType: 'touch' });
      pointerDown(item('B'), {
        pointerId: 2,
        clientX: 160,
        pointerType: 'touch',
      });

      // 300 ms after the first press, but only 100 ms into the second hold
      hold(100);
      expect(item('B')).not.toHaveClass('is-dragging');
      hold(200);
      expect(item('B')).toHaveClass('is-dragging');
      pointerOnWindow('pointerup', {
        pointerId: 2,
        clientX: 160,
        pointerType: 'touch',
      });
    });

    it('keeps the page from scrolling only while an item is dragged', (): void => {
      render(<List onReorder={vi.fn()} />);
      const touchMove = (): boolean =>
        window.dispatchEvent(
          new Event('touchmove', { bubbles: true, cancelable: true }),
        );

      expect(touchMove()).toBe(true);
      pointerDown(item('A'), { clientX: 50, pointerType: 'touch' });
      expect(touchMove()).toBe(true);
      hold(300);
      expect(touchMove()).toBe(false);

      pointerOnWindow('pointerup', { clientX: 50, pointerType: 'touch' });
      expect(touchMove()).toBe(true);
    });

    it('keeps the system context menu from opening while holding an item', (): void => {
      render(<List onReorder={vi.fn()} />);

      expect(fireEvent.contextMenu(item('A'))).toBe(true);
      pointerDown(item('A'), { clientX: 50, pointerType: 'touch' });
      expect(fireEvent.contextMenu(item('A'))).toBe(false);
    });

    it('does not block the context menu of a mouse press', (): void => {
      render(<List onReorder={vi.fn()} />);

      pointerDown(item('A'), { clientX: 50 });
      expect(fireEvent.contextMenu(item('A'))).toBe(true);
    });
  });
});
