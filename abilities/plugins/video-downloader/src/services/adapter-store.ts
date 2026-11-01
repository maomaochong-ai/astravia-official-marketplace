import type { PluginStorageApi } from "@astravia-org/plugin-sdk";
import { adapterId, type Adapter, type AdapterGrant } from "../domain/adapter";

const REGISTRY_PATH = "adapters/registry.json";
const VALUES_PREFIX = "adapters/values/";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asGrant(value: unknown): AdapterGrant {
  return value === "page-fetch" || value === "storage" ? value : "none";
}

function asAdapter(value: unknown): Adapter | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const meta = record.meta && typeof record.meta === "object" ? (record.meta as Record<string, unknown>) : {};
  const name = asText(meta.name);
  const body = asText(record.body);
  if (!name || !body) return null;
  const match = Array.isArray(meta.match)
    ? meta.match.map((entry) => asText(entry)).filter((entry) => entry.length > 0)
    : [];
  return {
    id: asText(record.id) || adapterId(name),
    meta: {
      name,
      version: asText(meta.version) || "0.1.0",
      match: match.length > 0 ? match : ["<all_urls>"],
      description: asText(meta.description),
      grant: asGrant(meta.grant),
    },
    body,
    enabled: record.enabled !== false,
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : 0,
  };
}

/**
 * Adapter registry, persisted as one private JSON file. The file is the only source of truth:
 * nothing is fetched at run time, which is what keeps an Adapter from becoming a second update channel.
 */
export class AdapterStore {
  constructor(private readonly storage: PluginStorageApi) {}

  async list(): Promise<Adapter[]> {
    const raw = await this.storage.readFile(REGISTRY_PATH, "utf8").catch(() => null);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.map(asAdapter).filter((entry): entry is Adapter => entry !== null);
    } catch {
      return [];
    }
  }

  private async write(adapters: Adapter[]): Promise<void> {
    await this.storage.writeFile(REGISTRY_PATH, `${JSON.stringify(adapters, null, 2)}\n`, "utf8");
  }

  async save(adapters: Adapter[]): Promise<void> {
    await this.write(adapters);
  }

  async upsert(adapter: Adapter): Promise<Adapter[]> {
    const current = await this.list();
    const next = current.some((entry) => entry.id === adapter.id)
      ? current.map((entry) => (entry.id === adapter.id ? adapter : entry))
      : [...current, adapter];
    await this.write(next);
    return next;
  }

  async remove(id: string): Promise<Adapter[]> {
    const next = (await this.list()).filter((entry) => entry.id !== id);
    await this.write(next);
    return next;
  }

  async setEnabled(id: string, enabled: boolean): Promise<Adapter[]> {
    const next = (await this.list()).map((entry) => (entry.id === id ? { ...entry, enabled } : entry));
    await this.write(next);
    return next;
  }

  async readValues(id: string): Promise<Record<string, unknown>> {
    const raw = await this.storage.readFile(`${VALUES_PREFIX}${id}.json`, "utf8").catch(() => null);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  async writeValues(id: string, values: Record<string, unknown>): Promise<void> {
    await this.storage.writeFile(`${VALUES_PREFIX}${id}.json`, `${JSON.stringify(values, null, 2)}\n`, "utf8");
  }
}
