/**
 * 团队成员：插件**声明**，宿主**运行**。
 *
 * 上游 TUI 有一支自己的子智能体队伍（`tools/agents_graph` + `render/agents_graph.go`），
 * 前提是上游自己持有模型循环。本插件没有循环，
 * 所以"派生子智能体"这条能力我们不复制；能复用的是宿主已经具备的那一半——
 * **插件在 `plugin.json` 里声明 `agent.agents` / `agent.teams`，宿主把它们铺成团队成员，
 * 用户在输入框里 @ 得到它们**。
 *
 * 于是服务侧只需要一件事：把清单读出来，并把它与**已经记录下来的证据**对账——
 * 谁记了几条发现。对账不上就如实说 0，不按"应该由谁做"编数字。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface TeamMember {
	/** `agent.teams[].members[].agent` 里的 id（插件内唯一）。 */
	id: string;
	name: string;
	/** 角色槽位（宿主词表：master/developer/researcher/auditor/…）。 */
	role?: string;
	responsibility: string;
	/** 队长：团队第一个成员，也是用户在会话里唯一的对话入口。 */
	lead: boolean;
}

export interface TeamRoster {
	teamId: string;
	teamName: string;
	workflow?: string;
	members: TeamMember[];
	/** 成员 id → 它署名的发现数（只有能对上的才出现）。 */
	filed: Record<string, number>;
	totalFiled: number;
}

interface ManifestAgent {
	id?: unknown;
	name?: unknown;
	roles?: unknown;
	description?: unknown;
}

interface ManifestTeamMember {
	agent?: unknown;
	role?: unknown;
	responsibility?: unknown;
}

interface ManifestTeam {
	id?: unknown;
	name?: unknown;
	workflowPath?: unknown;
	members?: unknown;
}

/** `%key%` 占位由宿主按插件 locales 解析；这里读目录原始文本，解析交给传进来的 `t`。 */
function resolveLabel(value: unknown, t?: (key: string) => string): string {
	const text = String(value ?? "").trim();
	const wrapped = /^%(.+)%$/.exec(text);
	if (wrapped && t) {
		const translated = t(wrapped[1]);
		return translated === wrapped[1] ? wrapped[1] : translated;
	}
	return text;
}

export function readRoster(
	pluginRoot: string,
	options: { t?: (key: string) => string; findings?: readonly { member?: string | undefined }[] } = {},
): TeamRoster | null {
	let manifest: { agent?: { agents?: unknown; teams?: unknown } };
	try {
		manifest = JSON.parse(readFileSync(join(pluginRoot, "plugin.json"), "utf8")) as typeof manifest;
	} catch {
		return null;
	}
	const teams = Array.isArray(manifest.agent?.teams) ? (manifest.agent.teams as ManifestTeam[]) : [];
	const team = teams[0];
	if (!team) return null;
	const profiles = new Map<string, ManifestAgent>();
	for (const profile of Array.isArray(manifest.agent?.agents) ? (manifest.agent.agents as ManifestAgent[]) : []) {
		if (typeof profile.id === "string") profiles.set(profile.id, profile);
	}

	const members: TeamMember[] = [];
	for (const [index, raw] of (Array.isArray(team.members) ? (team.members as ManifestTeamMember[]) : []).entries()) {
		const id = typeof raw.agent === "string" ? raw.agent : "";
		if (!id) continue;
		const profile = profiles.get(id);
		const roles = Array.isArray(profile?.roles) ? (profile.roles as unknown[]) : [];
		members.push({
			id,
			name: resolveLabel(profile?.name, options.t) || id,
			...(typeof roles[0] === "string" ? { role: roles[0] } : {}),
			// 职责是作者内容（宿主原样拷贝并允许用户改），所以只在它恰是 `%key%` 时才解；
			// 没给则退回成员自己的描述——两句都是给人看的，不编第三句。
			responsibility: resolveLabel(raw.responsibility, options.t) || resolveLabel(profile?.description, options.t),
			lead: index === 0,
		});
	}
	if (members.length === 0) return null;

	const filed: Record<string, number> = {};
	let totalFiled = 0;
	const known = new Set(members.map((member) => member.id));
	for (const finding of options.findings ?? []) {
		const member = finding.member;
		if (!member || !known.has(member)) continue;
		filed[member] = (filed[member] ?? 0) + 1;
		totalFiled += 1;
	}

	return {
		teamId: String(team.id ?? ""),
		teamName: resolveLabel(team.name, options.t) || String(team.id ?? ""),
		...(typeof team.workflowPath === "string" ? { workflow: team.workflowPath } : {}),
		members,
		filed,
		totalFiled,
	};
}
