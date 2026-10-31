import { dirname } from "node:path";

/**
 * Engine flags the probe and the download must agree on.
 *
 * They live in one module because a site that parses under one set of flags and downloads under
 * another produces renditions that cannot be fetched: YouTube's `n`/`nsig` challenge is solved by
 * the JavaScript runtime at both stages.
 */

const NODE_BINARY = /^node(?:\.exe)?$/iu;

/**
 * yt-dlp runs its extractor JavaScript (`yt-dlp-ejs`) through an external runtime and falls back
 * to a weaker client set when it finds none — YouTube then advertises only storyboards, which the
 * panel drops, so parsing looks like "no downloadable stream".
 *
 * The service is normally a Node process, so its own binary is handed over by absolute path. When
 * the host embeds the service in a different executable (`process.execPath` is the app binary),
 * the bare runtime name is emitted instead and yt-dlp resolves `node` from PATH itself.
 */
export function jsRuntimeArgs(execPath: string = process.execPath): string[] {
  const name = execPath.split(/[\\/]/u).pop() ?? "";
  // yt-dlp accepts either the binary path or its containing directory.
  return ["--js-runtimes", NODE_BINARY.test(name) ? `node:${dirname(execPath)}` : "node"];
}

/** `--proxy` for every engine request, omitted when no proxy is configured. */
export function proxyArgs(proxy: string): string[] {
  const trimmed = proxy.trim();
  return trimmed ? ["--proxy", trimmed] : [];
}

/**
 * Where the engine takes its cookies from.
 *
 * A pasted header is written to a jar by the caller and wins; a browser is read by the engine
 * itself, which is the only way to obtain a signed-in session for a site that gates its page. When
 * both are absent the caller may still supply an anonymous jar (see `cookie-bootstrap`).
 */
export function cookieArgs(cookieFile: string | null, cookieBrowser: string): string[] {
  if (cookieFile) return ["--cookies", cookieFile];
  const browser = cookieBrowser.trim();
  return browser ? ["--cookies-from-browser", browser] : [];
}
