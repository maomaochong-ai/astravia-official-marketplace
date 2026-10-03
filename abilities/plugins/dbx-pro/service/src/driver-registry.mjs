/**
 * 驱动注册表。
 *
 * D1 的诚实边界：**只有 sqlite 是真实现**（node:sqlite，零原生模块）。
 * 其余类型在注册表里可见、可列举，但调用时一律返回 DRIVER_UNSUPPORTED ——
 * 绝不用空表格或假成功糊弄用户（对应旧项目「未接入的驱动必须让用户看见原因」）。
 *
 * 驱动模块内部按 id 约定文件名 `./drivers/<id>-driver.mjs`，
 * 通过 `new URL(..., import.meta.url)` 动态载入：esbuild 不会改写这种写法，
 * 运行时按**产物所在目录**解析，因此打包成多个 bundle 后依然正确。
 */

import { engineError } from "./engine/protocol.mjs";

/** 已实现的一等驱动。 */
export const DRIVER_TABLE = Object.freeze([
  {
    id: "sqlite",
    label: "SQLite",
    family: "sqlite",
    tier: "first-class",
    defaultPort: 0,
    fileBased: true,
    aliases: ["sqlite3"],
  },
]);

/** 已注册但尚未实现的驱动（D2+ 逐个落地）。 */
export const PENDING_DRIVERS = Object.freeze([
  { id: "postgres", label: "PostgreSQL", family: "postgres", tier: "experimental", defaultPort: 5432, reason: "driver.pending.postgres" },
  { id: "mysql", label: "MySQL", family: "mysql", tier: "experimental", defaultPort: 3306, reason: "driver.pending.mysql" },
  { id: "mariadb", label: "MariaDB", family: "mysql", tier: "experimental", defaultPort: 3306, reason: "driver.pending.mariadb" },
  { id: "mssql", label: "SQL Server", family: "mssql", tier: "experimental", defaultPort: 1433, reason: "driver.pending.mssql" },
  { id: "mongodb", label: "MongoDB", family: "mongodb", tier: "experimental", defaultPort: 27017, reason: "driver.pending.mongodb" },
  { id: "redis", label: "Redis", family: "redis", tier: "experimental", defaultPort: 6379, reason: "driver.pending.redis" },
  { id: "clickhouse", label: "ClickHouse", family: "clickhouse", tier: "experimental", defaultPort: 8123, reason: "driver.pending.clickhouse" },
  { id: "duckdb", label: "DuckDB", family: "duckdb", tier: "out-of-scope", defaultPort: 0, reason: "driver.pending.duckdb" },
  { id: "cloudflare-d1", label: "Cloudflare D1", family: "cloudflare-d1", tier: "out-of-scope", defaultPort: 0, reason: "driver.pending.cloudflare-d1" },
]);

const ALIASES = new Map();
for (const entry of DRIVER_TABLE) {
  ALIASES.set(entry.id, entry.id);
  for (const alias of entry.aliases ?? []) ALIASES.set(alias, entry.id);
}

/** 归一化驱动 id（sqlite3 → sqlite）。 */
export function normalizeDriverId(id) {
  if (typeof id !== "string" || id.trim().length === 0) return "";
  const raw = id.trim().toLowerCase();
  return ALIASES.get(raw) ?? raw;
}

/** 供 /health 与 UI 的能力矩阵使用：真实能力，不是宣传口径。 */
export function listDriverDescriptors() {
  return [
    ...DRIVER_TABLE.map((entry) => ({ ...entry, ready: true })),
    ...PENDING_DRIVERS.map((entry) => ({ ...entry, ready: false })),
  ];
}

const cache = new Map();

/** 载入驱动模块。未实现的驱动在这里就失败，不会走到连接阶段。 */
export async function loadDriver(id) {
  const normalized = normalizeDriverId(id);
  if (normalized.length === 0) throw engineError("BAD_REQUEST", "缺少连接类型（dbType）");
  if (cache.has(normalized)) return cache.get(normalized);

  const entry = DRIVER_TABLE.find((candidate) => candidate.id === normalized);
  if (!entry) {
    const pending = PENDING_DRIVERS.find((candidate) => candidate.id === normalized);
    if (pending) {
      throw engineError("DRIVER_UNSUPPORTED", `驱动 ${pending.label}（${pending.id}）尚未在插件引擎中实现`, {
        driver: pending.id,
        tier: pending.tier,
        reason: pending.reason,
      });
    }
    throw engineError("DRIVER_UNSUPPORTED", `未知的数据库类型：${id}`, { driver: String(id) });
  }

  const url = new URL(`./drivers/${entry.id}-driver.mjs`, import.meta.url);
  const module = await import(url.href);
  if (typeof module.createDriver !== "function") {
    throw engineError("INTERNAL", `驱动模块缺少 createDriver()：${entry.id}`);
  }
  cache.set(normalized, module);
  return module;
}
