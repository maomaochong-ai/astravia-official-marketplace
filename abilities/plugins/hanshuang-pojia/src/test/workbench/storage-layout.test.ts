import { describe, expect, it } from "vitest";

import { pathsToClear, storageEntries, storageEntry, workspaceKey } from "../../domain/storage-layout";

describe("存储路径：会话自己一份，案例按工作区，偏好跟着插件", () => {
	it("报告、探测记录、宿主模型按会话分文件", () => {
		// ADR 0023：这三样都描述「这次对话」，跨会话看到别人的，就是串会话。
		for (const key of ["library", "probeRecord", "hostModel"] as const) {
			const a = storageEntry(key, "/work/alpha", "session-a");
			const b = storageEntry(key, "/work/alpha", "session-b");
			expect(a.path).not.toBe(b.path);
			expect(a.scope).toBe("session");
			expect(a.path.startsWith("workbench/sessions/")).toBe(true);
			// 同一会话换工作区仍然同一份：它属于对话，不属于项目。
			expect(storageEntry(key, "/work/beta", "session-a").path).toBe(a.path);
		}
	});

	it("我的案例仍按工作区分文件（用户显式沉淀的产物）", () => {
		const a = storageEntry("cases", "/work/alpha", "session-a");
		const b = storageEntry("cases", "/work/beta", "session-a");
		expect(a.path).not.toBe(b.path);
		expect(a.scope).toBe("workspace");
		expect(a.path.startsWith("workbench/workspaces/")).toBe(true);
	});

	it("设置、提示词库、实验环境开关是插件级的，换工作区不变", () => {
		for (const key of ["settings", "prompts", "promptBackups", "labMode"] as const) {
			expect(storageEntry(key, "/work/alpha").path).toBe(storageEntry(key, "/work/beta").path);
			expect(storageEntry(key, "/work/alpha").scope).toBe("plugin");
		}
	});

	it("没有 cwd / 没有会话 id 时落在固定的默认分区，不猜", () => {
		expect(workspaceKey(null)).toBe("default");
		expect(workspaceKey("")).toBe("default");
		expect(storageEntry("cases", null).path).toContain("/default/");
		// 没有会话 id 就进 unsessioned：宁可看到空，也不要把上一段的结果端过来。
		expect(storageEntry("library", null, null).path).toContain("/unsessioned/");
	});
});

describe("工作区键：可读但不撞", () => {
	it("同一路径总是同一个键", () => {
		expect(workspaceKey("/work/alpha")).toBe(workspaceKey("/work/alpha"));
	});

	it("只差分隔符的两个路径不会折叠成同一个目录", () => {
		// 这是纯 slug 方案的经典事故：`a/b` 与 `a_b` 都会变成 `a-b`。
		expect(workspaceKey("a/b")).not.toBe(workspaceKey("a_b"));
	});

	it("Windows 反斜杠与正斜杠指向同一个工作区", () => {
		expect(workspaceKey("C:\\work\\alpha")).not.toBe(workspaceKey("C:/work/other"));
	});

	it("键总是文件名安全的", () => {
		for (const cwd of ["/work/带中文的目录", "C:\\Program Files\\x", "/a b/c:d"]) {
			expect(workspaceKey(cwd)).toMatch(/^[a-z0-9._-]+$/);
		}
	});
});

describe("清理范围", () => {
	it("只清本工作区时不动偏好，也不动会话数据", () => {
		const paths = pathsToClear("/work/alpha", "workspace", "session-a");
		expect(paths.some(path => path.includes("cases"))).toBe(true);
		expect(paths.some(path => path.includes("prompt-library"))).toBe(false);
		expect(paths.some(path => path.includes("settings"))).toBe(false);
		expect(paths.some(path => path.includes("/sessions/"))).toBe(false);
	});

	it("只清本会话时不碰项目里的案例", () => {
		const paths = pathsToClear("/work/alpha", "session", "session-a");
		expect(paths.every(path => path.includes("/sessions/"))).toBe(true);
		expect(paths.some(path => path.includes("library"))).toBe(true);
	});

	it("全清包含每一个已知路径与旧位置", () => {
		const paths = pathsToClear("/work/alpha", "all", "session-a");
		const expected = storageEntries("/work/alpha", "session-a").reduce(
			(total, entry) => total + (entry.legacyPath ? 2 : 1),
			0,
		);
		expect(paths).toHaveLength(expected);
		expect(paths).toContain("workbench/cases.json");
	});
});
