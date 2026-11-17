import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Budget } from "../src/service/budget";
import { ScopeStore, safeKey } from "../src/service/scope";
import { ShellSessions } from "../src/service/shell-sessions";

/**
 * 「多个目标混在一起」的根因不在前端：服务进程只有一个，而范围、预算、shell 会话
 * 原来是三份**全局**状态。A 会话声明 a.test、B 会话声明 b.test，两边写同一个
 * scope.json，于是两个面板都画出 a.test + b.test。
 *
 * 台账（findings / notes / todos / coverage）1.0.7 就按会话分了；这三处现在跟上。
 */

let dir = "";

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "strix-isolation-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("范围按会话分开", () => {
	it("A 声明的目标不会出现在 B 里", async () => {
		const scope = new ScopeStore(dir);
		await scope.add("conv-A", { targets: ["a.test"], kind: "domain" });
		await scope.add("conv-B", { targets: ["b.test"], kind: "domain" });

		const a = await scope.snapshot("conv-A");
		const b = await scope.snapshot("conv-B");
		expect(a.entries.map((entry) => entry.value)).toEqual(["a.test"]);
		expect(b.entries.map((entry) => entry.value)).toEqual(["b.test"]);
	});

	it("边界与端口同样按会话分开", async () => {
		const scope = new ScopeStore(dir);
		await scope.setRules("conv-A", { ports: ["443"], notes: ["只做被动"] });
		await scope.setRules("conv-B", { ports: ["22"] });

		expect((await scope.snapshot("conv-A")).rules).toMatchObject({ ports: ["443"], notes: ["只做被动"] });
		expect((await scope.snapshot("conv-B")).rules).toMatchObject({ ports: ["22"], notes: [] });
	});

	it("在 B 里删掉 A 的目标不会有任何效果", async () => {
		const scope = new ScopeStore(dir);
		await scope.add("conv-A", { targets: ["a.test"] });
		await scope.remove("conv-B", { target: "a.test" });
		expect((await scope.snapshot("conv-A")).entries).toHaveLength(1);
	});

	it("两个会话写在各自文件里，文件数随会话增长", async () => {
		const scope = new ScopeStore(dir);
		await scope.add("conv-A", { targets: ["a.test"] });
		await scope.add("conv-B", { targets: ["b.test"] });
		const files = readdirSync(join(dir, "scope")).filter((name) => name.endsWith(".json"));
		expect(files).toHaveLength(2);
		expect(files).toContain(`${safeKey("conv-A")}.json`);
	});

	it("会话 id 不安全时也能落成文件名，且不同 id 不撞", () => {
		expect(safeKey("a/b:c")).not.toBe(safeKey("a_b_c"));
		expect(safeKey("a/b:c")).toMatch(/^[A-Za-z0-9._-]+$/);
		expect(safeKey("")).toBe(safeKey("default"));
	});

	it("升级时把旧的单一 scope.json 搬给第一个来问的会话，只搬一次", async () => {
		const legacy = {
			entries: [{ id: "x1", kind: "domain", value: "old.test", createdAt: "2026-11-01T00:00:00.000Z" }],
			rules: { ports: ["8443"], notes: [], updatedAt: null },
		};
		writeFileSync(join(dir, "scope.json"), JSON.stringify(legacy), "utf8");

		const scope = new ScopeStore(dir);
		expect((await scope.snapshot("conv-A")).entries.map((entry) => entry.value)).toEqual(["old.test"]);
		// 第二个会话不该再继承：旧文件已搬走。
		expect((await scope.snapshot("conv-B")).entries).toEqual([]);
		// 原件留档可查，原名已清空。
		expect(JSON.parse(readFileSync(join(dir, "scope.legacy.json"), "utf8")).entries).toHaveLength(1);
		expect(readFileSync(join(dir, "scope.json"), "utf8").trim()).toBe("");
	});
});

describe("预算按会话记账", () => {
	it("A 的花费不算到 B 头上", () => {
		const budget = new Budget({ maxToolCalls: 2 });
		budget.spendToolCall("conv-A");
		budget.spendToolCall("conv-A");
		expect(budget.snapshot("conv-A").exhausted).toContain("toolCalls");
		// B 什么都没做：不该被 A 拖到上限。
		expect(budget.snapshot("conv-B").used.toolCalls).toBe(0);
		expect(budget.snapshot("conv-B").exhausted).toEqual([]);
	});

	it("新沙箱只把那个会话归零", () => {
		const budget = new Budget();
		budget.spendToolCall("conv-A");
		budget.spendToolCall("conv-B");
		budget.reset("conv-A");
		expect(budget.snapshot("conv-A").used.toolCalls).toBe(0);
		expect(budget.snapshot("conv-B").used.toolCalls).toBe(1);
	});

	it("上限是偏好，改一次对所有会话生效，用量不被抹掉", () => {
		const budget = new Budget();
		budget.spendToolCall("conv-A");
		budget.setLimits({ maxToolCalls: 1 });
		expect(budget.snapshot("conv-A").exhausted).toContain("toolCalls");
		expect(budget.snapshot("conv-A").used.toolCalls).toBe(1);
	});
});

describe("shell 会话带归属", () => {
	const start = (sessions: ShellSessions, conversation: string, id: string) =>
		sessions.start({
			id,
			conversation,
			command: "sleep",
			commandDisplay: `sleep 5 # ${id}`,
			argv: [process.execPath, "-e", "setTimeout(() => {}, 5000);"],
			tty: false,
		});

	it("列表只返回本会话起的", async () => {
		const sessions = new ShellSessions(() => undefined);
		try {
			start(sessions, "conv-A", "a1");
			start(sessions, "conv-B", "b1");
			expect(sessions.list("conv-A").map((row) => row.id)).toEqual(["a1"]);
			expect(sessions.list("conv-B").map((row) => row.id)).toEqual(["b1"]);
			// 不带会话 = 不过滤（服务收尾用）。
			expect(sessions.list().map((row) => row.id).sort()).toEqual(["a1", "b1"]);
		} finally {
			await sessions.dispose();
		}
	});

	it("归属可查：B 不能冒充 A", async () => {
		const sessions = new ShellSessions(() => undefined);
		try {
			start(sessions, "conv-A", "a1");
			expect(sessions.ownedBy("a1", "conv-A")).toBe(true);
			expect(sessions.ownedBy("a1", "conv-B")).toBe(false);
			expect(sessions.ownedBy("nope", "conv-A")).toBe(false);
		} finally {
			await sessions.dispose();
		}
	});

	it("已结束的会话仍保留归属", async () => {
		const sessions = new ShellSessions(() => undefined);
		try {
			const view = sessions.start({
				id: "quick",
				conversation: "conv-A",
				command: "exit",
				commandDisplay: "exit 0",
				argv: [process.execPath, "-e", "process.exit(0)"],
				tty: false,
			});
			await new Promise((resolve) => setTimeout(resolve, 250));
			expect(sessions.find(view.id)?.running).toBe(false);
			expect(sessions.ownedBy("quick", "conv-A")).toBe(true);
			expect(sessions.list("conv-A").map((row) => row.id)).toContain("quick");
		} finally {
			await sessions.dispose();
		}
	});
});
