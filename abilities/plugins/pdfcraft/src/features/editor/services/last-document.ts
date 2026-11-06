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
 * A photo of the path is enough to undo that. It is one small JSON file in the same
 * `.craft/` directory the shots already use, written on every successful open and read
 * once per mount, after the engine reports its first frame. Nothing is remembered about
 * the *content*: if the file changed on disk, the newer bytes are what comes back.
 */

export const LAST_DOCUMENT = ".craft/last-document.json";

/** Older than this and the restore is noise, not continuity. */
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export interface LastDocument {
  /** Absolute path inside the project, as the Agent would name it again. */
  path: string;
  name: string;
  mime: string;
  /** Epoch ms of the open that recorded this, so a stale entry can be left alone. */
  at: number;
}

function filePath(): string | null {
  const cwd = craftWorkspace();
  return cwd ? `${cwd}/${LAST_DOCUMENT}` : null;
}

export async function rememberDocument(
  ctx: PluginContext,
  opened: { path: string; name: string; mime: string },
): Promise<void> {
  const target = filePath();
  if (!target) return;
  const record: LastDocument = { path: opened.path, name: opened.name, mime: opened.mime, at: Date.now() };
  try {
    await ctx.fs.createDirectory(`${craftWorkspace()}/.craft`);
  } catch {
    /* already there is the ordinary case */
  }
  try {
    await ctx.fs.writeFile(target, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  } catch {
    /* a lost memory is not a failed open */
  }
}

export async function recallDocument(ctx: PluginContext): Promise<LastDocument | null> {
  const target = filePath();
  if (!target) return null;
  try {
    const read = await ctx.fs.readFile(target);
    const parsed = JSON.parse(read.content) as Partial<LastDocument>;
    if (typeof parsed.path !== "string" || !parsed.path) return null;
    if (typeof parsed.at === "number" && Date.now() - parsed.at > STALE_MS) return null;
    return {
      path: parsed.path,
      name: typeof parsed.name === "string" ? parsed.name : parsed.path.split("/").pop() || APP.name,
      mime: typeof parsed.mime === "string" ? parsed.mime : "",
      at: typeof parsed.at === "number" ? parsed.at : 0,
    };
  } catch {
    // Missing, unreadable or written by an older build: nothing to restore.
    return null;
  }
}
