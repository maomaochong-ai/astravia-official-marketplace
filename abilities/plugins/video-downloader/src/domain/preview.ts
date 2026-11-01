/**
 * A preview session lives on the loopback service: the page that owns the media is the only place
 * that can present the right Referer, so the panel never talks to the platform itself. What comes
 * back is a root-relative `entry` that the service already rewritten to its own proxy.
 */
export interface PreviewSession {
  key: string;
  kind: "hls" | "file";
  entry: string;
  contentType: string;
  bytes: number | null;
  /** False when the service fetched a playlist but a segment was refused; `detail` says which. */
  playable: boolean;
  detail: string | null;
}

export interface PreviewOpenInput {
  url: string;
  headers?: Record<string, string>;
}

/** Joins the service base URL with a session entry, tolerating either shape of base. */
export function previewEntryUrl(baseUrl: string, entry: string): string {
  const base = baseUrl.replace(/\/+$/u, "");
  return `${base}${entry.startsWith("/") ? entry : `/${entry}`}`;
}
