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

describe("responsibility is localisable", () => {
	it("declares every member responsibility as a locale key", () => {
		for (const member of team.members) {
			expect(member.responsibility, member.agent).toMatch(/^%team\.responsibility\.[a-z]+%$/);
		}
	});

	it("has text for every key in both locales", () => {
		for (const member of team.members) {
			const key = member.responsibility.replaceAll("%", "");
			expect(zh[key], key).toBeTruthy();
			expect(en[key], key).toBeTruthy();
			// 职责是一句话，不是一段说明：面板把它放在 chip 的 title 里。
			expect((zh[key] ?? "").length).toBeLessThanOrEqual(64);
		}
	});

	it("resolves through the service for the model, and through the panel for the reader", () => {
		// 服务没有 i18n 上下文，读随包的文案表；面板用自己的 t。
		const service = read("src/service/labels.ts");
		expect(service).toContain("loadLabels");
		expect(service).toContain("locales");
		const main = read("src/service/main.ts");
		expect(main).toContain("t: (key) => resolveLabel(labels");
		const panel = read("src/domain/manifest-label.ts");
		expect(panel).toContain("%(.+)%");
	});
});
