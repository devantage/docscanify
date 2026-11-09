import {
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
} from 'react';
import { flushSync } from 'react-dom';

/** With a mouse, how far the pointer must move, in px, for a press to become a drag. */
const MOUSE_THRESHOLD: number = 5;
/** With touch, how long to hold, in ms, before dragging starts; until then the finger scrolls. */
const TOUCH_HOLD_MS: number = 300;
/** With touch, how far the finger may move, in px, while holding, without canceling the drag. */
const TOUCH_SLOP: number = 8;
/** Width of the list edges that scroll it while dragging, in px. */
const EDGE: number = 48;
/** How far the list scrolls per frame while the item is at an edge, in px. */
const EDGE_SPEED: number = 10;

interface Options {
  /** Called when an item is dropped at a new position, with the source and target indexes. */
  onReorder(from: number, to: number): void;
  /** Selector of elements inside an item that do not start a drag, such as a remove button. */
  ignore?: string;
}

interface Session {
  from: number;
  to: number;
  pointerId: number;
  touch: boolean;
  active: boolean;
  startX: number;
  startY: number;
  lastX: number;
  startContentX: number;
  timer: number;
  raf: number;
  container: HTMLElement;
  el: HTMLElement;
  items: HTMLElement[];
  centers: number[];
  shift: number;
}

export interface SortableItemProps {
  'data-sortable': number;
  onPointerDown(e: ReactPointerEvent<HTMLElement>): void;
  onKeyDown(e: KeyboardEvent<HTMLElement>): void;
  onContextMenu(e: ReactMouseEvent): void;
}

export interface UseSortableResult<C extends HTMLElement> {
  /** Goes on the scrolling element that contains the items. */
  containerRef: RefObject<C | null>;
  /** Props for each sortable item, in list order. */
  itemProps(index: number): SortableItemProps;
}

/**
 * Drag-and-drop reordering in a horizontally scrolling list, with mouse, touch, or keyboard
 * (Alt + ← / →). While an item is dragged, the others make room for it, and the list scrolls by
 * itself near its edges. The order only changes on drop, through `onReorder`.
 */
export function useSortable<C extends HTMLElement>({
  onReorder,
  ignore,
}: Options): UseSortableResult<C> {
  const containerRef: RefObject<C | null> = useRef<C>(null);
  const onReorderRef: RefObject<Options['onReorder']> = useRef(onReorder);
  onReorderRef.current = onReorder;
  const session: RefObject<Session | null> = useRef<Session | null>(null);

  // While dragging, the finger must not scroll the page or the list
  useEffect(() => {
    const block = (e: TouchEvent): void => {
      if (session.current?.active) e.preventDefault();
    };
    window.addEventListener('touchmove', block, { passive: false });
    return (): void => {
      window.removeEventListener('touchmove', block);
    };
  }, []);

  // Cancels a drag in progress on unmount
  useEffect(
    () => (): void => {
      end(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const contentX = (s: Session, clientX: number): number =>
    clientX - s.container.getBoundingClientRect().left + s.container.scrollLeft;

  const update = (): void => {
    const s: Session | null = session.current;
    if (!s?.active) return;
    const dx: number = contentX(s, s.lastX) - s.startContentX;
    s.el.style.transform = `translateX(${dx}px)`;
    const center: number = s.centers[s.from] + dx;
    s.to = s.centers.filter(
      (c: number, i: number) => i !== s.from && c < center,
    ).length;
    s.items.forEach((item: HTMLElement, i: number) => {
      if (i === s.from) return;
      const offset: number =
        s.from < s.to && i > s.from && i <= s.to
          ? -s.shift
          : s.to < s.from && i >= s.to && i < s.from
            ? s.shift
            : 0;
      item.style.transform = offset ? `translateX(${offset}px)` : '';
    });
  };

  const edgeScroll = (): void => {
    const s: Session | null = session.current;
    if (!s?.active) return;
    const rect: DOMRect = s.container.getBoundingClientRect();
    const step: number =
      s.lastX < rect.left + EDGE
        ? -EDGE_SPEED
        : s.lastX > rect.right - EDGE
          ? EDGE_SPEED
          : 0;
    if (step) {
      s.container.scrollLeft += step;
      update();
    }
    s.raf = requestAnimationFrame(edgeScroll);
  };

  const activate = (): void => {
    const s: Session | null = session.current;
    if (!s || s.active) return;
    s.active = true;
    const rect: DOMRect = s.container.getBoundingClientRect();
    const rects: DOMRect[] = s.items.map((item: HTMLElement) =>
      item.getBoundingClientRect(),
    );
    s.centers = rects.map(
      (r: DOMRect) => r.left - rect.left + s.container.scrollLeft + r.width / 2,
    );
    const gap: number = rects.length > 1 ? rects[1].left - rects[0].right : 0;
    s.shift = rects[s.from].width + gap;
    s.startContentX = contentX(s, s.startX);
    s.lastX = s.startX;
    s.el.classList.add('is-dragging');
    s.container.classList.add('is-sorting');
    // `vibrate` is missing on iOS Safari, which the DOM types don't model
    const vibratingNavigator: { vibrate?: Navigator['vibrate'] } = navigator;
    if (s.touch) vibratingNavigator.vibrate?.(10);
    s.raf = requestAnimationFrame(edgeScroll);
  };

  const onMove = (e: globalThis.PointerEvent): void => {
    const s: Session | null = session.current;
    if (!s || e.pointerId !== s.pointerId) return;
    if (!s.active) {
      const moved: number = Math.hypot(
        e.clientX - s.startX,
        e.clientY - s.startY,
      );
      if (s.touch) {
        if (moved > TOUCH_SLOP) end(false);
        return;
      }
      if (moved < MOUSE_THRESHOLD) return;
      activate();
    }
    e.preventDefault();
    s.lastX = e.clientX;
    update();
  };

  const onUp = (e: globalThis.PointerEvent): void => {
    if (session.current && e.pointerId === session.current.pointerId)
      end(e.type === 'pointerup');
  };

  /** Ends the drag; with `commit`, applies the new order. */
  function end(commit: boolean): void {
    const s: Session | null = session.current;
    if (!s) return;
    session.current = null;
    clearTimeout(s.timer);
    cancelAnimationFrame(s.raf);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    if (!s.active) return;

    // The new order and the reset of the temporary offsets land in the same paint, without flicker
    if (commit && s.to !== s.from)
      flushSync(() => {
        onReorderRef.current(s.from, s.to);
      });
    s.items.forEach((item: HTMLElement) => {
      item.style.transition = 'none';
      item.style.transform = '';
    });
    s.el.classList.remove('is-dragging');
    s.container.classList.remove('is-sorting');
    requestAnimationFrame(() => {
      s.items.forEach((item: HTMLElement) => (item.style.transition = ''));
    });

    // A drop is not a click: the dragged item must not be selected or activated
    const stop = (ev: MouseEvent): void => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => {
      window.removeEventListener('click', stop, { capture: true });
    }, 0);
  }

  const itemProps = (index: number): SortableItemProps => ({
    'data-sortable': index,
    onPointerDown: (e: ReactPointerEvent<HTMLElement>): void => {
      if (session.current || e.button !== 0) return;
      if (ignore && (e.target as Element).closest(ignore)) return;
      const container: C | null = containerRef.current;
      if (!container) return;
      const items: HTMLElement[] = Array.from(
        container.querySelectorAll<HTMLElement>('[data-sortable]'),
      );
      if (items.length < 2) return;
      const touch: boolean = e.pointerType !== 'mouse';
      session.current = {
        from: index,
        to: index,
        pointerId: e.pointerId,
        touch,
        active: false,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        startContentX: 0,
        timer: touch ? window.setTimeout(activate, TOUCH_HOLD_MS) : 0,
        raf: 0,
        container,
        el: e.currentTarget,
        items,
        centers: [],
        shift: 0,
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>): void => {
      if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight'))
        return;
      e.preventDefault();
      const count: number =
        containerRef.current?.querySelectorAll('[data-sortable]').length ?? 0;
      const to: number = index + (e.key === 'ArrowLeft' ? -1 : 1);
      if (to >= 0 && to < count) onReorderRef.current(index, to);
    },
    // Holding to drag must not open the system context menu
    onContextMenu: (e: ReactMouseEvent): void => {
      if (session.current?.touch) e.preventDefault();
    },
  });

  return { containerRef, itemProps };
}
