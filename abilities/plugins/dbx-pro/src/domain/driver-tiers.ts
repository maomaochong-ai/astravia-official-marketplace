/**
 * 连接类型档位表 —— 与自持引擎 `service/src/driver-registry.mjs` 逐条对齐的可用性标注。
 *
 * 为什么需要它：市场目录里「85 种数据库类型」是**类型清单**（能配置什么），
 * 不是**已实现能力**（能连什么）。这里把真实档位摊开，UI 就只展示实现事实：
 *   - first-class：引擎已实现且可用（当前只有 SQLite，走 node:sqlite，零原生依赖）
 *   - experimental：引擎已注册但尚未实现，调用会如实返回 DRIVER_UNSUPPORTED
 *   - out-of-scope：当前阶段不在实现范围内（含清单里未注册的类型）
 *
 * 本模块是纯逻辑：不导入 SDK，不导入引擎代码，可被 `node --test` 直接导入。
 * 与引擎注册表的一致性由 `src/test/driver-tiers.test.js` 的漂移守卫解析 .mjs 源码校验。
 */

/** 引擎注册表使用的档位词表（勿新增第四档，避免与引擎说法分叉）。 */
export type DriverTier = "first-class" | "experimental" | "out-of-scope";

export interface DriverTierEntry {
	/** 引擎侧规范化后的驱动 id */
	id: string;
	/** 展示名，取自引擎注册表 */
	label: string;
	tier: DriverTier;
	/** 引擎当前是否真的能连（只有 first-class 为 true） */
	ready: boolean;
	/** 未实现原因键（引擎返回的 reason 原文） */
	reason?: string;
	/** 是否存在可用的本地 CLI 回退（仅 SQLite 有 sqlite3 CLI） */
	cliFallback?: boolean;
}

/**
 * 档位表 —— 与 `service/src/driver-registry.mjs` 的 DRIVER_TABLE + PENDING_DRIVERS 一一对应。
 * 修改这里必须同步引擎注册表，测试会拦住不一致。
 */
export const DRIVER_TIER_TABLE: readonly DriverTierEntry[] = Object.freeze([
	{ id: "sqlite", label: "SQLite", tier: "first-class", ready: true, cliFallback: true },
	{ id: "postgres", label: "PostgreSQL", tier: "experimental", ready: false, reason: "driver.pending.postgres" },
	{ id: "mysql", label: "MySQL", tier: "experimental", ready: false, reason: "driver.pending.mysql" },
	{ id: "mariadb", label: "MariaDB", tier: "experimental", ready: false, reason: "driver.pending.mariadb" },
	{ id: "mssql", label: "SQL Server", tier: "experimental", ready: false, reason: "driver.pending.mssql" },
	{ id: "mongodb", label: "MongoDB", tier: "experimental", ready: false, reason: "driver.pending.mongodb" },
	{ id: "redis", label: "Redis", tier: "experimental", ready: false, reason: "driver.pending.redis" },
	{ id: "clickhouse", label: "ClickHouse", tier: "experimental", ready: false, reason: "driver.pending.clickhouse" },
	{ id: "duckdb", label: "DuckDB", tier: "out-of-scope", ready: false, reason: "driver.pending.duckdb" },
	{ id: "cloudflare-d1", label: "Cloudflare D1", tier: "out-of-scope", ready: false, reason: "driver.pending.cloudflare-d1" },
]);

/** 连接类型（dbType）→ 引擎驱动 id 的别名。引擎注册表里的 aliases 也在这里镜像。 */
export const DB_TYPE_TO_DRIVER: Readonly<Record<string, string>> = Object.freeze({
	sqlite: "sqlite",
	sqlite3: "sqlite",
	sqlserver: "mssql",
	mssql: "mssql",
});

const TIER_LABELS: Record<DriverTier, { zh: string; en: string }> = {
	"first-class": { zh: "一等支持", en: "First-class" },
	experimental: { zh: "试验性", en: "Experimental" },
	"out-of-scope": { zh: "范围外", en: "Out of scope" },
};

const TIER_HINTS: Record<DriverTier, string> = {
	"first-class": "引擎已实现，可直接连接执行查询。",
	experimental: "引擎已登记该驱动，但尚未实现：现在连接会如实返回 DRIVER_UNSUPPORTED，不会给出假结果。",
	"out-of-scope": "当前版本不在实现范围内，仅保留连接类型的配置形态。",
};

function normalizeType(dbType: string | null | undefined): string {
	return String(dbType ?? "").trim().toLowerCase();
}

/** 连接类型 → 引擎驱动 id（未知类型原样返回，便于上层如实显示）。 */
export function driverIdFor(dbType: string | null | undefined): string {
	const raw = normalizeType(dbType);
	if (!raw) return "";
	return DB_TYPE_TO_DRIVER[raw] ?? raw;
}

/** 查档位条目；未登记类型返回 undefined。 */
export function tierEntryFor(dbType: string | null | undefined): DriverTierEntry | undefined {
	const id = driverIdFor(dbType);
	if (!id) return undefined;
	return DRIVER_TIER_TABLE.find((entry) => entry.id === id);
}

/**
 * 连接类型的档位。未登记的类型一律判为 out-of-scope ——
 * 不设第四种「未知」态，避免 UI 出现无法解释的空白。
 */
export function tierFor(dbType: string | null | undefined): DriverTier {
	return tierEntryFor(dbType)?.tier ?? "out-of-scope";
}

/** 引擎当前是否真的能连这个类型。 */
export function isReadyDbType(dbType: string | null | undefined): boolean {
	return tierEntryFor(dbType)?.ready === true;
}

/** 是否存在可用的本地回退路径（SQLite 的 sqlite3 CLI）。 */
export function supportsLocalCliFallback(dbType: string | null | undefined): boolean {
	return tierEntryFor(dbType)?.cliFallback === true;
}

/** 档位展示名。 */
export function tierLabel(tier: DriverTier, locale: "zh" | "en" = "zh"): string {
	return TIER_LABELS[tier]?.[locale] ?? TIER_LABELS["out-of-scope"][locale];
}

/** 档位一句话解释，用于 title / 提示条。 */
export function tierHint(tier: DriverTier): string {
	return TIER_HINTS[tier] ?? TIER_HINTS["out-of-scope"];
}

/** 未实现原因（引擎 reason 键）→ 中文说明。 */
export function tierReasonText(dbType: string | null | undefined): string {
	const entry = tierEntryFor(dbType);
	if (!entry) return "该类型未在引擎注册表中登记。";
	if (entry.ready) return "引擎已实现。";
	return tierHint(entry.tier);
}

/** 档位统计，用于设置页/详情页如实交代能力面。 */
export function tierStats(): { total: number; ready: number; byTier: Record<DriverTier, number> } {
	const byTier: Record<DriverTier, number> = { "first-class": 0, experimental: 0, "out-of-scope": 0 };
	for (const entry of DRIVER_TIER_TABLE) byTier[entry.tier] += 1;
	return {
		total: DRIVER_TIER_TABLE.length,
		ready: DRIVER_TIER_TABLE.filter((entry) => entry.ready).length,
		byTier,
	};
}
