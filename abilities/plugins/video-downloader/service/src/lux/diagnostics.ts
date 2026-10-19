const ANSI = /\u001b\[[0-9;]*m/gu;

/**
 * lux prints a Go stack trace after most failures (`debug.PrintStack`), so the last lines of
 * stderr are frame addresses rather than the reason. Frame lines are either indented or are
 * `module/path.go:12` references, which is what this matches.
 */
const STACK_FRAME = /^(?:\t| {2,})|^(?:[\w./-]+\.go:\d+|github\.com\/|golang\.org\/|runtime\.|net\/|syscall\.|main\.|os\/|io\/|bytes\.|internal\/)/u;
const PROGRESS_LINE = /^(?:\[|Downloading.*\d+%|\d+(?:\.\d+)?%)/u;

export type LuxFailureCode =
  | "network_blocked"
  | "network_timeout"
  /** The site wants a signed-in session; a cookie makes the request succeed. */
  | "auth_required"
  /** The site rejected the request itself (403, bot check). A cookie does not help. */
  | "site_blocked"
  | "site_unsupported"
  | "unknown";

export interface LuxFailure {
  code: LuxFailureCode;
  /** Short human readable reason with the stack frames removed. */
  detail: string;
}

function significantLines(stderr: string, stdout: string): string[] {
  return `${stderr}\n${stdout}`
    .replace(ANSI, "")
    .split("\n")
    .filter((line) => line.trim().length > 0 && !STACK_FRAME.test(line) && !PROGRESS_LINE.test(line.trim()))
    .map((line) => line.trim());
}

function codeOf(detail: string): LuxFailureCode {
  if (/i\/o timeout|context deadline exceeded|operation timed out|timed out|timeout/iu.test(detail)) {
    return "network_timeout";
  }
  if (/no such host|server misbehaving|connection reset|connection refused|network is unreachable|TLS handshake|EOF\b|dial tcp/iu.test(detail)) {
    return "network_blocked";
  }
  // 403 is the site rejecting the client (signature, bot check), not a missing login: telling
  // the user to paste a cookie here would never work, so the two codes stay separate.
  if (/\b403\b|forbidden|blocked by|access denied|captcha|rate limit|too many requests/iu.test(detail)) {
    return "site_blocked";
  }
  if (/\b401\b|unauthorized|sign in|login required|cookie/iu.test(detail)) {
    return "auth_required";
  }
  if (/\b404\b|not found|unsupported|no match|no extractor/iu.test(detail)) {
    return "site_unsupported";
  }
  return "unknown";
}

/**
 * Reduce lux output to the one line that explains a failure.
 *
 * `lux -j <url> error: <cause>` is the shape upstream uses; everything after it on the same
 * line is the cause, and the following lines are the stack.
 */
export function summarizeLuxFailure(stderr: string, stdout: string): LuxFailure | null {
  const lines = significantLines(stderr, stdout);
  if (lines.length === 0) return null;
  const index = lines.findIndex((line) => /\berror:/iu.test(line));
  if (index < 0) {
    const detail = (lines[0] ?? "").slice(0, 400);
    return detail ? { code: codeOf(detail), detail } : null;
  }

  const line = lines[index] ?? "";
  const inline = line.slice(line.search(/\berror:/iu) + "error:".length).trim();
  // `lux … error:` leaves the cause on the next line, and the frames after that are noise.
  const detail = (inline || lines.slice(index + 1).find((next) => !STACK_FRAME.test(next)) || "").slice(0, 400);
  if (!detail) return null;
  return { code: codeOf(detail), detail };
}

/** Fallback sentence for callers that cannot localize (MCP tool results). */
export function describeLuxFailure(failure: LuxFailure): string {
  switch (failure.code) {
    case "network_timeout":
      return "连接该站点超时，请检查网络或代理后重试";
    case "network_blocked":
      return "无法连接该站点，请检查网络或代理后重试";
    case "auth_required":
      return "该站点需要登录，请在设置里填写 Cookie 后重试";
    case "site_blocked":
      return "站点拒绝了本次请求（反爬校验），稍后重试可能有效，但当前无法抓取这个页面";
    case "site_unsupported":
      return "该链接暂不支持解析，请确认它是受支持的视频页面";
    default:
      return failure.detail;
  }
}
