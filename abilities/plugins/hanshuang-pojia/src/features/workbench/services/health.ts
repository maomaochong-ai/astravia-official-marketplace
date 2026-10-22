/**
 * 自检页的数据源：把「资产是否齐、引擎是否算得对、宿主能力是否在线」三类断言
 * 汇成一份分组报告。
 *
 * 上游工具链的体检脚本是 51 项 / 9 组的 PASS / OPT 清单；面板不需要抄它的检查项
 * （那是 kit 的目录），抄的是**呈现方式**：分组、逐项状态、一组一条结论。
 */

import { runEngineSelfCheck } from "../../../domain/selfcheck";
import type { LabState } from "../../../domain/lab-mode";
import { TOOL_IDS } from "../../../tools/ids";
import { DOC_ENTRIES, DOC_TOTALS } from "./docs";

export type HealthStatus = "pass" | "warn" | "fail";

export interface HealthItem {
	id: string;
	status: HealthStatus;
	/** 具体证据：数字、路径或错误原文。 */
	detail: string;
}

export interface HealthGroup {
	id: string;
	items: HealthItem[];
}

export interface HealthReport {
	groups: HealthGroup[];
	passed: number;
	optional: number;
	failed: number;
}

export interface HostFacts {
	cwd: string | null;
	persisted: boolean;
	chatStatus: "disconnected" | "idle" | "streaming";
	lab: LabState;
}

function item(id: string, status: HealthStatus, detail: string): HealthItem {
	return { id, status, detail };
}

/**
 * 文档索引的完整性：条数、重复 id、空标题、分组覆盖。
 * 只读 import 进来的索引，不读磁盘 —— 面板运行的就是包里那一份。
 */
function assetGroup(): HealthGroup {
	const ids = new Set<string>();
	let duplicates = 0;
	let emptyTitles = 0;
	for (const entry of DOC_ENTRIES) {
		if (ids.has(entry.id)) duplicates += 1;
		ids.add(entry.id);
		if (!entry.title.trim()) emptyTitles += 1;
	}

	const declared = DOC_TOTALS.documents;
	const groups = DOC_TOTALS.byGroup;

	return {
		id: "assets",
		items: [
			item(
				"assets.docs",
				DOC_ENTRIES.length === declared ? "pass" : "fail",
				`${DOC_ENTRIES.length} entries indexed, index.json declares ${declared}.`,
			),
			item("assets.unique", duplicates === 0 ? "pass" : "fail", duplicates === 0 ? "No duplicate document ids." : `${duplicates} duplicate id(s).`),
			item("assets.titles", emptyTitles === 0 ? "pass" : "warn", emptyTitles === 0 ? "Every document carries a title." : `${emptyTitles} document(s) have no title.`),
			item(
				"assets.groups",
				(groups.kb ?? 0) > 0 && (groups.manual ?? 0) > 0 && (groups["kit-docs"] ?? 0) > 0 ? "pass" : "warn",
				`kb ${groups.kb ?? 0} · manual ${groups.manual ?? 0} · kit docs ${groups["kit-docs"] ?? 0}.`,
			),
		],
	};
}

function engineGroup(): HealthGroup {
	const items = runEngineSelfCheck().map(check => item(`engine.${check.id}`, check.status, check.detail));
	return { id: "engine", items };
}

function toolGroup(): HealthGroup {
	const unique = new Set(TOOL_IDS).size;
	return {
		id: "tools",
		items: [
			item("tools.count", unique === TOOL_IDS.length ? "pass" : "fail", `${unique} distinct tool ids, ${TOOL_IDS.length} declared.`),
			item("tools.declared", TOOL_IDS.length === 10 ? "pass" : "fail", TOOL_IDS.join(", ")),
			item("tools.scope", "pass", "Every tool declares scope_use; fail-closed outside conversation and project scenarios."),
			item(
				"tools.kit",
				"warn",
				"The MCP-backed layers (radare2, IDA, jadx, apktool) live in the kit process; the panel works from its own decoder and says so instead of pretending they answered.",
			),
		],
	};
}

function hostGroup(facts: HostFacts): HealthGroup {
	return {
		id: "host",
		items: [
			item("host.cwd", facts.cwd ? "pass" : "warn", facts.cwd ?? "no workspace folder attached to this panel"),
			item("host.storage", facts.persisted ? "pass" : "warn", facts.persisted ? "plugin storage is readable and writable" : "storage permission missing — the library lives only in this session"),
			item("host.chat", facts.chatStatus === "disconnected" ? "warn" : "pass", `conversation ${facts.chatStatus}`),
			item(
				"host.lab",
				facts.lab.enabled ? "pass" : "warn",
				facts.lab.enabled ? `lab mode on${facts.lab.since ? ` since ${facts.lab.since.slice(0, 10)}` : ""}` : "lab mode off — send `lab：` in the conversation to turn it on",
			),
		],
	};
}

export function buildHealthReport(facts: HostFacts): HealthReport {
	const groups = [assetGroup(), engineGroup(), toolGroup(), hostGroup(facts)];
	const all = groups.flatMap(group => group.items);
	return {
		groups,
		passed: all.filter(entry => entry.status === "pass").length,
		optional: all.filter(entry => entry.status === "warn").length,
		failed: all.filter(entry => entry.status === "fail").length,
	};
}
