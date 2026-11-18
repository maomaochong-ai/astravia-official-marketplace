/**
 * 「插件在对话框的添加列表里找不到」的回归（15 个 craft 共用一个外壳，抽查 designcraft 与另一个）。
 *
 * 现场证据（宿主 renderer 日志 2026-11-18，`craft-anything@0.0.28`）：
 *
 *   contribution skipped … "permission":"agent.tools.register","contribution":"agent tool"
 *   activation failed … "message":"Plugin permission denied: ui.slot.tool-call"
 *   snapshot candidate rejected …
 *
 * 授权表（`~/.astravia/plugins-manifest.json`）里 craft-anything / gridcraft 的
 * `grantedPermissions` 是空数组，其余 craft 是 14 项。宿主的 `registerToolCallSlot` 走
 * `permissions.require()`，未授权直接抛；抛点在 `activate()` 中间，于是同一次激活里
 * **后注册的标签页也没了** —— 用户在「添加」里看不到这个插件。
 *
 * 约束：
 *  1. 每个会 require 的面必须先 `has()` 再登记；
 *  2. 每个可选面单独兜住，缺一个不连坐其它；
 *  3. 缺权限要说出来（一行，含补齐入口），而不是只留宿主的英文 skipped。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../abilities/plugins/", import.meta.url));

/** 会抛 `Plugin permission denied` 的登记面。 */
const GATED = ["ui.slot.input-action", "ui.slot.tool-call", "agent.tools.register"];

/** 抽查两个：一个是参照实现，一个是事故现场。 */
const SAMPLES = ["designcraft", "craft-anything"];

const indexOf = (app) => readFileSync(join(ROOT, app, "src", "index.tsx"), "utf8");

test("activation survives a plugin with no granted permissions", () => {
	for (const app of SAMPLES) {
		const index = indexOf(app);

		// 三个 gated 面都在「先问」的清单里：新增一个面却忘了登记，这里先红。
		assert.ok(index.includes("GATED_SURFACES"), `${app}: 缺少 gated 面清单`);
		for (const permission of GATED) {
			assert.ok(index.includes(permission), `${app}: 未提到 ${permission}`);
		}

		// 事故点：tool-call slot 曾经是裸调用。
		assert.match(
			index,
			/ctx\.permissions\.has\("ui\.slot\.tool-call"\)\s*\?/,
			`${app}: registerToolCallSlot 没有先问权限`,
		);

		// 可选面各自兜住，一个失败不连坐标签页。
		assert.ok(index.includes('optional("tools"'), `${app}: 工具注册未兜住`);
		assert.ok(index.includes('optional("act-timeline"'), `${app}: 时间线注册未兜住`);

		// 缺权限必须说出来，并指出补齐入口。
		assert.ok(index.includes("function ungranted"), `${app}: 没有缺权限诊断`);
		assert.match(index, /未授权 \$\{missing\.length\} 项/, `${app}: 诊断未列出缺的项`);
		assert.ok(index.includes("详情页重新授权"), `${app}: 诊断未指出补齐入口`);
	}
});

test("the whole family shares the same resilient shell", () => {
	const APPS = [
		"designcraft", "effectcraft", "filmcraft", "lightcraft", "pdfcraft", "vectorcraft", "photocraft",
		"cadcraft", "deckcraft", "figcraft", "gridcraft", "wordcraft", "texturecraft", "materialcraft",
		"craft-anything",
	];
	const reference = indexOf("designcraft");
	for (const app of APPS) {
		assert.equal(indexOf(app), reference, `${app}: 与 designcraft 不一致（craft-parity 会先报，这里给出定位）`);
	}
});
