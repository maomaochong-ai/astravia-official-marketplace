import { access, chmod, constants, readdir } from "node:fs/promises";
import { join } from "node:path";
import { runCommand } from "../process/run-command.js";

export interface ToolCapability {
  available: boolean;
  path: string | null;
  version: string | null;
  /** `bundled` when the runtime payload ships the binary, `path` when it came from PATH. */
  source: "bundled" | "path" | null;
}

export const UNAVAILABLE: ToolCapability = { available: false, path: null, version: null, source: null };

const MAX_SEARCH_DEPTH = 3;

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Locate `lux` inside the unpacked payload.
 *
 * The release archive is a tarball whose internal layout is upstream's business, so the
 * search walks a few levels instead of hard-coding `bin/lux`. Files extracted from a ZIP
 * lose their mode bits, which is why a match that is not executable still counts.
 */
async function findInPayload(root: string, fileName: string, depth = 0): Promise<string | null> {
  if (depth > MAX_SEARCH_DEPTH) return null;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name === fileName) return join(root, entry.name);
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = await findInPayload(join(root, entry.name), fileName, depth + 1);
    if (found) return found;
  }
  return null;
}

function firstVersionToken(output: string): string | null {
  const match = /(\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)/.exec(output);
  return match?.[1] ?? null;
}

async function tryVersion(path: string): Promise<string | null | undefined> {
  try {
    const result = await runCommand(path, ["--version"], { timeoutMs: 15_000 });
    if (result.code !== 0) return undefined;
    return firstVersionToken(`${result.stdout}\n${result.stderr}`.trim());
  } catch {
    return undefined;
  }
}

export async function inspectLux(runtimeRoot: string): Promise<ToolCapability> {
  const fileName = process.platform === "win32" ? "lux.exe" : "lux";
  const preferred = join(runtimeRoot, "bin", fileName);

  const bundled = (await isFile(preferred)) ? preferred : await findInPayload(join(runtimeRoot, "bin"), fileName);
  if (bundled) {
    if (!(await isExecutable(bundled))) await chmod(bundled, 0o755).catch(() => undefined);
    const version = await tryVersion(bundled);
    if (version !== undefined) return { available: true, path: bundled, version, source: "bundled" };
  }

  const pathVersion = await tryVersion(fileName);
  if (pathVersion !== undefined) return { available: true, path: fileName, version: pathVersion, source: "path" };

  return UNAVAILABLE;
}

export async function inspectFfmpeg(toolDir: string): Promise<ToolCapability> {
  const provisioned = join(toolDir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  const candidate = (await isFile(provisioned)) ? provisioned : "ffmpeg";
  try {
    if (candidate !== "ffmpeg" && !(await isExecutable(candidate))) await chmod(candidate, 0o755).catch(() => undefined);
    const result = await runCommand(candidate, ["-version"], { timeoutMs: 15_000 });
    if (result.code !== 0) return UNAVAILABLE;
    const output = `${result.stdout}\n${result.stderr}`.trim();
    const match = /ffmpeg version (\S+)/iu.exec(output);
    return {
      available: true,
      path: candidate,
      version: match?.[1] ?? null,
      source: candidate === "ffmpeg" ? "path" : "bundled",
    };
  } catch {
    return UNAVAILABLE;
  }
}
