// 面板任务流：任务生命周期事件、工具结果广播、退订与积压清理。
// 没人订阅时不得无限攒事件——积压清理就是这条不变量。

import { describe, expect, it } from "vitest";
import { clearPanelBacklog, publishTaskEvent, publishToolResult, subscribePanel } from "../../runtime/panel-channel";

describe("task lifecycle events to the panel", () => {
	it("round-trips a task event through publish/subscribe with a stable phase", () => {
		clearPanelBacklog();
		const seen: string[] = [];
		const stop = subscribePanel(event => seen.push(event.type));
		publishTaskEvent({ phase: "tool-start", sessionId: "s1", toolName: "scan_binary_strings", streaming: true });
		stop();
		expect(seen).toEqual(["task"]);
	});

	it("carries tool name and error flag on the tool-end phase", () => {
		clearPanelBacklog();
		const seen: Array<{ toolName?: string; isError?: boolean }> = [];
		const stop = subscribePanel(event => {
			if (event.type === "task") seen.push({ toolName: event.toolName, isError: event.isError });
		});
		publishTaskEvent({ phase: "tool-end", sessionId: "s1", toolName: "verify_signature", isError: true, streaming: false });
		stop();
		expect(seen).toEqual([{ toolName: "verify_signature", isError: true }]);
	});

	it("keeps tool-result events distinguishable from task events on the same channel", () => {
		clearPanelBacklog();
		const seen: string[] = [];
		const stop = subscribePanel(event => seen.push(event.type));
		publishToolResult({ toolId: "scan_binary_strings", kind: "strings", summary: "3 strings", payload: { hits: [] } });
		publishTaskEvent({ phase: "turn-start", sessionId: null, streaming: true });
		stop();
		expect(seen).toEqual(["tool-result", "task"]);
	});

	it("replays backlogged task events on subscribe for a panel that was closed", () => {
		clearPanelBacklog();
		publishTaskEvent({ phase: "conversation", sessionId: "s1", streaming: false });
		const seen: string[] = [];
		const stop = subscribePanel(event => seen.push(`${event.type}:${event.type === "task" ? event.phase : "?"}`));
		stop();
		expect(seen).toEqual(["task:conversation"]);
	});
});