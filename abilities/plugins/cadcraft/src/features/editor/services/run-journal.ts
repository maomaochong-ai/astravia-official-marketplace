import type { PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../../../app.config.ts";
import { base64ToBytes, bytesToBase64 } from "../../../shared/formatters/base64.ts";
import { craftWorkspace } from "../session-registry.ts";

/**
 * What the Agent did, on disk, one line per call.
 *
 * The reason this exists is the next decision, not this one: nothing in the plugin knows
 * whether a click missed a button or missed a menu item, so "should we add OCR anchors"
 * cannot be answered from the code — only from real failures. A tool result lives for one
 * turn; this keeps the trajectory long enough to count.
 *
 * One file per day, seven files kept. Old entries are worth less than a repository that
 * stays clean, and rotation is the same housekeeping `shots/` already does.
 */

export const JOURNAL_DIR = `.craft/${APP.id}/runs`;

/** How many day files survive rotation. */
export const JOURNAL_KEEP = 7;

/** Refuse to grow a single day past this; a runaway loop should not fill the project. */
const JOURNAL_MAX_BYTES = 2 * 1024 * 1024;

function dayStamp(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`;
}

/** Newest last, by the sortable stamp in the name. */
async function prune(ctx: PluginContext, dir: string): Promise<void> {
  try {
    const entries = await ctx.fs.readDir(dir);
    const mine = entries
      .filter((entry) => !entry.isDirectory && entry.name.endsWith(".jsonl"))
      .map((entry) => entry.name)
      .sort();
    for (const name of mine.slice(0, Math.max(0, mine.length - JOURNAL_KEEP))) {
      await ctx.fs.delete(`${dir}/${name}`);
    }
  } catch {
    /* rotation is housekeeping: never let it fail the call that asked to be recorded */
  }
}

/**
 * Append one entry and return its path. `null` when there is no project to write into —
 * the caller reports the tool result either way, so a missing journal is not a failure.
 */
export async function appendJournal(
  ctx: PluginContext,
  entry: Record<string, unknown>,
): Promise<string | null> {
  const cwd = craftWorkspace();
  if (!cwd) return null;
  const dir = `${cwd}/${JOURNAL_DIR}`;
  const path = `${dir}/${dayStamp(new Date())}.jsonl`;
  const line = `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`;
  try {
    await ctx.fs.createDirectory(dir);
  } catch {
    // Already there is the ordinary case; a real failure surfaces on the write.
  }
  try {
    let previous = "";
    try {
      const read = await ctx.fs.readBinaryFile(path);
      previous = new TextDecoder().decode(base64ToBytes(read.data));
    } catch {
      // First entry of the day.
    }
    if (previous.length + line.length > JOURNAL_MAX_BYTES) return path;
    // The host fs has no append: read, join, write. These lines are small and this keeps
    // the journal one file per day instead of one file per call.
    await ctx.fs.writeFile(path, bytesToBase64(new TextEncoder().encode(previous + line)), "base64");
    await prune(ctx, dir);
    return path;
  } catch {
    return null;
  }
}
