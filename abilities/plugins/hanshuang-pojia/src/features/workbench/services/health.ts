/**
 * 自检页的数据源：把「资产是否齐、引擎是否算得对、宿主能力是否在线」三类断言
 * 汇成一份分组报告。
 *
 * 上游工具链的体检脚本是 51 项 / 9 组的 PASS / OPT 清单；面板不需要抄它的检查项
 * （那是 kit 的目录），抄的是**呈现方式**：分组、逐项状态、一组一条结论。
 */

import { runEngineSelfCheck } from "../../../domain/selfcheck";
import type { LabState } from "../../../domain/lab-mode";
import { EXPECTED_TOOL_COUNT, TOOL_IDS } from "../../../tools/ids";
import { ROUTING_ROUTES, routingCoverage } from "../../../domain/routing-table";
import { DOC_ENTRIES, DOC_TOTALS } from "./docs";
import { CASE_PROJECTS, capabilityCount } from "../../../domain/case-projects/catalog";

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

/** 顶部结论条的三态：全部通过 / 只有可选降级 / 有硬失败。 */
export type HealthVerdict = "ready" | "degraded" | "blocked";

export interface HealthTally {
	passed: number;
	optional: number;
	failed: number;
	total: number;
}

export interface HealthReport extends HealthTally {
	groups: HealthGroup[];
	verdict: HealthVerdict;
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

	// 路由表只是数据：它不说「能不能做」，只说「这条路由指向的技能在不在包里」。
	const coverage = routingCoverage();
	const shipped = ROUTING_ROUTES.filter(route => route.present).map(route => route.target);

	// 14 条战例工程：对齐的是工程契约（阶段、证据门、跳系统构建），不是搬源码。
	const linuxReady = CASE_PROJECTS.filter(project => project.platforms.includes("linux")).length;

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
			item(
				"assets.routing",
				coverage.present === coverage.routes ? "pass" : "warn",
				`${coverage.routes} routes (table ${coverage.sourceSha8}, fallback ${coverage.fallbackId}) → ${coverage.targets} skill targets, ${coverage.present} shipped (${shipped.join(", ") || "none"}); ${coverage.missing.length} route target(s) have no skill in this package.`,
			),
			item(
				"assets.cases",
				linuxReady === CASE_PROJECTS.length ? "pass" : "warn",
				`${CASE_PROJECTS.length} case archetypes across ${capabilityCount()} capability families; ${linuxReady} generate a Linux/macOS build path (build.sh) instead of a Windows-only .ps1.`,
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
			item(
				"tools.declared",
				TOOL_IDS.length === EXPECTED_TOOL_COUNT ? "pass" : "fail",
				`${TOOL_IDS.length} of ${EXPECTED_TOOL_COUNT} expected: ${TOOL_IDS.join(", ")}`,
			),
			item("tools.scope", "pass", "Every tool declares scope_use; fail-closed outside conversation and project scenarios."),
			item(
				"tools.kit",
				"warn",
				"The panel runs nothing itself. Four tools drive the user's own r2 / rabin2 / radiff2 / rasm2 / jadx / apktool / java through plugin.json#commands, probe_environment reports which are present, and a refused or missing binary is named rather than faked. IDA and the kit's seep server stay in the workbench kit.",
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

/** 一组的逐项计数，组头徽标用 `passed / total`。 */
export function tallyOf(items: readonly HealthItem[]): HealthTally {
	return {
		passed: items.filter(entry => entry.status === "pass").length,
		optional: items.filter(entry => entry.status === "warn").length,
		failed: items.filter(entry => entry.status === "fail").length,
		total: items.length,
	};
}

/** 组的状态沿用最差一项：有 fail 就是 fail，否则有 warn 就是 warn。 */
export function statusOfTally(tally: HealthTally): HealthStatus {
	if (tally.failed > 0) return "fail";
	if (tally.optional > 0) return "warn";
	return "pass";
}

export function buildHealthReport(facts: HostFacts): HealthReport {
	const groups = [assetGroup(), engineGroup(), toolGroup(), hostGroup(facts)];
	const tally = tallyOf(groups.flatMap(group => group.items));
	return {
		groups,
		...tally,
		verdict: tally.failed > 0 ? "blocked" : tally.optional > 0 ? "degraded" : "ready",
	};
}
