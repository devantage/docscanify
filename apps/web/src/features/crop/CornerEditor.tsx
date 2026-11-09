import './CornerEditor.css';

import type { Corner, Corners } from '@devantage/docscanify';
import {
  type JSX,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { SourceImage } from '@/lib/types';

import { clamp, direction, placeLoupe } from './geometry';
import { Loupe } from './Loupe';

/** Loupe diameter, in screen px. */
const LOUPE_SIZE: number = 128;
/** Distance between the loupe and the cursor, in screen px. */
const LOUPE_GAP_MOUSE: number = 32;
/**
 * Distance between the loupe and the finger, in screen px: larger than for a mouse, so the finger
 * does not cover it.
 */
const LOUPE_GAP_TOUCH: number = 64;

/** In outline order: each corner neighbors the previous and the next one. */
const CORNER_NAMES: (keyof Corners)[] = [
  'topLeft',
  'topRight',
  'bottomRight',
  'bottomLeft',
];

interface Props {
  /** Input image. The corners are in its coordinates. */
  source: SourceImage;
  corners: Corners;
  /** Called on every corner move, with all four corners updated and clamped to the image. */
  onChange(corners: Corners): void;
  /** Called when a drag starts (true) and ends (false). */
  onDraggingChange?(dragging: boolean): void;
}

/** Corner being dragged, and its offset from the pointer, in image units. */
interface CornerDrag {
  index: number;
  offset: Corner;
}

/**
 * Editor of the four crop corners over the image. Each corner is dragged with a mouse or a
 * finger; while dragging, a `Loupe` shows the corner area magnified. The area outside the crop is
 * dimmed.
 */
export function CornerEditor({
  source,
  corners,
  onChange,
  onDraggingChange,
}: Props): JSX.Element {
  const outline: Corner[] = useMemo(
    () => CORNER_NAMES.map((name: keyof Corners) => corners[name]),
    [corners],
  );
  const { naturalWidth: W, naturalHeight: H } = source.image;
  const editorRef: RefObject<HTMLDivElement | null> =
    useRef<HTMLDivElement>(null);
  const svgRef: RefObject<SVGSVGElement | null> = useRef<SVGSVGElement>(null);
  const drag: RefObject<CornerDrag | null> = useRef<CornerDrag | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [loupePos, setLoupePos] = useState<Corner>({ x: 0, y: 0 });
  // Image units per screen pixel (keeps the handles at a fixed on-screen size)
  const [unit, setUnit] = useState(1);

  useLayoutEffect(() => {
    const svg: SVGSVGElement | null = svgRef.current;
    if (!svg) return;
    const update = (): void => {
      const ctm: DOMMatrix | null = svg.getScreenCTM();
      if (ctm && ctm.a) setUnit(1 / ctm.a);
    };
    update();
    const ro: ResizeObserver = new ResizeObserver(update);
    ro.observe(svg);
    return (): void => {
      ro.disconnect();
    };
  }, [W, H]);

  const toImage: (clientX: number, clientY: number) => Corner = useCallback(
    (clientX: number, clientY: number): Corner => {
      const svg: SVGSVGElement | null = svgRef.current;
      if (!svg) throw new Error('The corner editor SVG is not mounted');
      const pt: DOMPoint = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm: DOMMatrix | null = svg.getScreenCTM();
      if (!ctm)
        throw new Error('The corner editor SVG has no screen transform');
      const p: DOMPoint = pt.matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    },
    [],
  );

  const move: (index: number, p: Corner) => void = useCallback(
    (index: number, p: Corner): void => {
      onChange({
        ...corners,
        [CORNER_NAMES[index]]: { x: clamp(p.x, 0, W), y: clamp(p.y, 0, H) },
      });
    },
    [corners, onChange, W, H],
  );

  /** Moves the loupe next to the pointer, farther away for a finger, always inside the editor. */
  const followPointer = (e: PointerEvent): void => {
    const editor: HTMLDivElement | null = editorRef.current;
    if (!editor) return;
    const rect: DOMRect = editor.getBoundingClientRect();
    setLoupePos(
      placeLoupe(
        clamp(e.clientX - rect.left, 0, rect.width),
        clamp(e.clientY - rect.top, 0, rect.height),
        rect.width,
        rect.height,
        e.pointerType === 'mouse' ? LOUPE_GAP_MOUSE : LOUPE_GAP_TOUCH,
        LOUPE_SIZE,
      ),
    );
  };

  /**
   * Starts dragging the corner at `index`. The corner keeps its offset from the pointer, so it does
   * not jump under it.
   */
  const onPointerDown =
    (index: number) =>
    (e: PointerEvent): void => {
      e.preventDefault();
      const p: Corner = toImage(e.clientX, e.clientY);
      drag.current = {
        index,
        offset: { x: outline[index].x - p.x, y: outline[index].y - p.y },
      };
      const svg: SVGSVGElement | null = svgRef.current;
      if (!svg) return;
      svg.setPointerCapture(e.pointerId);
      followPointer(e);
      setActive(index);
      onDraggingChange?.(true);
    };

  const onPointerMove = (e: PointerEvent): void => {
    if (!drag.current) return;
    const p: Corner = toImage(e.clientX, e.clientY);
    move(drag.current.index, {
      x: p.x + drag.current.offset.x,
      y: p.y + drag.current.offset.y,
    });
    followPointer(e);
  };

  // Without this, unmounting mid-drag would leave the listener thinking the drag goes on
  useEffect(
    () => (): void => {
      if (drag.current) onDraggingChange?.(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const endDrag = (): void => {
    if (!drag.current) return;
    drag.current = null;
    setActive(null);
    onDraggingChange?.(false);
  };

  const points: string = outline.map((p: Corner) => `${p.x},${p.y}`).join(' ');
  const shade: string = `M0 0H${W}V${H}H0Z M${outline.map((p: Corner) => `${p.x} ${p.y}`).join('L')}Z`;
  const arm: number = 26 * unit;
  const hit: number = 26 * unit;

  return (
    <div ref={editorRef} className="editor">
      <svg
        ref={svgRef}
        className="editor-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        data-testid="corner-editor"
      >
        <image href={source.url} width={W} height={H} />
        <path className="editor-shade" d={shade} fillRule="evenodd" />
        <polygon className="editor-outline-halo" points={points} />
        <polygon className="editor-outline" points={points} />
        {outline.map((p: Corner, i: number) => {
          const a: Corner = direction(p, outline[(i + 3) % 4]);
          const b: Corner = direction(p, outline[(i + 1) % 4]);
          const mark: string = `${p.x + a.x * arm},${p.y + a.y * arm} ${p.x},${p.y} ${p.x + b.x * arm},${p.y + b.y * arm}`;
          return (
            <g
              key={i}
              className={`corner${active === i ? ' is-active' : ''}`}
              onPointerDown={onPointerDown(i)}
              data-testid={`corner-${i}`}
            >
              <circle className="corner-hit" cx={p.x} cy={p.y} r={hit} />
              <polyline className="corner-mark-halo" points={mark} />
              <polyline className="corner-mark" points={mark} />
              <circle className="corner-dot" cx={p.x} cy={p.y} r={3.5 * unit} />
            </g>
          );
        })}
      </svg>
      {active !== null && (
        <Loupe
          image={source.image}
          outline={outline}
          index={active}
          unit={unit}
          size={LOUPE_SIZE}
          position={loupePos}
        />
      )}
    </div>
  );
}
