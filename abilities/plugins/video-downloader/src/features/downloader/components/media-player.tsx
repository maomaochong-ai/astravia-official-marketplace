import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";

interface MediaPlayerProps {
  url: string;
  kind: "hls" | "file" | null;
  poster: string;
  label: string;
  fullscreenLabel: string;
  /** Called once per failed load with a short machine token, e.g. `hls_network_403`. */
  onError(message: string): void;
}

/**
 * One `<video>` for both shapes the service hands back: a single file plays as-is, an HLS playlist
 * goes through hls.js because Chromium has no native support for it. Both URLs are already proxied
 * by the service, so a platform that requires a Referer keeps working here.
 *
 * Every failure is reported upward instead of leaving a black frame: the service forwards the
 * upstream status verbatim, and a platform that refuses a segment is the normal case, not an
 * exception.
 */
export function MediaPlayer({ url, kind, poster, label, fullscreenLabel, onError }: MediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // Kept in a ref so a caller passing an inline arrow does not tear the player down each render.
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const fail = (message: string) => onErrorRef.current(message);
    const onVideoError = () => {
      const code = video.error?.code ?? 0;
      fail(code ? `media_${code}` : "media_unknown");
    };
    video.addEventListener("error", onVideoError);

    if (kind === "hls" && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        const status = (data.response as { code?: number } | undefined)?.code;
        fail(status ? `hls_${data.type}_${status}` : `hls_${data.type}`);
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      return () => {
        video.removeEventListener("error", onVideoError);
        hls.destroy();
      };
    }

    video.src = url;
    return () => {
      video.removeEventListener("error", onVideoError);
      video.removeAttribute("src");
      video.load();
    };
  }, [url, kind]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await containerRef.current?.requestFullscreen();
  }

  return (
    <div ref={containerRef} className="overflow-hidden rounded-2xl border border-border bg-black">
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={poster || undefined}
        className="aspect-video w-full bg-black"
      />
      <div className="flex items-center justify-between gap-2 bg-black/80 px-2 py-1.5">
        <span className="truncate text-[11px] text-white/60">{label}</span>
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          title={fullscreenLabel}
          className="inline-flex h-6 items-center gap-1 rounded-full border border-white/20 px-2 text-[11px] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span
            className={`icon-[solar--${fullscreen ? "minimize-square-2" : "maximize-square-2"}-linear] size-3`}
            aria-hidden="true"
          />
          {fullscreenLabel}
        </button>
      </div>
    </div>
  );
}
