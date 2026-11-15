import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readRoster } from "../src/service/team";

/**
 * 团队成员（ADR 0016）：插件**声明**，宿主**运行**。
 *
 * 这条决定的边界很窄但很重要：我们不复制上游的子智能体循环（那需要插件自己持模型），
 * 而是用宿主已有的 `agent.agents` / `agent.teams`——装好插件，输入框里就能 @ 到这几个人。
 * 服务侧只负责把清单读回来，并与**已记录的发现**对账。
 */

const plugin = resolve(process.cwd());

describe("the manifest declares a team the host can run", () => {
	const manifest = JSON.parse(readFileSync(join(plugin, "plugin.json"), "utf8")) as {
		agent?: {
			agents?: Array<{ id: string; name: string; systemPromptPath?: string; roles?: string[]; abilities?: string }>;
			teams?: Array<{ id: string; name: string; workflowPath?: string; members: Array<{ agent?: string; responsibility: string; instructionsPath?: string }> }>;
		};
	};

	it("gives every member a persona file that exists", () => {
		for (const member of manifest.agent?.agents ?? []) {
			expect(member.systemPromptPath, member.id).toBeTruthy();
			expect(() => readFileSync(join(plugin, member.systemPromptPath as string)), member.id).not.toThrow();
			// 每个人的名字都走 i18n 占位：中文安装下不该看到英文名。
			expect(member.name).toMatch(/^%.+%$/);
		}
	});

	it("declares roles the host vocabulary knows", () => {
		const known = ["master", "developer", "researcher", "auditor", "business", "designer"];
		for (const member of manifest.agent?.agents ?? []) {
			expect(member.roles?.length ?? 0).toBeGreaterThan(0);
			for (const role of member.roles ?? []) expect(known).toContain(role);
		}
	});

	it("gives members the host's full ability set", () => {
		// 1.0.11：不再收窄到 own。ADR 0003 禁的是"插件自持模型循环"，不是"限制工具面"。
		// 真实渗透要 shell、文件编辑、联网检索这些宿主能力；挡掉它们等于让成员缺一只手臂。
		for (const member of manifest.agent?.agents ?? []) expect(member.abilities).toBe("all");
	});

	it("puts the lead first and gives the team a workflow", () => {
		const team = manifest.agent?.teams?.[0];
		expect(team).toBeTruthy();
		expect(team?.members[0]?.agent).toBe("strix-lead");
		expect(team?.workflowPath).toBeTruthy();
		expect(() => readFileSync(join(plugin, team?.workflowPath as string))).not.toThrow();
		// 每位非队长成员都有自己的任务书：只靠职责一句话，宿主那边干起来还是同一套。
		for (const member of team?.members.slice(1) ?? []) {
			expect(member.instructionsPath, member.agent).toBeTruthy();
			expect(() => readFileSync(join(plugin, member.instructionsPath as string))).not.toThrow();
		}
	});
});

describe("the service reads that roster back", () => {
	it("lists members in declared order and marks the lead", () => {
		const roster = readRoster(plugin);
		expect(roster).toBeTruthy();
		expect(roster?.members.length).toBe(4);
		expect(roster?.members[0]?.lead).toBe(true);
		expect(roster?.members.slice(1).every((member) => !member.lead)).toBe(true);
		expect(roster?.teamId).toBe("strix-assessment");
	});

	it("counts only signatures that match a real member", () => {
		const roster = readRoster(plugin, {
			findings: [{ member: "strix-recon" }, { member: "strix-recon" }, { member: "ghost" }, {}],
		});
		expect(roster?.filed).toEqual({ "strix-recon": 2 });
		// 对不上的一律不计数：宁可说 0，也不给“某人做了多少”编数字。
		expect(roster?.totalFiled).toBe(2);
	});

	it("returns null instead of a fake team when the manifest has none", () => {
		const empty = readFileSync(join(plugin, "plugin.json"), "utf8");
		expect(empty.length).toBeGreaterThan(0);
		// 用一个必然没有 agent 段的目录证明“没有就说没有”。
		expect(readRoster(join(plugin, "locales"))).toBeNull();
	});
});
