import type { Capabilities, ToolCapability } from "./media-info";

/** A tool the plugin cannot run right now; also the fallback when the service omits it. */
export const MISSING_TOOL: ToolCapability = { available: false, path: null, version: null, source: null };

export type ToolName = keyof Capabilities;

function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asTool(value: unknown): ToolCapability {
  if (!value || typeof value !== "object") return MISSING_TOOL;
  const record = value as Record<string, unknown>;
  const source = record.source === "bundled" || record.source === "path" ? record.source : null;
  return {
    available: record.available === true,
    path: asText(record.path),
    version: asText(record.version),
    source,
  };
}

/**
 * `/api/v1/capabilities` answers with a flat `{ lux, ytdlp, ffmpeg }` object; an earlier build
 * wrapped it as `{ capabilities: { … } }`. Accepting both keeps a shape drift from crashing the
 * panel, which previously read `capabilities.lux.available` on an object that only had `ffmpeg`.
 */
export function normalizeCapabilities(payload: unknown): Capabilities {
  if (!payload || typeof payload !== "object") {
    return { lux: MISSING_TOOL, ytdlp: MISSING_TOOL, ffmpeg: MISSING_TOOL };
  }
  const record = payload as Record<string, unknown>;
  const inner = record.capabilities;
  const body = inner && typeof inner === "object" ? (inner as Record<string, unknown>) : record;
  // `ytdlp` is absent from services older than 1.3.0; the missing-tool default covers that.
  return { lux: asTool(body.lux), ytdlp: asTool(body.ytdlp), ffmpeg: asTool(body.ffmpeg) };
}

/** Read one tool without trusting that the payload carried every key. */
export function toolCapability(
  capabilities: Capabilities | null | undefined,
  tool: ToolName,
): ToolCapability {
  return capabilities?.[tool] ?? MISSING_TOOL;
}
