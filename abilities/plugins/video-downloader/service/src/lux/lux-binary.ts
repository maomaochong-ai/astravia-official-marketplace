import { chmod } from "node:fs/promises";
import { join } from "node:path";
import { findInPayload, firstVersionToken, isExecutable, isFile, UNAVAILABLE, versionOf, type ToolCapability } from "../tools/tool-capability.js";

/**
 * Locate `lux` inside the unpacked payload.
 *
 * The release archive is a tarball whose internal layout is upstream's business, so the
 * search walks a few levels instead of hard-coding `bin/lux`. Files extracted from a ZIP
 * lose their mode bits, which is why a match that is not executable still counts.
 */
export async function inspectLux(runtimeRoot: string): Promise<ToolCapability> {
  const fileName = process.platform === "win32" ? "lux.exe" : "lux";
  const preferred = join(runtimeRoot, "bin", fileName);

  const bundled = (await isFile(preferred)) ? preferred : await findInPayload(join(runtimeRoot, "bin"), fileName);
  if (bundled) {
    if (!(await isExecutable(bundled))) await chmod(bundled, 0o755).catch(() => undefined);
    const version = await versionOf(bundled, ["--version"], firstVersionToken);
    if (version !== undefined) return { available: true, path: bundled, version, source: "bundled" };
  }

  const pathVersion = await versionOf(fileName, ["--version"], firstVersionToken);
  if (pathVersion !== undefined) return { available: true, path: fileName, version: pathVersion, source: "path" };

  return UNAVAILABLE;
}
