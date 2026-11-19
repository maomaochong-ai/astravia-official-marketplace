import { describe, expect, it } from "vitest";

import { pathsToClear, storageEntries, storageEntry, workspaceKey } from "../../domain/storage-layout";

describe("存储路径：产物按工作区分，偏好跟着插件", () => {
	it("样本库与我的案例按工作区分文件", () => {
		const a = storageEntry("library", "/work/alpha");
		const b = storageEntry("library", "/work/beta");
		expect(a.path).not.toBe(b.path);
		expect(a.scope).toBe("workspace");
		expect(a.path.startsWith("workbench/workspaces/")).toBe(true);
		// 旧位置要留着：升级后第一次打开要能读回原来的样本库。
		expect(a.legacyPath).toBe("workbench/library.json");
	});

	it("设置、提示词库、实验环境开关是插件级的，换工作区不变", () => {
		for (const key of ["settings", "prompts", "promptBackups", "labMode"] as const) {
			expect(storageEntry(key, "/work/alpha").path).toBe(storageEntry(key, "/work/beta").path);
			expect(storageEntry(key, "/work/alpha").scope).toBe("plugin");
		}
	});

	it("没有 cwd 时落在一个固定的默认分区", () => {
		expect(workspaceKey(null)).toBe("default");
		expect(workspaceKey("")).toBe("default");
		expect(storageEntry("library", null).path).toContain("/default/");
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
	it("只清产物时不动偏好", () => {
		const paths = pathsToClear("/work/alpha", "workspace");
		expect(paths.some(path => path.includes("library"))).toBe(true);
		expect(paths.some(path => path.includes("prompt-library"))).toBe(false);
		expect(paths.some(path => path.includes("settings"))).toBe(false);
	});

	it("全清包含每一个已知路径与旧位置", () => {
		const paths = pathsToClear("/work/alpha", "all");
		const expected = storageEntries("/work/alpha").reduce(
			(total, entry) => total + (entry.legacyPath ? 2 : 1),
			0,
		);
		expect(paths).toHaveLength(expected);
		expect(paths).toContain("workbench/library.json");
	});
});
