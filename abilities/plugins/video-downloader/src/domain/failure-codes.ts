/**
 * Service failures arrive with a machine readable code so the panel can explain them in the
 * user's language instead of showing the raw engine output.
 */
const FAILURE_MESSAGE_KEYS: Record<string, string> = {
  engine_unavailable: "error.serviceUnavailable",
  engine_preparing: "error.enginePreparing",
  ffmpeg_required: "error.ffmpegPreparing",
  network_timeout: "error.networkTimeout",
  network_blocked: "error.networkBlocked",
  auth_required: "error.authRequired",
  site_blocked: "error.siteBlocked",
  site_unsupported: "error.siteUnsupported",
  site_upstream_broken: "error.siteUpstreamBroken",
  site_offline: "error.siteOffline",
};

export function failureMessageKey(code: string | null | undefined): string | null {
  return code ? (FAILURE_MESSAGE_KEYS[code] ?? null) : null;
}
