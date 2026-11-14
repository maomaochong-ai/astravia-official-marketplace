import { describe, expect, it } from "vitest";

/**
 * 「计划 / 覆盖 / 笔记」这三个面板到底是不是死功能。
 *
 * 判定不能看"面板有没有渲染"，要看三件事同时成立：
 *  1. 有工具能写（否则永远空）；
 *  2. 写得进去、读得回来（存储与状态真的更新）；
 *  3. 面板能读到正文（否则写了也看不见）。
 *
 * 这里用真实文件系统跑 1、2（服务层 store），3 由面板组件的 DOM 测试覆盖。
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CoverageStore } from "../service/coverage";
import { NoteStore } from "../service/notes";
import { TodoStore } from "../service/todo";

const store = () => {
	const dir = mkdtempSync(join(tmpdir(), "strix-ledger-"));
	return { todo: new TodoStore(dir), coverage: new CoverageStore(dir), notes: new NoteStore(dir) };
};

describe("plan ledger", () => {
	it("writes, reorders by status, and can delete what no longer applies", async () => {
		const { todo } = store();
		const created = await todo.create("s1", {
			todos: [
				{ title: "enumerate /api", priority: "high" },
				{ title: "try /admin", priority: "critical" },
			],
		});
		expect(created.todos.map((item) => item.priority)).toEqual(["critical", "high"]);

		const [first] = created.todos;
		// 上游 mark_todo_done 的等价动作：update 到 done 后应沉到已完成的末尾。
		const done = await todo.update("s1", { ids: [first!.id], status: "done" });
		expect(done.todos.at(-1)?.status).toBe("done");

		// 计划会变：一条不再适用的项必须能删，而不是被标成 done 假装做过。
		const removed = await todo.remove("s1", { ids: [first!.id] });
		expect(removed.removed).toEqual([first!.id]);
		expect(removed.count).toBe(1);
	});

	it("refuses ids that match nothing instead of silently succeeding", async () => {
		const { todo } = store();
		await expect(todo.remove("s1", { ids: ["nope"] })).rejects.toThrow(/no todo matched/);
	});
});

describe("coverage ledger", () => {
	it("records an outcome and lets a wrong one be corrected in place", async () => {
		const { coverage } = store();
		const recorded = await coverage.record("s1", {
			surface: "GET /api/orders",
			outcome: "clean",
			technique: "id swap",
		});
		expect(recorded.byOutcome.clean).toBe(1);

		// 先判 clean，后来确认了越权：必须改这一条，否则报告里同时有"没问题"和"有问题"。
		const updated = await coverage.update("s1", { id: recorded.entry.id, outcome: "vulnerable", note: "IDOR confirmed" });
		expect(updated.entry.outcome).toBe("vulnerable");
		expect(updated.entry.note).toBe("IDOR confirmed");
		expect(updated.entry.updated_at).toBeTruthy();
		expect(updated.byOutcome).toEqual({ vulnerable: 1, clean: 0, skipped: 0 });

		const listed = await coverage.list("s1");
		expect(listed.count).toBe(1);
	});

	it("refuses to update an entry that does not exist", async () => {
		const { coverage } = store();
		await expect(coverage.update("s1", { id: "ghost", outcome: "clean" })).rejects.toThrow(/no coverage entry/);
	});
});

describe("notes ledger", () => {
	it("keeps a body that the panel can fetch by id", async () => {
		const { notes } = store();
		const created = await notes.create("s1", {
			title: "IDOR payload",
			category: "findings",
			content: "GET /api/orders/1002 with a session token",
		});
		const listed = await notes.list("s1", {});
		expect(listed.notes[0]?.title).toBe("IDOR payload");

		const fetched = await notes.get("s1", { id: created.note.id });
		expect(fetched.note.content).toContain("/api/orders/1002");
	});

	it("filters by category, which is what the panel's hint promises", async () => {
		const { notes } = store();
		await notes.create("s1", { title: "a", category: "plan", content: "x" });
		await notes.create("s1", { title: "b", category: "findings", content: "y" });
		const plan = await notes.list("s1", { category: "plan" });
		expect(plan.notes.map((note) => note.title)).toEqual(["a"]);
	});
});
