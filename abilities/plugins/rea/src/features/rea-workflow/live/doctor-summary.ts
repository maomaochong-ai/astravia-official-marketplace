/**
 * doctor 报告里「除 checks 之外」的那部分事实：CLI 版本、安装路径、目录规模、
 * Skill 与客户端注册状态、整体健康标记。
 *
 * 为什么值得单独解析：这些字段本来就在同一份 JSON 里（一次调用就能拿到），
 * 却决定用户接下来该做什么 —— 版本过旧要升级、安装路径有多条要先清理、
 * Skill 缺失要跑 setup。只显示 25 条 checks 会让人看不出问题在哪一层。
 *
 * 原则：字段缺就留 null，不用默认值编一个看起来正常的数字。
 */

import {
	asDoctorCheck,
	parseDoctorDocument,
	type DoctorCheck,
} from "./doctor-readiness";

export interface DoctorCatalogCounts {
	readonly cliCommands: number | null;
	readonly mcpTools: number | null;
	readonly mcpPrompts: number | null;
}

export interface DoctorSummary {
	/** doctor 的整体结论（含环境）；null 表示这一版 CLI 没给这个字段。 */
	readonly healthy: boolean | null;
	readonly environmentHealthy: boolean | null;
	/** 扫描范围，例如 audit-wide。 */
	readonly scopeMode: string | null;
	readonly cliVersion: string | null;
	readonly skillState: string | null;
	readonly skillVersion: string | null;
	/** rea 可执行文件的实际位置；多于一条意味着一台机器上有多个安装。 */
	readonly installPaths: readonly string[];
	readonly installState: string | null;
	readonly catalog: DoctorCatalogCounts;
	/** 客户端注册（claude_code / codex / …）的 state 汇总。 */
	readonly registrations: readonly { readonly client: string; readonly state: string }[];
}

export interface DoctorReportData {
	readonly checks: readonly DoctorCheck[];
	readonly summary: DoctorSummary;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

function readInstallPaths(installations: Record<string, unknown> | null): readonly string[] {
	const paths = installations?.paths;
	if (!Array.isArray(paths)) return [];
	return paths.filter((path): path is string => typeof path === "string" && path.length > 0);
}

function readRegistrations(identity: Record<string, unknown> | null): readonly { client: string; state: string }[] {
	const list = identity?.registrations;
	if (!Array.isArray(list)) return [];
	const rows: { client: string; state: string }[] = [];
	for (const entry of list) {
		const record = asRecord(entry);
		const client = asString(record?.client);
		if (client === null) continue;
		rows.push({ client, state: asString(record?.state) ?? "unknown" });
	}
	return rows;
}

/** 从已经解析好的 doctor 文档里抽出摘要字段。 */
export function summarizeDoctor(document: Record<string, unknown>): DoctorSummary {
	const identity = asRecord(document.identity);
	const installations = asRecord(identity?.installations);
	const skill = asRecord(identity?.skill);
	const counts = asRecord(asRecord(identity?.catalog)?.counts);
	const scope = asRecord(document.scope);

	return {
		healthy: asBoolean(document.healthy),
		environmentHealthy: asBoolean(document.environment_healthy),
		scopeMode: asString(scope?.mode),
		cliVersion: asString(identity?.cli_package_version),
		skillState: asString(skill?.state),
		skillVersion: asString(skill?.installed_version),
		installPaths: readInstallPaths(installations),
		installState: asString(installations?.state),
		catalog: {
			cliCommands: asNumber(counts?.cli_commands),
			mcpTools: asNumber(counts?.mcp_tools),
			mcpPrompts: asNumber(counts?.mcp_prompts),
		},
		registrations: readRegistrations(identity),
	};
}

/** checks + 摘要一次解析：面板只需要一次 JSON.parse，两者来自同一份输出。 */
export function parseDoctorReport(stdout: string): DoctorReportData | null {
	const document = parseDoctorDocument(stdout);
	if (document === null) return null;
	const raw = document.checks;
	if (!Array.isArray(raw)) return null;
	const checks = raw.map(asDoctorCheck).filter((check): check is DoctorCheck => check !== null);
	return { checks, summary: summarizeDoctor(document) };
}
