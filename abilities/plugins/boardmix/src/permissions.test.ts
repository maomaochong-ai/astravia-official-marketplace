import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 宿主对一批 API 是**准入式**的：没在 `permissions` 里声明，调用时直接 throw。
 * 这类 throw 发生在 effect 或事件里时会被活动面板的错误边界接住，用户看到的是
 * 整块面板「渲染失败」——0.0.6 的 `setPromptAttachment` 就是这样把标签页打死的。
 *
 * 所以这里把「调用了哪个 API」和「该 API 要哪个权限」钉成表：新写一个 ctx.* 调用
 * 而忘了声明权限，测试直接红，而不是等用户装上去看白屏。
 */

/** API 全名 → 它需要的权限；`null` 表示宿主不设门槛。 */
const GATES: Record<string, string | null> = {
	"ui.registerActivityTab": "ui.slot.activity-tab",
	"ui.openActivityTab": "ui.slot.activity-tab",
	"ui.setActivityTabVisible": "ui.slot.activity-tab",
	"ui.setActivityPanelWidth": "ui.slot.activity-tab",
	"ui.registerToolCallSlot": "ui.slot.tool-call",
	"ui.registerInputAction": "ui.slot.input-action",
	"ui.setPromptAttachment": "ui.slot.input-action",
	"ui.openExternal": "shell.openExternal",
	"ui.notify": null,
	"agent.registerTool": "agent.tools.register",
	"agent.registerHook": "agent.hooks.register",
	"fs.readFile": "fs.read",
	"fs.readDir": "fs.read",
	"fs.stat": "fs.read",
	"fs.writeFile": "fs.write",
	"fs.createDirectory": "fs.write",
	"fs.delete": "fs.write",
	"fs.rename": "fs.write",
	"storage.get": "storage.read",
	"storage.set": "storage.write",
};

const SRC = join(import.meta.dirname, "..", "src");
const CALL = /\bctx\.(ui|agent|fs|storage)\.([A-Za-z0-9_]+)\s*[.(]/g;

function sources(directory: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory)) {
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) {
			found.push(...sources(path));
			continue;
		}
		if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
		found.push(path);
	}
	return found;
}

function declared(): string[] {
	const manifest = JSON.parse(readFileSync(join(import.meta.dirname, "..", "plugin.json"), "utf8")) as {
		permissions?: string[];
	};
	return manifest.permissions ?? [];
}

function used(): Map<string, string[]> {
	const hits = new Map<string, string[]>();
	for (const file of sources(SRC)) {
		const code = readFileSync(file, "utf8");
		for (const match of code.matchAll(CALL)) {
			const api = `${match[1]}.${match[2]}`;
			const files = hits.get(api) ?? [];
			files.push(file.slice(SRC.length + 1));
			hits.set(api, files);
		}
	}
	return hits;
}

describe("plugin permissions match the host APIs the code calls", () => {
	it("knows how to gate every ctx.* call", () => {
		const unknown = [...used().keys()].filter(api => !(api in GATES));
		expect(unknown, "add the API to GATES with the permission the host requires").toEqual([]);
	});

	it("declares the permission for every gated call", () => {
		const permissions = declared();
		const missing = [...used().entries()]
			.map(([api, files]) => ({ api, permission: GATES[api], files }))
			.filter((entry): entry is { api: string; permission: string; files: string[] } => Boolean(entry.permission))
			.filter(entry => !permissions.includes(entry.permission))
			.map(entry => `${entry.api} needs ${entry.permission} (${entry.files.join(", ")})`);
		expect(missing).toEqual([]);
	});

	it("keeps the input action behind its permission", () => {
		const action = readFileSync(join(SRC, "hooks/input-action.ts"), "utf8");
		// 光声明权限还不够：老宿主不认识这个权限名，has() 为假时也不能抛。
		expect(action).toContain('ctx.permissions.has("ui.slot.input-action")');
	});
});
