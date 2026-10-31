import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultDownloadDirectory } from "../environment.js";
import { ensureDirectory } from "../fs/files.js";

export interface ServiceSettings {
  downloadDirectory: string;
  maxConcurrent: number;
  cookie: string;
  /** Proxy URL handed to the engine; empty means direct egress. */
  proxy: string;
  multiThread: boolean;
  keepPartialFiles: boolean;
}

export const DEFAULT_SETTINGS: ServiceSettings = {
  downloadDirectory: defaultDownloadDirectory(),
  maxConcurrent: 2,
  cookie: "",
  proxy: "",
  multiThread: false,
  keepPartialFiles: false,
};

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/** Schemes the engine understands; anything else is rejected instead of silently ignored. */
const PROXY_SCHEMES = ["http://", "https://", "socks4://", "socks5://", "socks5h://"];

/**
 * Accepts `scheme://host:port` plus the bare `host:port` copied out of a proxy client, and
 * normalises it to a URL the engine can use. A value that is not a proxy address is dropped
 * rather than forwarded: an unparseable proxy would fail every request for an unrelated reason.
 */
export function normalizeProxy(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const prefixed = PROXY_SCHEMES.some((scheme) => trimmed.toLowerCase().startsWith(scheme))
    ? trimmed
    : `http://${trimmed.replace(/^\/\//u, "")}`;
  try {
    const url = new URL(prefixed);
    if (!PROXY_SCHEMES.includes(`${url.protocol}//`)) return "";
    if (!url.hostname) return "";
    // A password without a name cannot be expressed, and dropping either half would silently
    // downgrade an authenticated proxy into a 407 loop.
    if (url.password && !url.username) return "";
    // A path on a proxy URL is always a paste error; refuse it instead of guessing.
    if (url.pathname !== "/" && url.pathname !== "") return "";
    const credentials = url.username ? `${url.username}${url.password ? `:${url.password}` : ""}@` : "";
    return `${url.protocol}//${credentials}${url.host}`;
  } catch {
    return "";
  }
}

export function normalizeSettings(input: Partial<ServiceSettings> | null | undefined): ServiceSettings {
  const source = input ?? {};
  const directory = typeof source.downloadDirectory === "string" ? source.downloadDirectory.trim() : "";
  return {
    downloadDirectory: directory || DEFAULT_SETTINGS.downloadDirectory,
    maxConcurrent: clampInteger(source.maxConcurrent, 1, 4, DEFAULT_SETTINGS.maxConcurrent),
    cookie: typeof source.cookie === "string" ? source.cookie.trim() : "",
    proxy: normalizeProxy(source.proxy),
    multiThread: source.multiThread === true,
    keepPartialFiles: source.keepPartialFiles === true,
  };
}

export class SettingsStore {
  private settings: ServiceSettings = DEFAULT_SETTINGS;

  constructor(private readonly dataRoot: string) {}

  private get file(): string {
    return join(this.dataRoot, "settings.json");
  }

  async load(): Promise<ServiceSettings> {
    try {
      const raw = await readFile(this.file, "utf8");
      this.settings = normalizeSettings(JSON.parse(raw) as Partial<ServiceSettings>);
    } catch {
      this.settings = normalizeSettings(null);
    }
    return this.settings;
  }

  current(): ServiceSettings {
    return this.settings;
  }

  async update(patch: Partial<ServiceSettings>): Promise<ServiceSettings> {
    this.settings = normalizeSettings({ ...this.settings, ...patch });
    await ensureDirectory(this.dataRoot);
    await writeFile(this.file, `${JSON.stringify(this.settings, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await ensureDirectory(this.settings.downloadDirectory);
    return this.settings;
  }
}
