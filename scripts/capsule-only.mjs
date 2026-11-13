#!/usr/bin/env node
/**
 * 「插件只在输入框内出胶囊，不进斜杠面板工具行」——一键切换。
 *
 * 为什么必须改宿主：宿主注册输入动作时是白名单拷贝
 * （apps/desktop/src/renderer/domains/plugins/runtime/plugin-ui-context.ts 的 normalized），
 * 插件多传的字段会被丢掉；而工具行与胶囊读的是同一个 visibleActions
 * （domains/conversation/components/useInputActionBarModel.ts:90/166）。
 * 所以「同一枚开关只出现在胶囊里」只能由宿主决定。
 *
 * 用法（本文件可放在任意位置，用 --host 指向宿主仓库）：
 *   node scripts/capsule-only.mjs --check
 *   node scripts/capsule-only.mjs --apply
 *   node scripts/capsule-only.mjs --revert
 *
 * 全部替换都是成对的字面量，已存在即跳过，因此可反复执行。
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const hostArg = args.indexOf("--host");
const host = hostArg >= 0 ? args[hostArg + 1] : "D:/open-source-projects/open-astravia";
const apply = args.includes("--apply");
const revert = args.includes("--revert");
const check = args.includes("--check") || (!apply && !revert);

const SDK = "packages/plugins/plugin-sdk/src/ui.ts";
const REGISTRY = "apps/desktop/src/renderer/domains/plugins/runtime/plugin-ui-context.ts";
const MODEL = "apps/desktop/src/renderer/domains/conversation/components/useInputActionBarModel.ts";
const PANEL_MODEL = "apps/desktop/src/renderer/domains/conversation/hooks/useCommandPanelModel.tsx";
const PANEL_VIEW =
	"apps/desktop/src/renderer/domains/conversation/components/command-panel/CommandPanelView.tsx";

const SDK_FIND = [
	"	/** Whether the action begins in the active state. Defaults to false. */",
	"	defaultActive?: boolean;",
].join("\n");

const SDK_ADD = [
	"	/**",
	"	 * Where this switch is drawn. `both` (default) keeps the current behaviour: a row",
	"	 * entry in the slash panel plus a capsule once active. `capsule` drops the row entry",
	"	 * and leaves only the capsule, for plugins whose row entry duplicates the slash list.",
	"	 */",
	'	placement?: "both" | "capsule";',
].join("\n");

const EDITS = [
	{
		name: "sdk: 契约新增 placement",
		file: SDK,
		find: SDK_FIND,
		replace: `${SDK_FIND}\n${SDK_ADD}`,
	},
	{
		name: "registry: 白名单转发 placement",
		file: REGISTRY,
		find: "			defaultActive: contribution.defaultActive,",
		replace: "			defaultActive: contribution.defaultActive,\n			placement: contribution.placement,",
	},
	{
		name: "model: InputActionBarItem 增加 placement",
		file: MODEL,
		find: "export interface InputActionBarItem {\n	active: boolean;",
		replace: 'export interface InputActionBarItem {\n	active: boolean;\n	placement?: "both" | "capsule";',
	},
	{
		name: "model: items 暴露 placement",
		file: MODEL,
		find: "	items: visibleActions.map((action) => ({",
		replace: '	items: visibleActions.map((action) => ({\n		placement: action.placement ?? "both",',
	},
	{
		name: "types: 行项目携带 placement",
		file: "apps/desktop/src/renderer/domains/conversation/components/command-panel/types.ts",
		find: "	active: boolean;",
		replace: '	active: boolean;\n	/** `capsule` 的动作不进工具行，只作为输入框内的胶囊出现。 */\n	placement?: "both" | "capsule";',
	},
	{
		name: "panel model: 把 placement 带到行项目",
		file: PANEL_MODEL,
		find: "				active: item.active,\n				onToggle: () => actionBar.actions.toggleItem(item.id),",
		replace:
			"				active: item.active,\n				placement: item.placement,\n				onToggle: () => actionBar.actions.toggleItem(item.id),",
	},
	{
		name: "panel view: 工具行跳过 capsule 项",
		file: PANEL_VIEW,
		find: "								{actions.map((action) => (",
		replace: '								{actions.filter((action) => action.placement !== "capsule").map((action) => (',
	},
];

function touched() {
	return [...new Set(EDITS.map((edit) => edit.file))];
}

if (!existsSync(join(host, SDK))) {
	console.error(`不是宿主仓库：${host}`);
	process.exit(2);
}

if (revert) {
	const paths = touched().filter((path) => existsSync(join(host, path)));
	if (paths.length === 0) {
		console.log("没有可还原的文件");
		process.exit(0);
	}
	execFileSync("git", ["checkout", "--", ...paths], { cwd: host, stdio: "inherit" });
	console.log(`已还原：\n  ${paths.join("\n  ")}`);
	process.exit(0);
}

let changed = 0;
let already = 0;
let unmatched = 0;

for (const edit of EDITS) {
	const path = join(host, edit.file);
	if (!existsSync(path)) {
		console.log(`跳过（缺文件）· ${edit.name}`);
		unmatched += 1;
		continue;
	}
	const before = readFileSync(path, "utf8");
	if (before.includes(edit.replace)) {
		console.log(`已完成 · ${edit.name}`);
		already += 1;
		continue;
	}
	if (!before.includes(edit.find)) {
		console.log(`未匹配 · ${edit.name}（${edit.file}）`);
		unmatched += 1;
		continue;
	}
	if (check) {
		console.log(`待应用 · ${edit.name}`);
		changed += 1;
		continue;
	}
	writeFileSync(path, before.replace(edit.find, edit.replace), "utf8");
	console.log(`已应用 · ${edit.name}`);
	changed += 1;
}

if (check) {
	console.log(`\n待应用 ${changed} 处 / 已完成 ${already} 处 / 未匹配 ${unmatched} 处`);
	console.log("落地：--apply　还原：--revert");
	process.exit(changed > 0 ? 1 : 0);
}

console.log(`\n写入 ${host}：${changed} 处改动，${already} 处此前已存在。`);
console.log('下一步：插件侧 registerInputAction 加 placement: "capsule"，各自抬版本。');
