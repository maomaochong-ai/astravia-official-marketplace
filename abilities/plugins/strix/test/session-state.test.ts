import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_LIMITS, normalizeLimits, Budget } from "../src/service/budget";
import { Telemetry } from "../src/service/telemetry";
import { listHistory } from "../src/service/history";
import { checkFreshness, skillsProvenance, stampedDigest } from "../src/service/freshness";

/**
 * 会话与状态的四件事（ADR 0018）：预算 / 本机统计 / 历史 / 新鲜度。
 *
 * 它们对齐上游的四项能力，但**成本模型不同**：上游付模型费、发遥测、问服务器要更新；
 * 本插件没有模型调用、不联网。所以这四条钉的是"我们的版本"：
 *  - 预算拦得住（超限拒绝，而不是悄悄少记）；
 *  - 统计只落本机、不采内容（要能证明"没有目标/命令/标题"进文件）；
 *  - 历史从磁盘推导，没有任何写入路径；
 *  - 新鲜度只读本地（服务摘要 / 技能来源 / 镜像时间），不假装知道远端。
 */

describe("budget refuses instead of silently truncating", () => {
	it("counts calls and findings, and reports what is spent", () => {
		const budget = new Budget({ maxToolCalls: 2 });
		expect(budget.snapshot().exhausted).toEqual([]);
		budget.spendToolCall();
		budget.spendFinding();
		const state = budget.snapshot();
		expect(state.used.toolCalls).toBe(1);
		expect(state.used.findings).toBe(1);
		expect(state.exhausted).toEqual([]);
	});

	it("flags the dimension that hit its limit, with a reason", () => {
		const budget = new Budget({ maxToolCalls: 1, maxFindings: 1 });
		budget.spendToolCall();
		budget.spendFinding();
		const state = budget.snapshot();
		expect(state.exhausted).toContain("toolCalls");
		expect(state.exhausted).toContain("findings");
		expect(state.reason).toContain("工具调用");
	});

	it("treats 0 and junk as unlimited, never as 'blocked'", () => {
		// 0 = 不限；把 0 当成"零额度"会让默认配置一上来就拒绝一切。
		expect(normalizeLimits({ maxToolCalls: 0, maxMinutes: -3, maxFindings: "abc" })).toEqual(DEFAULT_LIMITS);
		const budget = new Budget();
		for (let index = 0; index < 50; index += 1) budget.spendToolCall();
		expect(budget.snapshot().exhausted).toEqual([]);
	});
});

describe("local stats never carry content", () => {
	it("counts tool names only — no targets, commands or titles", async () => {
		const dir = mkdtempSync(join(tmpdir(), "strix-telemetry-"));
		try {
			const telemetry = new Telemetry(dir);
			await telemetry.serviceStarted();
			await telemetry.toolCalled("strix_exec");
			await telemetry.toolCalled("strix_exec");
			await telemetry.findingRecorded();
			await telemetry.assessmentStarted();

			const snapshot = await telemetry.snapshot();
			expect(snapshot.toolCalls).toEqual({ strix_exec: 2 });
			expect(snapshot.topTools[0]).toEqual({ name: "strix_exec", calls: 2 });
			expect(snapshot.findings).toBe(1);
			expect(snapshot.assessments).toBe(1);

			const raw = (await import("node:fs")).readFileSync(join(dir, "telemetry.json"), "utf8");
			// 内容一个都不许落地：只允许工具名与计数。
			expect(raw).not.toMatch(/target|command|http/i);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("history is derived, never written", () => {
	it("merges ledger files into one entry per assessment", () => {
		const dir = mkdtempSync(join(tmpdir(), "strix-history-"));
		try {
			mkdirSync(join(dir, "findings"), { recursive: true });
			mkdirSync(join(dir, "coverage"), { recursive: true });
			writeFileSync(
				join(dir, "findings", "conv-a.json"),
				JSON.stringify({ findings: [{ title: "IDOR", targets: ["https://a.test"] }, { title: "XSS" }] }),
			);
			writeFileSync(join(dir, "coverage", "conv-b.json"), JSON.stringify({ targets: ["https://b.test"] }));

			const entries = listHistory(dir);
			expect(entries.map((entry) => entry.key).sort()).toEqual(["conv-a", "conv-b"]);
			const a = entries.find((entry) => entry.key === "conv-a");
			expect(a?.findings).toBe(2);
			expect(a?.targets).toContain("https://a.test");
			expect(a?.report).toBe(false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns nothing for an empty data dir instead of throwing", () => {
		const dir = mkdtempSync(join(tmpdir(), "strix-history-empty-"));
		try {
			expect(listHistory(dir)).toEqual([]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("freshness only claims what it can read locally", () => {
	it("reads the stamped digest from the platform table", () => {
		// 盖章的真实位置：providers.services[].runtime.platforms[<tag>].artifacts[].sha256
		const manifest = {
			providers: {
				services: [
					{
						runtime: {
							platforms: {
								"win32-x64": { artifacts: [{ sha256: "win-digest", destination: "dist/service/main.mjs" }] },
								"linux-x64": { artifacts: [{ sha256: "linux-digest", destination: "dist/service/main.mjs" }] },
							},
						},
					},
				],
			},
		};
		expect(stampedDigest(manifest, "linux-x64")).toBe("linux-digest");
		// 未知平台退回任一平台：各平台是同一份构建。
		expect(stampedDigest(manifest, "plan9")).toBe("win-digest");
		expect(stampedDigest({})).toBeNull();
		expect(stampedDigest(null)).toBeNull();
	});

	it("pulls the upstream marker out of PROVENANCE", () => {
		expect(skillsProvenance("Source: github.com/usestrix/strix @ 3f9a2c1\n")).toBe("3f9a2c1");
		expect(skillsProvenance("Fetched 2026-11-02 from upstream\n")).toBe("2026-11-02");
		expect(skillsProvenance("no marker here")).toBeNull();
	});

	it("reports every item, and never guesses a remote update", async () => {
		const dir = mkdtempSync(join(tmpdir(), "strix-fresh-"));
		try {
			mkdirSync(join(dir, "dist/service"), { recursive: true });
			mkdirSync(join(dir, "agent/skills/library"), { recursive: true });
			writeFileSync(join(dir, "dist/service/main.mjs"), "// built\n");
			writeFileSync(join(dir, "agent/skills/library/PROVENANCE.md"), "Source: upstream @ abc1234\n");
			// 盖章故意写错：这正是"改了服务没重建"的现场。
			writeFileSync(
				join(dir, "plugin.json"),
				JSON.stringify({
					providers: {
						services: [{ runtime: { platforms: { "win32-x64": { artifacts: [{ sha256: "deadbeef" }] } } } }],
					},
				}),
			);

			const report = await checkFreshness({
				pluginRoot: dir,
				pluginVersion: "9.9.9",
				image: "ghcr.io/usestrix/strix-sandbox:0.1.0",
				inspectImage: async () => ({ created: "2026-11-01T10:00:00Z" }),
			});
			const byId = Object.fromEntries(report.items.map((item) => [item.id, item]));
			expect(report.pluginVersion).toBe("9.9.9");
			expect(byId.service?.state).toBe("stale");
			expect(byId.service?.action).toContain("npm run build");
			expect(byId.skills?.state).toBe("current");
			expect(byId.image?.detail).toContain("2026-11-01");
			// 镜像那条只陈述本地事实，不出现“有新版本”这种它无法知道的话。
			expect(byId.image?.detail).not.toMatch(/newer|update available|最新/i);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
