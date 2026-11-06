import type { CSSProperties, JSX } from "react";
import { useEffect, useRef } from "react";
import type { EditorStrings } from "../strings.ts";

/**
 * The three buttons that used to float over the canvas, plus the one the canvas needed.
 *
 * They were moved here because a pill resting at 45 % opacity in the top-right corner is
 * still a pill over the artwork, and the corner is exactly where upstream puts its own
 * history and zoom controls. A right-click is where the pointer already is, costs no
 * pixels, and cannot collide with the app's layout. Holding Shift over the canvas leaves
 * the press to the app, so upstream's own menu is still one key away.
 */

const CATCHER = "absolute inset-0 z-30";
const MENU =
  "absolute z-40 min-w-[190px] rounded-lg border border-white/10 bg-[#0b0d10]/95 p-1 text-[12px] text-neutral-300 shadow-2xl backdrop-blur";
const ROW =
  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-neutral-100";

export interface FrameMenuProps {
  strings: EditorStrings;
  /** Reported by the page, in fractions of the canvas: the menu opens where it was pressed. */
  point: { x: number; y: number };
  onClose: () => void;
  onRegion: () => void;
  onPage: () => void;
  onReload: () => void;
  onToggleFullscreen: () => void;
  fullscreen: boolean;
  disabled: boolean;
}

export function FrameMenu(props: FrameMenuProps): JSX.Element {
  const { strings, point, onClose } = props;
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Flip the menu back inside the panel when the press lands near the right or bottom
  // edge: a menu that opens off-screen is a menu nobody can use.
  const flipX = point.x > 0.7;
  const flipY = point.y > 0.7;
  const style: CSSProperties = {
    left: `${point.x * 100}%`,
    top: `${point.y * 100}%`,
    transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`,
  };

  return (
    <>
      <div
        className={CATCHER}
        onPointerDown={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
        role="presentation"
      />
      <div ref={menuRef} className={MENU} style={style} role="menu">
        <button
          type="button"
          className={ROW}
          role="menuitem"
          disabled={props.disabled}
          onClick={props.onRegion}
        >
          {strings.menuRegion}
        </button>
        <button
          type="button"
          className={ROW}
          role="menuitem"
          disabled={props.disabled}
          onClick={props.onPage}
        >
          {strings.menuPage}
        </button>
        <div className="my-1 h-px bg-white/10" />
        <button type="button" className={ROW} role="menuitem" onClick={props.onReload}>
          {strings.reload}
        </button>
        <button
          type="button"
          className={ROW}
          role="menuitem"
          onClick={props.onToggleFullscreen}
        >
          {props.fullscreen ? strings.exitFullscreen : strings.fullscreen}
        </button>
      </div>
    </>
  );
}
