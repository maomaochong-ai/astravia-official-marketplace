import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultDownloadDirectory } from "../environment.js";
import { normalizeEnginePreference, type EnginePreference } from "../engine/engine-name.js";
import { ensureDirectory } from "../fs/files.js";

export interface ServiceSettings {
  downloadDirectory: string;
  maxConcurrent: number;
  cookie: string;
  multiThread: boolean;
  keepPartialFiles: boolean;
  /** Which engine resolves and downloads a page; `auto` tries lux first, then yt-dlp. */
  engine: EnginePreference;
}

export const DEFAULT_SETTINGS: ServiceSettings = {
  downloadDirectory: defaultDownloadDirectory(),
  maxConcurrent: 2,
  cookie: "",
  multiThread: false,
  keepPartialFiles: false,
  engine: "auto",
};

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function normalizeSettings(input: Partial<ServiceSettings> | null | undefined): ServiceSettings {
  const source = input ?? {};
  const directory = typeof source.downloadDirectory === "string" ? source.downloadDirectory.trim() : "";
  return {
    downloadDirectory: directory || DEFAULT_SETTINGS.downloadDirectory,
    maxConcurrent: clampInteger(source.maxConcurrent, 1, 4, DEFAULT_SETTINGS.maxConcurrent),
    cookie: typeof source.cookie === "string" ? source.cookie.trim() : "",
    multiThread: source.multiThread === true,
    keepPartialFiles: source.keepPartialFiles === true,
    engine: normalizeEnginePreference(source.engine),
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
