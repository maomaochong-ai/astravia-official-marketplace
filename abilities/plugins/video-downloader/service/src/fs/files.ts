import { copyFile, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const RESERVED = /[\\/:*?"<>|\u0000-\u001f]/g;

/**
 * Build a filesystem-safe base name for `lux -O`.
 *
 * lux appends the container extension itself, so the extension of the incoming title is
 * dropped rather than duplicated.
 */
export function sanitizeFileName(input: string, maxLength = 120): string {
  const withoutExtension = input.replace(/\.[A-Za-z0-9]{1,5}$/u, "");
  const cleaned = withoutExtension
    .replace(RESERVED, " ")
    .replace(/\s+/gu, " ")
    .replace(/^[.\s]+|[.\s]+$/gu, "")
    .trim();
  const fallback = cleaned || "video";
  if (fallback.length <= maxLength) return fallback;
  return fallback.slice(0, maxLength).trim();
}

export async function ensureDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pick a destination path that does not clobber an existing file: `clip.mp4` becomes
 * `clip (1).mp4`. Without this a second download of the same title silently replaces the
 * first one, because lux itself always resolves collisions inside its own work directory.
 */
export async function uniqueDestination(directory: string, fileName: string): Promise<string> {
  const extension = extname(fileName);
  const stem = extension ? fileName.slice(0, -extension.length) : fileName;
  let candidate = join(directory, fileName);
  let counter = 1;
  while (await exists(candidate)) {
    candidate = join(directory, `${stem} (${counter})${extension}`);
    counter += 1;
    if (counter > 999) break;
  }
  return candidate;
}

export interface CollectedFile {
  source: string;
  name: string;
}

/** Files worth keeping after a lux run: partial `.download` leftovers are excluded. */
export async function collectProducedFiles(directory: string): Promise<CollectedFile[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const collected: CollectedFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith(".download")) continue;
    if (entry.name.startsWith(".")) continue;
    collected.push({ source: join(directory, entry.name), name: entry.name });
  }
  return collected;
}

/** Move produced files out of the per-task work directory into the download directory. */
export async function moveProducedFiles(
  workDirectory: string,
  destinationDirectory: string,
): Promise<Array<{ path: string; name: string }>> {
  await ensureDirectory(destinationDirectory);
  const produced = await collectProducedFiles(workDirectory);
  const moved: Array<{ path: string; name: string }> = [];
  for (const file of produced) {
    const target = await uniqueDestination(destinationDirectory, basename(file.name));
    try {
      await rename(file.source, target);
    } catch {
      // Cross-device moves fail with EXDEV; copy then drop the original.
      await copyFile(file.source, target);
      await rm(file.source, { force: true });
    }
    moved.push({ path: target, name: basename(target) });
  }
  return moved;
}
