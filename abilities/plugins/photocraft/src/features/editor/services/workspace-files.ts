import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { base64ToBytes, bytesToBase64 } from "../../../shared/formatters/base64.ts";
import { basename, extensionOf } from "../../../shared/formatters/paths.ts";

/** A file the editor is currently bound to; the host is the only owner of paths. */
export interface WorkspaceFile {
  path: string;
  name: string;
}

/**
 * Explorer access, permission-safe.
 *
 * `ctx.fileExplorer.*` requires `workspace.read`. Without it every call throws,
 * and a throw inside a mount effect takes the whole tab down through the host's
 * error boundary — one missing permission must not blank the panel, so this
 * wrapper degrades to "no selection" and reports `denied` instead.
 */
export interface SelectionAccess {
  denied: boolean;
  current(): WorkspaceFile | null;
  onChange(listener: (file: WorkspaceFile | null) => void): Disposable | null;
}

export function selectionAccess(ctx: PluginContext): SelectionAccess {
  const pick = (): WorkspaceFile | null => {
    try {
      const files = ctx.fileExplorer.getSelection().filter((entry) => !entry.isDirectory);
      return files.length === 1 ? { path: files[0].path, name: files[0].name } : null;
    } catch {
      return null;
    }
  };

  let denied = false;
  try {
    ctx.fileExplorer.getSelection();
  } catch {
    denied = true;
  }

  return {
    denied,
    current: pick,
    onChange(listener) {
      try {
        return ctx.fileExplorer.onDidChangeSelection(() => listener(pick()));
      } catch {
        return null;
      }
    },
  };
}

/** Read one workspace file as bytes; `null` when the host could not read it. */
export async function readWorkspaceFile(
  ctx: PluginContext,
  file: WorkspaceFile,
): Promise<{ bytes: ArrayBuffer; mimeType: string } | null> {
  try {
    const result = await ctx.fs.readBinaryFile(file.path);
    const bytes = base64ToBytes(result.data);
    return { bytes: bytes.buffer as ArrayBuffer, mimeType: result.mimeType };
  } catch {
    return null;
  }
}

/**
 * Write bytes the editor produced back to disk.
 *
 * Photocraft's web shell has no save dialog: `pick_save` echoes the document's
 * own name while an explicit Save As / Export returns a different one, so the
 * file name is the only signal that separates "save in place" from "save as".
 * The first successful save binds the path and later exports never steal it.
 */
export async function saveRenderedImage(
  ctx: PluginContext,
  request: { name: string; bytes: ArrayBuffer; current: WorkspaceFile | null },
): Promise<WorkspaceFile | null> {
  const base64 = bytesToBase64(new Uint8Array(request.bytes));
  const current = request.current;

  if (current && basename(request.name) === current.name) {
    await ctx.fs.writeFile(current.path, base64, "base64");
    return current;
  }

  const saved = await ctx.fs.saveAs(request.name, base64, "base64", {
    title: request.name,
    filters: [{ name: "Image", extensions: [extensionOf(request.name) || "png"] }],
  });
  return saved ? { path: saved, name: basename(saved) } : null;
}
