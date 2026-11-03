import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface ContainerFullscreen {
  containerRef: RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  /** True when the platform refused the Fullscreen API and the shell took over. */
  overlay: boolean;
  toggle: () => void;
}

/**
 * Fullscreen on the tab's own shell element, not on the panel and not on the
 * frame: the status bar stays visible so the exit control never disappears, and
 * the state follows `fullscreenchange` so the platform's Esc key resets it.
 *
 * The Fullscreen API is not always available to us: a desktop host may mount the
 * plugin UI in a frame without `allow="fullscreen"`, and `requestFullscreen()`
 * then rejects. The button must still do something and, more importantly, must
 * still undo it — so a refusal falls back to covering the viewport with the same
 * element and Escape (or the same button) leaves that state too.
 *
 * ADR: docs/adr/<slug>/craft-0010-icons-only-and-a-fullscreen-that-returns.md
 */
export function useContainerFullscreen(onError: (message: string) => void): ContainerFullscreen {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [overlay, setOverlay] = useState(false);

  useEffect(() => {
    const sync = (): void => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", sync);
    sync();
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!overlay) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOverlay(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [overlay]);

  const toggle = useCallback((): void => {
    const element = containerRef.current;
    if (!element) return;
    if (document.fullscreenElement === element) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (overlay) {
      setOverlay(false);
      return;
    }
    const fallback = (): void => setOverlay(true);
    try {
      const pending = element.requestFullscreen({ navigationUI: "hide" });
      void pending.then(
        () => setOverlay(false),
        (error: unknown) => {
          onError(String((error as Error)?.message ?? error));
          fallback();
        },
      );
    } catch (error) {
      onError(String((error as Error)?.message ?? error));
      fallback();
    }
  }, [onError, overlay]);

  return { containerRef, isFullscreen: isFullscreen || overlay, overlay, toggle };
}
