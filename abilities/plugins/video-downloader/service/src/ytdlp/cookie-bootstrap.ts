import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDirectory } from "../fs/files.js";
import { hostnameOf } from "../network/domestic-hosts.js";
import { COOKIE_DIRECTORY, COOKIE_FILE_HEADER, cookieFilePath } from "./cookies.js";

/**
 * Anonymous session bootstrap for the sites that gate their page on "fresh cookies".
 *
 * ByteDance serves its video detail JSON only to a request that already carries a `ttwid`. The
 * engine reports that as `Fresh cookies (not necessarily logged in) are needed`, and a browser gets
 * the cookie by simply loading the site once. The union register endpoint issues the same kind of
 * cookie without a login, so the plugin can carry that first step itself instead of asking the user
 * to open a browser and export a jar by hand.
 */
const TTWID_ENDPOINT = "https://ttwid.bytedance.com/ttwid/union/register/";

/** Sites that accept a union-registered `ttwid`, with the service name the endpoint expects. */
const TTWID_SERVICES: ReadonlyArray<{ suffix: string; service: string }> = [
  { suffix: "ixigua.com", service: "www.ixigua.com" },
  { suffix: "douyin.com", service: "www.douyin.com" },
];

const TTWID_TIMEOUT_MS = 6_000;
const EXPIRY_SECONDS = Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60;

export function ttwidSuffixFor(hostname: string): string | null {
  const host = hostname.trim().toLowerCase();
  if (!host) return null;
  const match = TTWID_SERVICES.find((entry) => host === entry.suffix || host.endsWith(`.${entry.suffix}`));
  return match ? match.suffix : null;
}

function ttwidBody(service: string): string {
  return JSON.stringify({
    region: "cn",
    aid: 1768,
    needFid: false,
    service,
    migrate_info: { ticket: "", source: "node" },
    cbUrlProtocol: "https",
    union: true,
  });
}

function ttwidFrom(response: Response): string | null {
  const list = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const lines = list.length > 0 ? list : [response.headers.get("set-cookie") ?? ""];
  for (const line of lines) {
    const match = /(?:^|,\s*)ttwid=([^;]+)/iu.exec(line);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export interface BootstrapOptions {
  url: string;
  dataRoot: string;
  /** File stem; one jar per probe/task keeps concurrent runs apart. */
  name: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Write a cookie jar that satisfies an anonymous gate, or `null` when the site needs none or the
 * bootstrap failed. Failure is always silent: the probe that follows reports the real reason.
 */
export async function writeAnonymousCookieFile(options: BootstrapOptions): Promise<string | null> {
  const suffix = ttwidSuffixFor(hostnameOf(options.url));
  if (!suffix) return null;
  const service = TTWID_SERVICES.find((entry) => entry.suffix === suffix)?.service;
  if (!service) return null;
  const doFetch = options.fetchImpl ?? fetch;
  try {
    const response = await doFetch(TTWID_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" },
      body: ttwidBody(service),
      signal: AbortSignal.timeout(options.timeoutMs ?? TTWID_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const ttwid = ttwidFrom(response);
    if (!ttwid) return null;
    const path = cookieFilePath(options.dataRoot, options.name);
    await ensureDirectory(join(options.dataRoot, COOKIE_DIRECTORY), 0o700);
    const line = [`.${suffix}`, "TRUE", "/", "TRUE", String(EXPIRY_SECONDS), "ttwid", ttwid].join("\t");
    await writeFile(path, `${COOKIE_FILE_HEADER}\n${line}\n`, { encoding: "utf8", mode: 0o600 });
    await chmod(path, 0o600).catch(() => undefined);
    return path;
  } catch {
    return null;
  }
}
