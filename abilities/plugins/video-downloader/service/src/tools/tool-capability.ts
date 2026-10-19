import { access, chmod, constants, readdir } from "node:fs/promises";
import { join } from "node:path";
import { runCommand } from "../process/run-command.js";

export interface ToolCapability {
  available: boolean;
  path: string | null;
  version: string | null;
  /** `bundled` when the plugin provisioned the binary, `path` when it came from PATH. */
  source: "bundled" | "path" | null;
}

export const UNAVAILABLE: ToolCapability = { available: false, path: null, version: null, source: null };

const MAX_SEARCH_DEPTH = 3;
/** How long a version probe of a system-installed tool may take. */
const PATH_PROBE_TIMEOUT_MS = 15_000;
/**
 * A provisioned binary is 30–40 MB and unsigned, so the first execution can stall for a minute
 * while the OS scans it. The budget is generous because a timeout here used to look like "the
 * tool is still being installed" and left the panel waiting forever.
 */
const PROVISIONED_PROBE_TIMEOUT_MS = 120_000;

export async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isFile(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Locate a binary inside the unpacked payload.
 *
 * The release archive is a tarball whose internal layout is upstream's business, so the
 * search walks a few levels instead of hard-coding `bin/<name>`. Files extracted from a ZIP
 * lose their mode bits, which is why a match that is not executable still counts.
 */
export async function findInPayload(root: string, fileName: string, depth = 0): Promise<string | null> {
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

export function firstVersionToken(output: string): string | null {
  const match = /(\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)/.exec(output);
  return match?.[1] ?? null;
}

export interface ProvisionedBinary {
  /** Absolute path the plugin installs into `<dataRoot>/bin`. */
  provisioned: string;
  /** Command name used when falling back to PATH. */
  command: string;
  versionArgs: string[];
  /** Defaults to the first dotted token, which fits yt-dlp's `2026.08.19`. */
  extractVersion?: (output: string) => string | null;
  /**
   * Version to report for the provisioned copy without executing it. `null` means "installed,
   * version unknown". Passing this (or `null`) makes an existing provisioned file authoritative —
   * the installer only writes it after the pinned digest matched.
   */
  provisionedVersion?: string | null;
}

/**
 * Resolve a tool the plugin may have provisioned itself, falling back to PATH so a locally
 * installed copy still works during development.
 */
export async function inspectProvisioned({
  provisioned,
  command,
  versionArgs,
  extractVersion,
  provisionedVersion,
}: ProvisionedBinary): Promise<ToolCapability> {
  const extract = extractVersion ?? firstVersionToken;
  if (await isFile(provisioned)) {
    if (!(await isExecutable(provisioned))) await chmod(provisioned, 0o755).catch(() => undefined);
    if (provisionedVersion !== undefined) {
      return { available: true, path: provisioned, version: provisionedVersion, source: "bundled" };
    }
    const version = await versionOf(provisioned, versionArgs, extract, PROVISIONED_PROBE_TIMEOUT_MS);
    if (version !== undefined) return { available: true, path: provisioned, version, source: "bundled" };
  }
  const version = await versionOf(command, versionArgs, extract, PATH_PROBE_TIMEOUT_MS);
  if (version !== undefined) return { available: true, path: command, version, source: "path" };
  return UNAVAILABLE;
}

export async function versionOf(
  path: string,
  args: string[],
  extract: (output: string) => string | null,
  timeoutMs = PATH_PROBE_TIMEOUT_MS,
): Promise<string | null | undefined> {
  try {
    const result = await runCommand(path, args, { timeoutMs });
    if (result.code !== 0) return undefined;
    return extract(`${result.stdout}\n${result.stderr}`.trim());
  } catch {
    return undefined;
  }
}

export async function inspectFfmpeg(toolDir: string): Promise<ToolCapability> {
  return inspectProvisioned({
    provisioned: join(toolDir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
    command: "ffmpeg",
    versionArgs: ["-version"],
    extractVersion: (output) => /ffmpeg version (\S+)/iu.exec(output)?.[1] ?? null,
    provisionedVersion: null,
  });
}
