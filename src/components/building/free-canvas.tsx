"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

export interface CanvasItem {
  id: string;
  href: string;
  node: React.ReactNode;
}

interface Pos {
  x: number;
  y: number;
}

interface Props {
  items: CanvasItem[];
  /** Layout is remembered per list — departments and each department's rooms differ. */
  storageKey: string;
  resetLabel: string;
  eyebrow: string;
  hint: string;
  /** Only an admin arranges the plan; everyone else reads it. */
  editable: boolean;
}

/**
 * The card has a real size in pixels — a card sized as a share of the canvas
 * collapses to an unreadable sliver as soon as the canvas is narrow.
 * Positions stay in percent so an arrangement survives a resize.
 */
const CARD_PX_W = 360;
const CARD_PX_H = 66;
const GAP_PX = 10;
const CANVAS_PX_H = 440;

const DRAG_THRESHOLD_PX = 5;

interface Dims {
  cardW: number;
  cardH: number;
  gapX: number;
  gapY: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function overlaps(a: Pos, b: Pos, d: Dims): boolean {
  return Math.abs(a.x - b.x) < d.cardW + d.gapX && Math.abs(a.y - b.y) < d.cardH + d.gapY;
}

/** `want` if it is clear, otherwise the closest point that clears everything placed. */
function nearestClear(want: Pos, taken: Pos[], d: Dims): Pos {
  const fits = (p: Pos) => !taken.some((o) => overlaps(p, o, d));
  const start = {
    x: clamp(want.x, 0, Math.max(0, 100 - d.cardW)),
    y: clamp(want.y, 0, Math.max(0, 100 - d.cardH)),
  };
  if (fits(start)) return start;

  for (let radius = d.gapY; radius <= 100; radius += d.gapY) {
    for (let step = 0; step < 24; step++) {
      const angle = (step / 24) * 2 * Math.PI;
      const candidate = {
        x: clamp(
          start.x + Math.cos(angle) * radius * (d.cardW / d.cardH),
          0,
          Math.max(0, 100 - d.cardW),
        ),
        y: clamp(start.y + Math.sin(angle) * radius, 0, Math.max(0, 100 - d.cardH)),
      };
      if (fits(candidate)) return candidate;
    }
  }
  return start;
}

function loadLayout(key: string): Record<string, Pos> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, Pos>) : null;
  } catch {
    return null;
  }
}

/**
 * Drag a card anywhere on the canvas — no grid, the drop point is kept as-is.
 *
 * Saved positions are treated as a WISH, not a fact: on every render the cards
 * are packed against the canvas's current size, so a stored arrangement can
 * never leave two cards on top of each other after the panel opens or the
 * window resizes. Positions live in localStorage — a per-device preference.
 */
export function FreeCanvas({
  items,
  storageKey,
  resetLabel,
  eyebrow,
  hint,
  editable,
}: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState({ w: 900, h: CANVAS_PX_H });

  /**
   * Tall enough to hold every card at the current width.
   *
   * A fixed height silently loses cards: once the rows run out, `nearestClear`
   * gives up and returns the wanted point, so the extras land on top of each
   * other. A phone fits one column and hit that at about six rooms — the
   * seventh was simply invisible under the sixth.
   */
  const canvasH = useMemo(() => {
    const columns = Math.max(1, Math.floor((size.w + GAP_PX) / (CARD_PX_W + GAP_PX)));
    const rows = Math.ceil(items.length / columns);
    return Math.max(CANVAS_PX_H, rows * (CARD_PX_H + GAP_PX) + GAP_PX);
  }, [size.w, items.length]);
  const [saved, setSaved] = useState<Record<string, Pos>>({});
  const [dragPos, setDragPos] = useState<{ id: string; pos: Pos } | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: number } | null>(null);

  const dims: Dims = useMemo(
    () => ({
      cardW: (Math.min(CARD_PX_W, size.w) / size.w) * 100,
      cardH: (CARD_PX_H / canvasH) * 100,
      gapX: (GAP_PX / size.w) * 100,
      gapY: (GAP_PX / canvasH) * 100,
    }),
    [size.w, canvasH],
  );

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () =>
      setSize({ w: el.clientWidth || 900, h: el.clientHeight || CANVAS_PX_H });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Read the saved layout after mount so server and client markup match.
  // localStorage cannot be read during the server render, and a lazy initial
  // state would make the two disagree — an effect is the correct place.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setSaved(loadLayout(storageKey) ?? {});
  }, [storageKey]);

  /** Effective positions: every card placed, none overlapping. */
  const layout = useMemo(() => {
    const placed: Record<string, Pos> = {};
    const taken: Pos[] = [];

    items.forEach((item, i) => {
      const fallback = { x: dims.gapX, y: dims.gapY + i * (dims.cardH + dims.gapY) };
      const pos = nearestClear(saved[item.id] ?? fallback, taken, dims);
      placed[item.id] = pos;
      taken.push(pos);
    });

    return placed;
  }, [items, saved, dims]);

  const posOf = (id: string): Pos =>
    dragPos?.id === id ? dragPos.pos : (layout[id] ?? { x: 0, y: 0 });

  const customised = Object.keys(saved).length > 0;

  function persist(next: Record<string, Pos>) {
    setSaved(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // A full or blocked storage must not break dragging.
    }
  }

  /**
   * Controls inside a card (delete, rename) must not start a drag or navigate.
   *
   * The tag check matters as much as the attribute: the card answers Space and
   * Enter by opening itself, so a space typed into a rename field bubbled up
   * here and jumped to the next level mid-word. Text input wins over the
   * shortcut whenever the two collide.
   */
  function fromControl(event: { target: EventTarget | null }): boolean {
    const el = event.target as HTMLElement | null;
    if (!el?.closest) return false;
    return Boolean(el.closest("[data-no-drag], input, textarea, select, button, [contenteditable]"));
  }

  function onPointerDown(event: React.PointerEvent, id: string) {
    if (!editable || event.button !== 0 || fromControl(event)) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pos = posOf(id);
    drag.current = {
      id,
      dx: ((event.clientX - rect.left) / rect.width) * 100 - pos.x,
      dy: ((event.clientY - rect.top) / rect.height) * 100 - pos.y,
      moved: 0,
    };
    setDragPos({ id, pos });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!state || !rect) return;

    state.moved += Math.abs(event.movementX) + Math.abs(event.movementY);

    setDragPos({
      id: state.id,
      pos: {
        x: clamp(
          ((event.clientX - rect.left) / rect.width) * 100 - state.dx,
          0,
          100 - dims.cardW,
        ),
        y: clamp(
          ((event.clientY - rect.top) / rect.height) * 100 - state.dy,
          0,
          100 - dims.cardH,
        ),
      },
    });
  }

  function onPointerUp(event: React.PointerEvent, id: string, href: string) {
    if (fromControl(event)) return;

    // Read-only viewers never start a drag, so a release is always a click.
    if (!editable) {
      router.push(href);
      return;
    }

    const state = drag.current;
    const dropped = dragPos?.pos;
    drag.current = null;
    setDragPos(null);
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    if (!state) return;

    // A press that barely moved is a click, not a drag.
    if (state.moved < DRAG_THRESHOLD_PX) {
      router.push(href);
      return;
    }
    if (dropped) persist({ ...saved, [id]: dropped });
  }

  function nudge(id: string, dx: number, dy: number) {
    if (!editable) return;
    const pos = posOf(id);
    persist({
      ...saved,
      [id]: {
        x: clamp(pos.x + dx, 0, 100 - dims.cardW),
        y: clamp(pos.y + dy, 0, 100 - dims.cardH),
      },
    });
  }

  function reset() {
    setSaved({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span
          className="text-[11px] font-medium tracking-[0.08em] uppercase"
          style={{ color: "var(--ink-muted)" }}
        >
          {eyebrow}
        </span>
        {editable && customised ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: "var(--ink-secondary)" }}
          >
            <RotateCcw size={12} aria-hidden />
            {resetLabel}
          </button>
        ) : null}
      </div>

      <div
        ref={canvasRef}
        className="relative w-full select-none"
        style={{ height: canvasH }}
      >
        {items.map((item) => {
          const pos = posOf(item.id);
          const dragging = dragPos?.id === item.id;

          return (
            <div
              key={item.id}
              role="link"
              tabIndex={0}
              onPointerDown={(e) => onPointerDown(e, item.id)}
              onPointerMove={onPointerMove}
              onPointerUp={(e) => onPointerUp(e, item.id, item.href)}
              onKeyDown={(e) => {
                if (fromControl(e)) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(item.href);
                } else if (e.altKey) {
                  // Alt+Arrow moves a card without a pointer.
                  const step: Record<string, [number, number]> = {
                    ArrowLeft: [-4, 0],
                    ArrowRight: [4, 0],
                    ArrowUp: [0, -6],
                    ArrowDown: [0, 6],
                  };
                  const delta = step[e.key];
                  if (delta) {
                    e.preventDefault();
                    nudge(item.id, delta[0], delta[1]);
                  }
                }
              }}
              className={`absolute ${
                editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
              }`}
              style={{
                /*
                 * Scrolling wins over dragging on a touch screen.
                 *
                 * This was `touch-action: none` for every card, including for
                 * viewers who cannot drag at all — and on a phone the canvas is
                 * a column of full-width cards, so a finger almost always lands
                 * on one and the page simply refused to scroll.
                 *
                 * `pan-y` keeps vertical scrolling with the browser and leaves
                 * horizontal movement to the drag handler; a mouse is unaffected
                 * either way.
                 */
                touchAction: editable ? "pan-y" : "auto",
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `min(${CARD_PX_W}px, 100%)`,
                height: CARD_PX_H,
                zIndex: dragging ? 20 : 1,
                boxShadow: dragging ? "0 8px 24px rgb(0 0 0 / 0.35)" : undefined,
                borderRadius: 12,
                // Only animate the settle, never the drag itself.
                transition: dragging ? undefined : "left 140ms, top 140ms, box-shadow 140ms",
              }}
            >
              {item.node}
            </div>
          );
        })}
      </div>

      {/* Outside the canvas, so no card can ever sit on top of it. */}
      <p className="mt-2 text-xs" style={{ color: "var(--ink-muted)" }}>
        {hint}
      </p>
    </div>
  );
}
