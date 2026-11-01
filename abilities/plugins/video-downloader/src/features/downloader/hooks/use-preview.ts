import { useEffect, useRef, useState } from "react";

import { previewEntryUrl, type PreviewSession } from "../../../domain/preview";
import type { MediaFormat, MediaItem } from "../../../domain/media-info";
import type { DownloaderApi } from "../../../services/downloader-api";

export interface PreviewController {
  loading: boolean;
  error: string | null;
  /** Absolute URL the player should open, already rewritten to the service proxy. */
  url: string | null;
  kind: "hls" | "file" | null;
  retry(): void;
}

/**
 * Opens one preview session for the address the user is looking at. The service holds the platform
 * headers, so a link that only works with a Referer still plays here without the panel ever
 * contacting the site.
 */
export function usePreview(api: DownloaderApi, item: MediaItem | null, format: MediaFormat | null): PreviewController {
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const activeKey = useRef<string | null>(null);

  const directUrl = format?.directUrl ?? "";
  const headers = format?.headers;

  useEffect(() => {
    const target = directUrl;
    if (!target) {
      setSession(null);
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [opened, baseUrl] = await Promise.all([
          api.previewOpen({ url: target, headers }),
          api.serviceBaseUrl(),
        ]);
        if (cancelled) {
          void api.previewClose(opened.key).catch(() => undefined);
          return;
        }
        activeKey.current = opened.key;
        setSession(opened);
        setUrl(previewEntryUrl(baseUrl, opened.entry));
      } catch (cause) {
        if (!cancelled) {
          setSession(null);
          setUrl(null);
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, directUrl, headers, attempt]);

  // Sessions are cheap but bounded on the service, so give each one back when it is replaced.
  useEffect(() => {
    return () => {
      const key = activeKey.current;
      activeKey.current = null;
      if (key) void api.previewClose(key).catch(() => undefined);
    };
  }, [api, directUrl]);

  return {
    loading,
    error,
    url: item && url ? url : null,
    kind: session?.kind ?? null,
    retry: () => setAttempt((value) => value + 1),
  };
}
