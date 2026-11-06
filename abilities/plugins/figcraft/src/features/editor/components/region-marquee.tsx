import type { JSX, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { RegionRect } from "../services/canvas-shot.ts";
import type { EditorStrings } from "../strings.ts";

/**
 * The area to hand over, drawn over the frame instead of inside it.
 *
 * The canvas is one wasm surface: there are no elements to click, and the page cannot
 * report a selection it does not have. What the shell *can* do is sit above the frame,
 * take the drag, and hand the page a normalized rectangle — `craft:capture` crops by
 * exactly that. So this layer costs the page nothing and needs no bridge change.
 *
 * It is mounted only while `session.picking` is true, which is why it can be a plain
 * full-size overlay: while it exists it *should* swallow the pointer, and the moment it
 * unmounts the canvas is interactive again.
 */

const BAND = "absolute border border-dashed border-sky-400/90 bg-sky-400/15";
const HINT =
  "pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-950/85 px-3 py-1 text-[11px] font-medium text-neutral-200 shadow-lg";

export function RegionMarquee({
  strings,
  onCancel,
  onPicked,
}: {
  strings: EditorStrings;
  onCancel: () => void;
  onPicked: (rect: RegionRect) => void;
}): JSX.Element {
  const [band, setBand] = useState<RegionRect | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  // Esc means no, not "a one-pixel area": the same key that closes the menu closes this.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const fraction = (event: ReactPointerEvent<HTMLDivElement>): { x: number; y: number } => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return { x: 0, y: 0 };
    return {
      x: Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1),
      y: Math.min(Math.max((event.clientY - box.top) / box.height, 0), 1),
    };
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) {
      onCancel();
      return;
    }
    const point = fraction(event);
    origin.current = point;
    setBand({ x: point.x, y: point.y, w: 0, h: 0 });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const start = origin.current;
    if (!start) return;
    const point = fraction(event);
    setBand({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y),
    });
  };

  const up = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!origin.current) return;
    origin.current = null;
    const area = band;
    setBand(null);
    if (area && area.w >= 0.02 && area.h >= 0.02) onPicked(area);
    else onCancel();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  // A band narrower than a fifth of a percent has a sub-pixel width: the box is drawn at
  // a minimum so the drag reads as a rectangle the whole way, not a blinking line.
  const style = band
    ? {
        left: `${band.x * 100}%`,
        top: `${band.y * 100}%`,
        width: `max(${band.w * 100}%, 2px)`,
        height: `max(${band.h * 100}%, 2px)`,
      }
    : null;

  return (
    <div
      className="absolute inset-0 z-40 cursor-crosshair touch-none select-none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      role="presentation"
    >
      <div className="absolute inset-0 bg-neutral-950/25" />
      <p className={HINT}>{strings.regionHint}</p>
      {style ? <div className={BAND} style={style} /> : null}
    </div>
  );
}
