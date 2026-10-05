/**
 * 连接配置导入 / 导出 — 连接树工具栏的两个动作。
 *
 * 导出：读当前全部连接，剔除密码（密码只存在宿主加密 vault，不随文件落盘），
 *      通过浏览器下载生成 JSON 文件；
 * 导入：解析 JSON（本插件导出的 { connections } 包裹格式或裸数组），逐条校验后
 *      走 writeConfig 写入（引擎 + 本地镜像 + vault 同一条权威路径），同名连接更新。
 */

import type { DbConnection } from "../../../domain/connection-config";
import { readAllConfigs, writeConfig } from "../../../domain/dbx-storage";

const TRANSFER_SCHEMA_VERSION = 1;

export interface ConnectionTransferFile {
	schemaVersion: number;
	exportedAt: string;
	connections: DbConnection[];
}

export interface ImportConnectionsResult {
	total: number;
	imported: number;
	updated: number;
	failed: number;
	errors: string[];
}

function stamp(): string {
	const d = new Date();
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * 导出全部连接为 JSON 文件并触发下载。密码字段强制清空，
 * 返回实际导出的连接数（0 时不产生文件）。
 */
export async function exportConnectionsFile(): Promise<number> {
	const configs = await readAllConfigs();
	if (configs.length === 0) return 0;

	const payload: ConnectionTransferFile = {
		schemaVersion: TRANSFER_SCHEMA_VERSION,
		exportedAt: new Date().toISOString(),
		// 密码不导出：文件里不留明文，导入后需要重新填写密码。
		connections: configs.map((c) => ({ ...c, password: "" })),
	};

	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	try {
		const a = document.createElement("a");
		a.href = url;
		a.download = `dbx-pro-connections-${stamp()}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	} finally {
		// 让浏览器有机会发起下载后再回收对象 URL。
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
	return configs.length;
}

/** 最低限度的连接结构校验：只有能安全写引擎的条目才导入。 */
function isImportableConnection(value: unknown): value is DbConnection {
	if (!value || typeof value !== "object") return false;
	const c = value as Record<string, unknown>;
	return (
		typeof c.name === "string" &&
		c.name.trim().length > 0 &&
		typeof c.db_type === "string" &&
		c.db_type.trim().length > 0 &&
		typeof c.host === "string" &&
		c.host.trim().length > 0
	);
}

/** 从文件文本提取连接数组，兼容包裹格式与裸数组。 */
function parseTransferText(text: string): DbConnection[] {
	const parsed = JSON.parse(text) as unknown;
	const list = Array.isArray(parsed)
		? parsed
		: parsed && typeof parsed === "object" && Array.isArray((parsed as { connections?: unknown }).connections)
			? (parsed as { connections: unknown[] }).connections
			: null;
	if (!list) throw new Error("文件格式不正确：缺少 connections 列表");
	return list.filter(isImportableConnection);
}

/**
 * 从文本导入连接。同名连接按更新处理（writeConfig 对引擎是幂等覆盖）。
 * 单条失败不影响其他条目，错误收集在结果里返回。
 */
export async function importConnectionsFromText(text: string): Promise<ImportConnectionsResult> {
	const candidates = parseTransferText(text);
	const existing = await readAllConfigs();
	const existingNames = new Set(existing.map((c) => c.name));

	const result: ImportConnectionsResult = {
		total: candidates.length,
		imported: 0,
		updated: 0,
		failed: 0,
		errors: [],
	};

	for (const candidate of candidates) {
		try {
			// 缺 id 补一个；保留密码字段（若文件带了就透传给 vault），否则置空。
			const config: DbConnection = {
				...candidate,
				id: typeof candidate.id === "string" && candidate.id ? candidate.id : `conn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
				password: typeof candidate.password === "string" ? candidate.password : "",
			};
			await writeConfig(config);
			if (existingNames.has(config.name)) result.updated += 1;
			else {
				result.imported += 1;
				existingNames.add(config.name);
			}
		} catch (err) {
			result.failed += 1;
			result.errors.push(`${candidate.name}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	return result;
}
