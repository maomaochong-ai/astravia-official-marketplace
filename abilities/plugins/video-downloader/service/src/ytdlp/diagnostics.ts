/** Failure codes shared with the panel; the frontend owns the localized wording. */
export type EngineFailureCode =
  | "engine_unavailable"
  | "network_timeout"
  | "network_blocked"
  | "auth_required"
  | "site_blocked"
  | "site_unsupported";

const ERROR_PREFIX = /^ERROR:\s*/iu;

/**
 * Reduce yt-dlp's stderr to the first real error.
 *
 * The engine prints one `ERROR:` line per failure and may follow it with a traceback or a
 * hint block, neither of which belongs in a task message.
 */
export function firstYtdlpErrorLine(stderr: string): string | null {
  for (const line of stderr.split(/\r?\n/u)) {
    const text = line.trim();
    if (!text) continue;
    if (/^ERROR:/iu.test(text)) return text.replace(ERROR_PREFIX, "").trim();
  }
  for (const line of stderr.split(/\r?\n/u)) {
    const text = line.trim();
    if (!text || text.startsWith("WARNING:") || text.startsWith("[")) continue;
    return text;
  }
  return null;
}

/**
 * Classify a yt-dlp failure.
 *
 * Cookie hints come first on purpose: yt-dlp names the missing session explicitly
 * (`Fresh cookies (not necessarily logged in) are needed`), and that is actionable, whereas a
 * bare `403` on the same page is the engine reporting the site's anti-bot refusal.
 */
export function codeOfYtdlpFailure(text: string): EngineFailureCode {
  const message = text.toLowerCase();
  if (/fresh cookies|cookies? (?:are )?(?:needed|required)|login required|sign in to confirm|private video|members[- ]only|only available to/.test(message)) {
    return "auth_required";
  }
  if (/timed out|timeout|temporary failure in name resolution/.test(message)) return "network_timeout";
  if (/unable to download webpage|connection (?:refused|reset|aborted)|getaddrinfo|name or service not known|failed to resolve|network is unreachable|certificate|ssl:|proxy/.test(message)) {
    return "network_blocked";
  }
  if (/403|forbidden|captcha|anti-?bot|blocked|rate.?limit|too many requests|429/.test(message)) return "site_blocked";
  return "site_unsupported";
}

/** Extract a URL from yt-dlp's `Unable to download ...` framing when the engine reports one. */
export function describeYtdlpFailure(text: string): string {
  const line = text.trim();
  if (!line) return "yt-dlp 未能解析该链接";
  return line.slice(0, 240);
}
