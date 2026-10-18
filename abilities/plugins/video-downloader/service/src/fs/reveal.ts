import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { stat } from "node:fs/promises";

async function isFile(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}

/**
 * Show a finished download in the platform file manager.
 *
 * The service runs as a plain Node child of the desktop host, so it can use the native
 * reveal command without borrowing any host privilege.
 */
export async function revealInFileManager(path: string): Promise<boolean> {
  const fileExists = await isFile(path);
  const directory = fileExists ? dirname(path) : path;
  const [command, args] =
    process.platform === "darwin"
      ? fileExists
        ? ["open", ["-R", path]]
        : ["open", [directory]]
      : process.platform === "win32"
        ? fileExists
          ? ["explorer", [`/select,${path}`]]
          : ["explorer", [directory]]
        : ["xdg-open", [directory]];
  return new Promise<boolean>((resolve) => {
    try {
      const child = spawn(command, args as string[], { stdio: "ignore", detached: true });
      child.on("error", () => resolve(false));
      child.on("spawn", () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}
