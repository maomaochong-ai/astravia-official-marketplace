import { runCommand } from "../process/run-command.js";
import type { MediaItem, MediaProbeResult } from "../media/types.js";
import { codeOfYtdlpFailure, describeYtdlpFailure, firstYtdlpErrorLine, type EngineFailureCode } from "./diagnostics.js";
import { flattenYtdlpEntries, normalizeYtdlpInfo, type YtdlpRawInfo } from "./normalize.js";

export interface YtdlpProbeOptions {
  /** Path to a prepared Netscape cookie file, when the user configured a session. */
  cookieFile?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface YtdlpProbeOutcome extends MediaProbeResult {
  failure: string | null;
  failureCode: EngineFailureCode | null;
}

const PROBE_TIMEOUT_MS = 90_000;

/** Parse `--dump-single-json` output, tolerating a leading banner line. */
export function parseYtdlpProbeOutput(stdout: string): YtdlpRawInfo | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  const direct = tryParseObject(trimmed);
  if (direct) return direct;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return tryParseObject(trimmed.slice(start, end + 1));
  return null;
}

function tryParseObject(text: string): YtdlpRawInfo | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as YtdlpRawInfo) : null;
  } catch {
    return null;
  }
}

export async function probeWithYtdlp(
  ytdlpPath: string,
  url: string,
  options: YtdlpProbeOptions = {},
): Promise<YtdlpProbeOutcome> {
  const startedAt = Date.now();
  const args = ["--dump-single-json", "--no-warnings", "--no-playlist", "--no-progress", "--socket-timeout", "25"];
  if (options.cookieFile) args.push("--cookies", options.cookieFile);
  args.push(url);

  const result = await runCommand(ytdlpPath, args, {
    timeoutMs: options.timeoutMs ?? PROBE_TIMEOUT_MS,
    signal: options.signal,
  });
  const elapsedMs = Date.now() - startedAt;
  const info = parseYtdlpProbeOutput(result.stdout);

  if (!info) {
    if (result.timedOut) {
      return { items: [], failure: "解析超时，请稍后重试", failureCode: "network_timeout", elapsedMs };
    }
    const line = firstYtdlpErrorLine(result.stderr) ?? "";
    return {
      items: [],
      failure: line ? describeYtdlpFailure(line) : "没有从该链接解析出可下载的媒体",
      failureCode: line ? codeOfYtdlpFailure(line) : null,
      elapsedMs,
    };
  }

  const items: MediaItem[] = [];
  flattenYtdlpEntries(info).forEach((entry, index) => {
    const item = normalizeYtdlpInfo(entry, index);
    if (item) items.push(item);
  });

  if (items.length > 0) return { items, failure: null, failureCode: null, elapsedMs };

  // yt-dlp found the page but no rendition: report the engine's own reason when it has one.
  const line = firstYtdlpErrorLine(result.stderr) ?? "";
  return {
    items,
    failure: line ? describeYtdlpFailure(line) : "该链接没有可下载的音视频流",
    failureCode: line ? codeOfYtdlpFailure(line) : "site_unsupported",
    elapsedMs,
  };
}
