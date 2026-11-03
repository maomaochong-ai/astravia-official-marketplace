import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface ContainerFullscreen {
  containerRef: RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  toggle: () => void;
}

/**
 * Fullscreen on the tab's own shell element, not on the panel and not on the
 * frame: the status bar stays visible so the exit button never disappears, and
 * the state follows `fullscreenchange` so the platform's Esc key resets it.
 *
 * ADR: docs/adr/photocraft/0009-fullscreen-belongs-to-the-frame.md
 */
export function useContainerFullscreen(onError: (message: string) => void): ContainerFullscreen {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = (): void => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", sync);
    sync();
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggle = useCallback((): void => {
    const element = containerRef.current;
    if (!element) return;
    if (document.fullscreenElement === element) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void element.requestFullscreen({ navigationUI: "hide" }).catch((error: unknown) => {
      onError(String((error as Error)?.message ?? error));
    });
  }, [onError]);

  return { containerRef, isFullscreen, toggle };
}
