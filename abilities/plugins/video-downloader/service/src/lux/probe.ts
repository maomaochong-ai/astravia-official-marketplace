import { runCommand } from "../process/run-command.js";
import { describeLuxFailure, summarizeLuxFailure, type LuxFailureCode } from "./diagnostics.js";
import { normalizeProbe, probeFailureReason } from "../media/normalize.js";
import type { LuxRawData, MediaProbeResult } from "../media/types.js";

export interface ProbeOptions {
  cookie?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ProbeOutcome extends MediaProbeResult {
  failure: string | null;
  failureCode: LuxFailureCode | null;
  raw: string;
}

const PROBE_TIMEOUT_MS = 90_000;

/**
 * `lux -j` writes a single JSON array to stdout. Upstream prints coloured diagnostics on
 * the same stream for some failure modes, so fall back to slicing the first bracketed
 * block before giving up.
 */
export function parseProbeOutput(stdout: string): LuxRawData[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  const direct = tryParseArray(trimmed);
  if (direct) return direct;
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start >= 0 && end > start) {
    const sliced = tryParseArray(trimmed.slice(start, end + 1));
    if (sliced) return sliced;
  }
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      const single = JSON.parse(trimmed.slice(objectStart, objectEnd + 1)) as unknown;
      if (single && typeof single === "object") return [single as LuxRawData];
    } catch {
      // Not JSON at all.
    }
  }
  return [];
}

function tryParseArray(text: string): LuxRawData[] | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((entry): entry is LuxRawData => !!entry && typeof entry === "object");
    if (parsed && typeof parsed === "object") return [parsed as LuxRawData];
    return null;
  } catch {
    return null;
  }
}

export async function probeMedia(luxPath: string, url: string, options: ProbeOptions = {}): Promise<ProbeOutcome> {
  const startedAt = Date.now();
  const args = ["-j"];
  if (options.cookie?.trim()) args.push("-c", options.cookie.trim());
  args.push(url);

  const result = await runCommand(luxPath, args, {
    timeoutMs: options.timeoutMs ?? PROBE_TIMEOUT_MS,
    signal: options.signal,
  });
  const elapsedMs = Date.now() - startedAt;
  const data = parseProbeOutput(result.stdout);

  if (data.length === 0) {
    if (result.timedOut) {
      return { items: [], failure: "解析超时，请稍后重试", failureCode: "network_timeout", raw: result.stdout, elapsedMs };
    }
    const failure = summarizeLuxFailure(result.stderr, result.stdout);
    return {
      items: [],
      failure: failure ? describeLuxFailure(failure) : "没有从该链接解析出可下载的媒体",
      failureCode: failure?.code ?? null,
      raw: result.stdout,
      elapsedMs,
    };
  }

  const items = normalizeProbe(data);
  if (items.length > 0) return { items, failure: null, failureCode: null, raw: result.stdout, elapsedMs };
  const failure = summarizeLuxFailure(result.stderr, result.stdout);
  return {
    items,
    failure: probeFailureReason(data) ?? (failure ? describeLuxFailure(failure) : null),
    failureCode: failure?.code ?? null,
    raw: result.stdout,
    elapsedMs,
  };
}
