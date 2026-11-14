import { describe, expect, it } from "vitest";

/**
 * 「这三个功能对齐上游了吗」需要一份能执行的答案，而不是一段散文。
 *
 * 上游每个工具的 tools.py 能力清单在这里逐项对照：每一项要么有对应工具、要么有
 * 明确的「不做」理由（ADR 0006 / 0008）。新增或改名时这条会先红。
 */

const UPSTREAM = {
	todo: ["create_todo", "list_todos", "update_todo", "mark_todo_done", "mark_todo_pending", "delete_todo"],
	coverage: ["record_coverage", "update_coverage", "list_coverage"],
	notes: ["create_note", "list_notes", "get_note", "update_note", "delete_note"],
} as const;

/** 每一项 → 本插件里的承载者；没有 tool 就写 reason（有意不做）。 */
const MAPPING: Record<string, { tool?: string; reason?: string }> = {
	create_todo: { tool: "strix_todo_create" },
	list_todos: { tool: "strix_todo_list" },
	update_todo: { tool: "strix_todo_update" },
	mark_todo_done: { tool: "strix_todo_update" },
	mark_todo_pending: { tool: "strix_todo_update" },
	delete_todo: { tool: "strix_todo_remove" },
	record_coverage: { tool: "strix_coverage_record" },
	update_coverage: { tool: "strix_coverage_update" },
	list_coverage: { tool: "strix_coverage_list" },
	create_note: { tool: "strix_note_create" },
	list_notes: { tool: "strix_note_list" },
	get_note: { tool: "strix_note_get" },
	update_note: { tool: "strix_note_update" },
	delete_note: { tool: "strix_note_delete" },
};

import { SERVICE_TOOL_NAMES } from "../agent/strix-tools";

describe("parity with upstream's three ledgers", () => {
	for (const [family, names] of Object.entries(UPSTREAM)) {
		it(`${family}: every upstream capability has a home`, () => {
			for (const name of names) {
				const mapping = MAPPING[name];
				expect(mapping, `${family}.${name} is unmapped — decide or document why`).toBeTruthy();
				if (mapping.tool) {
					expect(SERVICE_TOOL_NAMES, `${name} → ${mapping.tool} is not in the catalogue`).toContain(mapping.tool);
				} else {
					expect(mapping.reason, `${name} has neither a tool nor a reason`).toBeTruthy();
				}
			}
		});
	}

	it("exposes the removals and corrections the panel needs, not just create/list", () => {
		// 这三条是 0.7.2 补的口：删计划、改覆盖、读笔记正文。少一条就有一个死面板。
		expect(SERVICE_TOOL_NAMES).toContain("strix_todo_remove");
		expect(SERVICE_TOOL_NAMES).toContain("strix_coverage_update");
		expect(SERVICE_TOOL_NAMES).toContain("strix_note_get");
	});
});
