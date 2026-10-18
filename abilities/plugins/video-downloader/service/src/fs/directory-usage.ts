import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export interface DirectoryUsage {
  bytes: number;
  files: number;
}

const MAX_DEPTH = 4;
const MAX_ENTRIES = 4096;

/**
 * Sum the byte size of every regular file below `directory`.
 *
 * lux writes each in-flight transfer as `<name>.<ext>.download` next to its final path, so
 * the directory total is a dependable progress signal that does not depend on parsing the
 * terminal progress bar.
 */
export async function measureDirectory(directory: string, depth = 0): Promise<DirectoryUsage> {
  let usage: DirectoryUsage = { bytes: 0, files: 0 };
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch {
    return usage;
  }
  for (const entry of entries) {
    if (usage.files >= MAX_ENTRIES) break;
    const path = join(directory, entry);
    let info;
    try {
      info = await stat(path);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      if (depth >= MAX_DEPTH) continue;
      const child = await measureDirectory(path, depth + 1);
      usage = { bytes: usage.bytes + child.bytes, files: usage.files + child.files };
      continue;
    }
    if (!info.isFile()) continue;
    usage = { bytes: usage.bytes + info.size, files: usage.files + 1 };
  }
  return usage;
}
