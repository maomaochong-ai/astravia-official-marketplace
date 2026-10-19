import { delimiter, join } from "node:path";

/** Tools the plugin provisions itself live here, outside the versioned runtime directory. */
export function toolDirectory(dataRoot: string): string {
  return join(dataRoot, "bin");
}

export function toolFileName(base: string, platform: NodeJS.Platform = process.platform): string {
  return platform === "win32" ? `${base}.exe` : base;
}

/**
 * lux looks `ffmpeg` up on `PATH` (after a `./ffmpeg` probe in its working directory), so the
 * provisioned tool directory has to be prepended to the child environment.
 */
export function withToolPath(directory: string, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const existing = env.PATH ?? env.Path ?? "";
  return { ...env, PATH: existing ? `${directory}${delimiter}${existing}` : directory };
}
