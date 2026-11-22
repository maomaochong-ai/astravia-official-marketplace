import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { storageEntry } from "../../domain/storage-layout";

/**
 * 宿主模型检测：**写入端与读取端必须同一个路径**。
 *
 * 上一版这条链路从未工作过，原因只有一个：运行时写的是插件作用域的单文件
 * （`workbench/host-model.json`），面板读的是按会话分文件（`workbench/sessions/<id>/host-model.json`）。
 * 两边都写对了格式、都有测试，但路径不同 —— 于是那一栏永远是空的，而代码看起来毫无问题。
 *
 * 所以这里的判据不是「有没有实现」，而是：
 *   1. 两侧都通过 `storageEntry("hostModel", …)` 得到路径；
 *   2. 该键的 scope 是 session；
 *   3. 同一 sessionId 下两侧算出来的字符串相等。
 */
const ROOT = process.cwd();
const read = (path: string): string => readFileSync(resolve(ROOT, path), "utf8");

describe("the host model snapshot", () => {
	it("is written and read through the same storage entry", () => {
		const runtime = read("src/runtime/contributions.ts");
		const bridge = read("src/index.tsx");

		// 写入：运行时在 system prompt provider 里写，位置按会话算。
		expect(runtime).toMatch(/storageEntry\("hostModel", [^)]*sessionId/);
		// 读取：面板侧 bridge 用同一个键。
		expect(bridge).toMatch(/hostModel: sessionId => readJson<HostModelSnapshot>\(ctx\.storage, storageEntry\("hostModel"/);
	});

	it("is session scoped, so two conversations cannot share one model", () => {
		const a = storageEntry("hostModel", "/work", "session-a");
		const b = storageEntry("hostModel", "/work", "session-b");
		expect(a.scope).toBe("session");
		expect(a.path).not.toBe(b.path);
		// 同一会话换工作区仍是同一份：它描述对话，不描述项目。
		expect(storageEntry("hostModel", "/other", "session-a").path).toBe(a.path);
	});

	it("carries the four non-secret fields the card needs", () => {
		const runtime = read("src/runtime/contributions.ts");
		const snapshot = /const snapshot: HostModelSnapshot = \{[\s\S]{0,400}?\};/.exec(runtime)?.[0] ?? "";
		expect(snapshot).toContain("provider");
		expect(snapshot).toContain("id");
		expect(snapshot).toContain("apiStyle");
		expect(snapshot).toContain("at");
		// 没有 baseUrl、没有任何密钥字段：面板永远不该持有这两样。
		expect(snapshot).not.toContain("baseUrl");
		expect(snapshot).not.toContain("apiKey");
	});

	it("gives the card a direct way to use it", () => {
		const card = read("src/features/workbench/components/prompts/probe-refusal-card.tsx");
		expect(card).toContain('t("probe.host.detected")');
		expect(card).toContain('t("probe.host.use")');
		expect(card).toContain('t("probe.host.inUse")');
		// 没探测到时要说清楚原因，而不是留空。
		expect(card).toContain('t("probe.host.missing")');
	});
});
