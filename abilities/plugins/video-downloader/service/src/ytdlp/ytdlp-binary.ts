import { inspectProvisioned, type ToolCapability } from "../tools/tool-capability.js";
import { ytdlpReleasePath } from "./ytdlp-release.js";

/**
 * Locate the yt-dlp that was provisioned into `<dataRoot>/bin`, falling back to PATH so a
 * system-wide install still works when the plugin has not downloaded its own copy.
 */
export async function inspectYtdlp(dataRoot: string): Promise<ToolCapability> {
  return inspectProvisioned({
    provisioned: ytdlpReleasePath(dataRoot),
    command: "yt-dlp",
    versionArgs: ["--version"],
  });
}
