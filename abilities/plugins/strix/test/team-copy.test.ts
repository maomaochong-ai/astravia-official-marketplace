import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 团队的称呼（1.0.14）。
 *
 * 三条要求，逐条钉住：
 *  1. 团队名统一，且一眼能看出这是干什么的——用户读到的是定位，不是花名；
 *  2. 成员名只说一种语言：中文宿主看到"罗盘"，英文宿主看到 Compass，不出现"中文 · English"；
 *  3. 职责也能本地化：清单里是 `%key%`，面板与服务各自按自己的语言解。
 */

const plugin = resolve(process.cwd());
const read = (path: string): string => readFileSync(join(plugin, path), "utf8");
const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
const en = JSON.parse(read("locales/en.json")) as Record<string, string>;
const manifest = JSON.parse(read("plugin.json")) as {
	agent: { agents: Array<{ id: string; name: string }>; teams: Array<{ name: string; description: string; members: Array<{ agent: string; responsibility: string }> }> };
};
const team = manifest.agent.teams[0]!;

describe("the team has one name and says what it does", () => {
	it("is called the Strix team in both locales", () => {
		expect(zh["team.assessment.name"]).toBe("Strix 团队");
		expect(en["team.assessment.name"]).toBe("Strix Team");
		// 清单里存的是键，不是某一种语言的字面量。
		expect(team.name).toBe("%team.assessment.name%");
	});

	it("describes the work, not the metaphor", () => {
		// 定位句必须点到"在会话里跑一次渗透测试"和交付物；只写"四个角色共用一份台账"就是自说自话。
		const zhText = zh["team.assessment.description"] ?? "";
		expect(zhText).toMatch(/渗透测试|评估/);
		expect(zhText).toMatch(/报告/);
		expect(zhText).toMatch(/证据/);
		expect(zhText.length).toBeLessThanOrEqual(96);

		const enText = en["team.assessment.description"] ?? "";
		expect(enText).toMatch(/assessment|penetration test/i);
		expect(enText).toMatch(/report/i);
	});
});

describe("a member is named in one language", () => {
	const names = { zh: ["agent.lead.name", "agent.recon.name", "agent.exploit.name", "agent.auditor.name"], en: ["agent.lead.name", "agent.recon.name", "agent.exploit.name", "agent.auditor.name"] };

	it("never mixes Chinese and English in one label", () => {
		for (const key of names.zh) {
			for (const locale of [zh, en]) {
				const value = locale[key] ?? "";
				expect(value).not.toMatch(/·/);
				expect(value).not.toMatch(/[A-Za-z]{3,}\s+[A-Za-z]{3,}/);
			}
		}
	});

	it("keeps the Chinese set Chinese and the English set English", () => {
		for (const key of names.zh) expect(zh[key]).toMatch(/[\u4e00-\u9fa5]/);
		for (const key of names.en) expect(en[key]).toMatch(/^[A-Za-z][A-Za-z ]*$/);
	});

	it("no longer needs to strip a bilingual suffix in the UI", () => {
		// 以前名字是"罗盘 · Compass"，面板只好用正则把后半截剪掉；名字单语之后这段就不该存在。
		const launch = read("src/features/scan-console/components/launch-screen.tsx");
		expect(launch).not.toContain("·s*[A-Za-z]");
		expect(launch).toContain("manifestLabel(t, member.name)");
	});
});

describe("responsibility is authored content, not a label", () => {
	it("writes literal text, because the host copies that field verbatim", () => {
		// 宿主只对 agent.name/description 与 team.name/description 调 resolvePluginText；
		// member.responsibility 原样拷贝（plugin-agent-presets.ts:334），面板也原样渲染
		// （TeamSettingsSheet.tsx:498/622）。写成 %key% 就会在“本团队内职责”里漏出变量名。
		for (const member of team.members) {
			expect(member.responsibility, member.agent).not.toContain("%");
			expect(member.responsibility.trim().length, member.agent).toBeGreaterThan(0);
			// 一句话，不是一段说明：面板把它放在 chip 的 title 里。
			expect(member.responsibility.length, member.agent).toBeLessThanOrEqual(64);
		}
	});

	it("keeps no stale responsibilities in the locale tables", () => {
		for (const table of [zh, en]) {
			expect(Object.keys(table).filter((key) => key.startsWith("team.responsibility."))).toEqual([]);
		}
	});

	it("resolves names through the service for the model, and through the panel for the reader", () => {
		// 名字是 %key%，两边各解一次：服务读随包 locales（给模型与名册），面板用宿主 t（给人看）。
		const service = read("src/service/labels.ts");
		expect(service).toContain("loadLabels");
		expect(service).toContain("locales");
		const main = read("src/service/main.ts");
		expect(main).toContain("t: (key) => resolveLabel(labels");
		const panel = read("src/domain/manifest-label.ts");
		expect(panel).toContain("%(.+)%");
		// 字面文本会原样穿过去，不会被当成占位符二次解释。
		expect(panel).toContain("if (!wrapped) return text");
	});
});
