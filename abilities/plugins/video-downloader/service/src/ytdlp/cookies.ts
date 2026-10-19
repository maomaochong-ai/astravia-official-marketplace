import { chmod, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDirectory } from "../fs/files.js";

const COOKIE_DIRECTORY = "cookies";
export const COOKIE_FILE_HEADER = "# Netscape HTTP Cookie File";

/**
 * Attributes of a `Set-Cookie` line that are not cookies themselves.
 *
 * Users paste both `Cookie:` headers and whole `Set-Cookie` blocks, and only the pairs are
 * meaningful to the engine.
 */
const ATTRIBUTES = new Set([
  "path",
  "domain",
  "expires",
  "max-age",
  "secure",
  "httponly",
  "samesite",
  "priority",
  "version",
  "partitioned",
  "comment",
  "commenturl",
  "discard",
  "port",
]);

/** A year out: yt-dlp drops cookies whose expiry has passed, and a copied header carries none. */
const EXPIRY_SECONDS = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

const COOKIE_NAME = /^[\w!#$%&'*+.^`|~-]+$/u;

/** A browser export (`cookies.txt`) is passed through instead of being re-serialised. */
export function isNetscapeCookieFile(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^#\s*(?:Netscape\s+)?HTTP Cookie File/iu.test(trimmed)) return true;
  const lines = trimmed.split(/\r?\n/u).filter((line) => line.trim() && !line.startsWith("#"));
  if (lines.length === 0) return false;
  return lines.every((line) => line.split("\t").length >= 7);
}

/**
 * Domains a header should be attached to.
 *
 * yt-dlp matches the request host against the cookie domain, so a header copied from
 * `www.example.com` has to be written for both the host and its parent domain — otherwise the
 * engine's own request to `api.example.com` would not see it.
 */
export function cookieDomainsFor(hostname: string): string[] {
  const host = hostname.trim().toLowerCase().replace(/^\./u, "");
  if (!host) return [];
  const domains = new Set<string>([`.${host}`]);
  const labels = host.split(".");
  while (labels.length > 2) {
    labels.shift();
    domains.add(`.${labels.join(".")}`);
  }
  return [...domains];
}

/** Turn a `name=value; name2=value2` header into Netscape cookie lines for its domains. */
export function cookieHeaderToNetscape(header: string, hostname: string): string {
  const domains = cookieDomainsFor(hostname);
  const pairs: Array<{ name: string; value: string }> = [];
  // Users paste `Cookie: a=b; c=d` as often as they paste the bare pairs.
  const body = header.replace(/^\s*cookie\s*:/iu, "");
  for (const part of body.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    let value = part.slice(index + 1).trim();
    if (!COOKIE_NAME.test(name) || ATTRIBUTES.has(name.toLowerCase())) continue;
    if (value.length === 0) continue;
    value = value.replace(/^"|"$/gu, "");
    pairs.push({ name, value });
  }
  if (pairs.length === 0 || domains.length === 0) return "";
  const lines = [COOKIE_FILE_HEADER];
  for (const domain of domains) {
    for (const pair of pairs) {
      lines.push([domain, "TRUE", "/", "FALSE", String(EXPIRY_SECONDS), pair.name, pair.value].join("\t"));
    }
  }
  return `${lines.join("\n")}\n`;
}

/** The file body for one configured value, or `null` when nothing usable was supplied. */
export function cookieFileContent(raw: string, url: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  if (isNetscapeCookieFile(text)) return `${text.replace(/\r\n/gu, "\n").trimEnd()}\n`;
  const content = cookieHeaderToNetscape(text, hostname);
  return content || null;
}

/** Per-call file names keep concurrent downloads from clobbering each other's cookie jar. */
export function cookieFilePath(dataRoot: string, name: string): string {
  return join(dataRoot, COOKIE_DIRECTORY, `${name}.txt`);
}

/**
 * Materialise the configured cookie for one target URL.
 *
 * yt-dlp reads cookies from a file (`--cookies`), not from an environment variable, and the
 * file holds a live session, so it is written 0600 inside a 0700 directory.
 */
export async function writeCookieFile(dataRoot: string, raw: string, url: string, name: string): Promise<string | null> {
  const content = cookieFileContent(raw, url);
  if (!content) return null;
  const path = cookieFilePath(dataRoot, name);
  await ensureDirectory(join(dataRoot, COOKIE_DIRECTORY), 0o700);
  await writeFile(path, content, { encoding: "utf8", mode: 0o600 });
  // `writeFile` only applies the mode when it creates the file, so enforce it either way.
  await chmod(path, 0o600).catch(() => undefined);
  return path;
}

export async function removeCookieFile(path: string | null): Promise<void> {
  if (!path) return;
  await rm(path, { force: true }).catch(() => undefined);
}
