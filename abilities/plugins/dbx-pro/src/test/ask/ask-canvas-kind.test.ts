/**
 * ask-canvas-kind.test.ts — 保护「问数图型 → 画布节点」这一段跨模块契约。
 *
 * 为什么要单独一个文件：ask-chart.ts 只能保证「返回自己或 null」，
 * 它无法知道画布到底有哪些节点。真正的事实源是 node-graph.tsx 的 NODE_TEMPLATES，
 * 而这张表会随画布功能扩展而变。这里直接把两边对起来跑，任何一侧改动导致
 * 「问数落了画布上不存在的节点 kind」都会在这里断下来 ——
 * 那种失败在界面上只表现为一个画错的图（渲染器会落到默认分支），很难被发现。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ASK_CHART_KINDS, toCanvasKind } from "../../features/ask/ask-chart.ts";
import { NODE_TEMPLATES } from "../../features/bi-editor/canvas/components/node-graph.tsx";

describe("ask · 问数图型落画布", () => {
	it("toCanvasKind 给出的每个 kind 都是画布真实存在的节点模板", () => {
		for (const kind of ASK_CHART_KINDS) {
			const canvasKind = toCanvasKind(kind);
			if (canvasKind === null) continue;
			assert.ok(
				Object.prototype.hasOwnProperty.call(NODE_TEMPLATES, canvasKind),
				`画布没有节点模板：${kind} → ${canvasKind}`,
			);
		}
	});

	it("落画布的数据源节点 kind 也是画布真实存在的节点模板", () => {
		assert.ok(Object.prototype.hasOwnProperty.call(NODE_TEMPLATES, "source-sql"));
	});

	it("画布确实没有明细表节点（所以 toCanvasKind 必须返回 null）", () => {
		assert.equal(Object.prototype.hasOwnProperty.call(NODE_TEMPLATES, "chart-table"), false);
		assert.equal(toCanvasKind("chart-table"), null);
	});
});
