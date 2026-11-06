import type { PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../../../app.config.ts";
import { craftWorkspace } from "../session-registry.ts";

/**
 * Which file was on the canvas, kept where the project can survive a closed tab.
 *
 * Closing the activity tab destroys the frame, and the frame was holding the document:
 * the wasm app keeps its own state and the `srcDoc` is rebuilt from scratch next time,
 * so the panel came back empty even though the file was sitting right there in the
 * project. The user then had to leave the conversation, find it in the file tree and
 * drag it back — for a file the plugin itself opened a minute earlier.
 *
 * It lives in `ctx.storage`, which the host scopes to *this* plugin: a private
 * directory per installed plugin, written to disk, surviving a restart. That is the
 * whole point — an earlier version wrote `.craft/last-document.json` into the project,
 * one shared file for fifteen plugins, so a deck opened after a document handed the
 * deck the document. The plugin that remembers has to own its memory.
 *
 * The project is part of the record (`cwd`): a file path only means something in the
 * project it was opened from, and restoring a document from another project would be
 * worse than restoring nothing. Nothing is remembered about the *content*: if the file
 * changed on disk, the newer bytes are what comes back.
 */

/** Storage key inside this plugin's private directory. */
export const LAST_DOCUMENT = "last-document.json";

/** Older than this and the restore is noise, not continuity. */
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export interface LastDocument {
  /** Absolute path inside the project, as the Agent would name it again. */
  path: string;
  name: string;
  mime: string;
  /** Epoch ms of the open that recorded this, so a stale entry can be left alone. */
  at: number;
  /** The project the path belongs to; a different one is not this plugin's business. */
  cwd: string;
}

export async function rememberDocument(
  ctx: PluginContext,
  opened: { path: string; name: string; mime: string },
): Promise<void> {
  const cwd = craftWorkspace();
  if (!cwd) return;
  const record: LastDocument = { path: opened.path, name: opened.name, mime: opened.mime, at: Date.now(), cwd };
  try {
    await ctx.storage.writeFile(LAST_DOCUMENT, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  } catch {
    /* a lost memory is not a failed open */
  }
}

export async function recallDocument(ctx: PluginContext): Promise<LastDocument | null> {
  const cwd = craftWorkspace();
  if (!cwd) return null;
  try {
    const raw = await ctx.storage.readFile(LAST_DOCUMENT, "utf8");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastDocument>;
    if (typeof parsed.path !== "string" || !parsed.path) return null;
    // Another project's document is not this panel's to reopen.
    if (typeof parsed.cwd === "string" && parsed.cwd !== cwd) return null;
    if (typeof parsed.at === "number" && Date.now() - parsed.at > STALE_MS) return null;
    return {
      path: parsed.path,
      name: typeof parsed.name === "string" ? parsed.name : parsed.path.split("/").pop() || APP.name,
      mime: typeof parsed.mime === "string" ? parsed.mime : "",
      at: typeof parsed.at === "number" ? parsed.at : 0,
      cwd: typeof parsed.cwd === "string" ? parsed.cwd : cwd,
    };
  } catch {
    // Missing, unreadable or written by an older build: nothing to restore.
    return null;
  }
}
