import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";

interface MediaPlayerProps {
  url: string;
  kind: "hls" | "file" | null;
  poster: string;
  label: string;
  fullscreenLabel: string;
}

/**
 * One `<video>` for both shapes the service hands back: a single file plays as-is, an HLS playlist
 * goes through hls.js because Chromium has no native support for it. Both URLs are already proxied
 * by the service, so a platform that requires a Referer keeps working here.
 */
export function MediaPlayer({ url, kind, poster, label, fullscreenLabel }: MediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (kind === "hls" && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(url);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
    video.src = url;
    return () => {
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
