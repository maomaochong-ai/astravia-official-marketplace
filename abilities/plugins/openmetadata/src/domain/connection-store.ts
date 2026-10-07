/**
 * OpenMetadata 连接配置类型定义和存储。
 *
 * 连接列表通过宿主 storage API（readJsonFile / writeJsonFile）持久化，
 * 代理进程启动时从 ASTRAVIA_SERVICE_DATA_DIR 读取同一份文件。
 */

import { readJsonFile, writeJsonFile, type PluginStorageApi } from "@astravia-org/plugin-sdk";
import { getOmServices } from "../shared/om-services";

export interface OmConnection {
  id: string;
  name: string;
  serverUrl: string;
  token: string;
  createdAt: number;
}

export interface ConnectionStoreApi {
  list(): Promise<OmConnection[]>;
  save(connections: OmConnection[]): Promise<void>;
  add(conn: Omit<OmConnection, "id" | "createdAt">): Promise<OmConnection>;
  remove(id: string): Promise<void>;
  update(id: string, patch: Partial<OmConnection>): Promise<OmConnection | null>;
  testConnection(serverUrl: string, token: string): Promise<{ ok: boolean; message?: string }>;
}

const STORAGE_PATH = "connections.json";

let _storage: PluginStorageApi | null = null;

export function bindConnectionStorage(storage: PluginStorageApi | null): void {
  _storage = storage;
}

/**
 * 通过代理进程测试连接。
 *
 * 不走 window.fetch（渲染进程会被 CORS 拦截），
 * 而是通过代理进程的 /om/api/users/current 路由（代理进程在 Node.js 中 fetch，无 CORS 限制）。
 * 为了在"还没保存连接"的情况下也能测试，临时把连接写入存储再测试，测试完恢复。
 */
async function testViaProxy(serverUrl: string, token: string): Promise<{ ok: boolean; message?: string }> {
  const api = getOmServices();
  if (!api) {
    return { ok: false, message: "代理服务未启动，请先添加至少一个连接" };
  }

  try {
    // 读出现有连接，临时注入一个 __test__ 连接
    const tempConn: OmConnection = {
      id: "__test__",
      name: "test",
      serverUrl,
      token,
      createdAt: Date.now(),
    };
    const existing = _storage ? ((await readJsonFile<OmConnection[]>(_storage, STORAGE_PATH)) ?? []) : [];
    const merged = [...existing.filter((c) => c.id !== tempConn.id), tempConn];
    await writeJsonFile(_storage!, STORAGE_PATH, merged);

    const resp = await api.request<{ ok: boolean; error?: { message?: string; code?: string } }>(
      "om-proxy",
      {
        path: "/om/api/users/current?connection=__test__",
        method: "GET",
        timeoutMs: 10000,
        headers: {},
      },
    );

    // 清理测试连接
    try { await writeJsonFile(_storage!, STORAGE_PATH, existing); } catch { /* best-effort */ }

    if (resp.ok) {
      const envelope = resp.body;
      if (envelope?.ok) return { ok: true };
      if (envelope?.error?.code === "AUTH_EXPIRED") {
        return { ok: false, message: "Token 无效或已过期" };
      }
      return { ok: false, message: envelope?.error?.message ?? "连接失败" };
    }
    return { ok: false, message: `代理请求失败 (HTTP ${resp.status})` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export function getConnectionStore(): ConnectionStoreApi {
  if (!_storage) throw new Error("Connection store not bound — call bindConnectionStorage(ctx.storage) in activate");
  const storage = _storage;

  async function readAll(): Promise<OmConnection[]> {
    return (await readJsonFile<OmConnection[]>(storage, STORAGE_PATH)) ?? [];
  }

  async function writeAll(connections: OmConnection[]): Promise<void> {
    await writeJsonFile(storage, STORAGE_PATH, connections);
  }

  return {
    async list() { return readAll(); },
    async save(connections) { return writeAll(connections); },

    async add(conn) {
      const connections = await readAll();
      const newConn: OmConnection = { ...conn, id: crypto.randomUUID(), createdAt: Date.now() };
      connections.push(newConn);
      await writeAll(connections);
      return newConn;
    },

    async remove(id) {
      const connections = await readAll();
      await writeAll(connections.filter((c) => c.id !== id));
    },

    async update(id, patch) {
      const connections = await readAll();
      const idx = connections.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      connections[idx] = { ...connections[idx], ...patch };
      await writeAll(connections);
      return connections[idx];
    },

    async testConnection(serverUrl, token) {
      return testViaProxy(serverUrl, token);
    },
  };
}
