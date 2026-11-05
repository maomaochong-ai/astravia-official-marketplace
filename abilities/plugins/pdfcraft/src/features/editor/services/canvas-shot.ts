import type { PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../../../app.config.ts";
import { bytesToBase64 } from "../../../shared/formatters/base64.ts";
import type { LinkMessage } from "../../../domain/link-protocol.ts";
import { askCraftFrame, craftWorkspace, recordCraftShot } from "../session-registry.ts";

/**
 * A picture of the canvas, on disk, where the Agent can look at it.
 *
 * A tool result reaches the model as text, so `craft:probe` describes the canvas
 * instead of showing it: a letter map tells a photo from an empty frame and a blue
 * background from a grey one, and nothing more. That is the right trade for a loop
 * that has to stay cheap, and the wrong one for "the layer is misaligned", "the type
 * is too tight", "the gradient bands" — judgements that only exist in the pixels.
 *
 * So the page also hands over the real thing, and the tool writes it into the
 * project as `<cwd>/.craft/shots/`. The path comes back in the result, the model
 * reads that file with its own tools, and the panel keeps showing the same canvas.
 * Under `ctx.fs` the destination has to be inside the open project, which is also
 * where a person would expect a screenshot to land.
 *
 * Shots are rotated (newest `KEEP` kept): a debugging aid that quietly fills a
 * repository is worse than no aid at all.
 *
 * ADR: docs/adr/<slug>/craft-0019-the-agent-looks-at-the-picture.md
 */
export const SHOT_DIR = ".craft/shots";
const KEEP = 6;
const CAPTURE_TIMEOUT_MS = 30_000;

export interface CanvasShot {
  /** Absolute path, so the model can read it without guessing the project root. */
  path: string;
  name: string;
  width: number | null;
  height: number | null;
  bytes: number;
}

export interface ShotRequest {
  /** Extra PNG copies for the same call: a region zoom, or a step-by-step capture. */
  region?: { x: number; y: number; w: number; h: number };
  scale?: number;
  /** Slug in the file name, e.g. `act` or `probe`, so six shots stay readable. */
  tag?: string;
}

function stamp(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}` +
    `-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`
  );
}

async function ensureDir(ctx: PluginContext, dir: string): Promise<boolean> {
  try {
    await ctx.fs.createDirectory(dir);
    return true;
  } catch {
    // Already there is the ordinary case; a real failure surfaces on the write.
    try {
      const entries = await ctx.fs.readDir(dir);
      return Array.isArray(entries);
    } catch {
      return false;
    }
  }
}

/** Newest first, by the sortable stamp in the name. */
async function prune(ctx: PluginContext, dir: string): Promise<void> {
  try {
    const entries = await ctx.fs.readDir(dir);
    const mine = entries
      .filter((entry) => !entry.isDirectory && entry.name.startsWith(`${APP.id}-`) && entry.name.endsWith(".png"))
      .map((entry) => entry.name)
      .sort()
      .reverse();
    for (const name of mine.slice(KEEP)) {
      await ctx.fs.delete(`${dir}/${name}`);
    }
  } catch {
    /* rotation is housekeeping: never let it fail the call that asked for a picture */
  }
}

/**
 * Capture one PNG and write it into the project. `null` when the frame cannot
 * capture or the project has no writable directory — the caller then reports the
 * text probe alone, which is still true.
 */
export async function saveCanvasShot(ctx: PluginContext, request: ShotRequest = {}): Promise<CanvasShot | null> {
  const cwd = craftWorkspace();
  if (!cwd) return null;
  let reply: LinkMessage;
  try {
    reply = await askCraftFrame(
      "craft:capture",
      { name: `${APP.id}.png`, region: request.region, scale: request.scale ?? 1 },
      CAPTURE_TIMEOUT_MS,
    );
  } catch {
    return null;
  }
  if (!reply.bytes) return null;

  const dir = `${cwd}/${SHOT_DIR}`;
  if (!(await ensureDir(ctx, dir))) return null;

  const name = `${APP.id}-${request.tag ?? "shot"}-${stamp(new Date())}.png`;
  const path = `${dir}/${name}`;
  const bytes = new Uint8Array(reply.bytes);
  try {
    await ctx.fs.writeFile(path, bytesToBase64(bytes), "base64");
  } catch {
    return null;
  }
  await prune(ctx, dir);
  recordCraftShot(path);
  return {
    path,
    name,
    width: typeof reply.width === "number" ? reply.width : null,
    height: typeof reply.height === "number" ? reply.height : null,
    bytes: bytes.byteLength,
  };
}

/**
 * Show the shot to the *person*, not just to the model.
 *
 * A returned path is invisible to whoever is watching: it is a string in a tool
 * result. `ui.previewFile` hands the same file to the host's own previewer, so
 * the picture opens inside Astravia where the user already is — the mirror of
 * what `craft:capture` does for the model. Nothing is copied and no bytes cross
 * the boundary; the host reads the path itself (hence `fs.read`).
 *
 * Best effort on purpose: an older host without `previewFile`, a refused path,
 * or a user who closed the previewer must never turn a working tool into a
 * failed one. The return value only drives whether the result admits it.
 */
export function previewCanvasShot(ctx: PluginContext, shot: CanvasShot | null): boolean {
  if (!shot) return false;
  const ui = ctx.ui as { previewFile?: (file: { path?: string; name?: string; mimeType?: string }) => void };
  if (typeof ui.previewFile !== "function") return false;
  try {
    ui.previewFile({ path: shot.path, name: shot.name, mimeType: "image/png" });
    return true;
  } catch {
    return false;
  }
}
