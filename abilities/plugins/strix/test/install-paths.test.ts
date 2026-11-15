import { describe, expect, it } from "vitest";
import { canReveal, clickAction, installPaths, type InstallPath } from "../src/domain/install-paths";

/**
 * 「装在哪」的条目（见 domain/install-paths.ts）。
 *
 * 这条测试守两件事：
 *  1. 当前系统的 docker 位置排在前面，其它系统只作参考；
 *  2. 点击行为按"能不能真的打开"分流——容器内路径永远不能对宿主打开。
 */

const base = {
	platform: "win32" as NodeJS.Platform,
	docker: true,
	image: "ghcr.io/usestrix/strix-sandbox:1.4.0",
	container: "astravia-strix-abc",
	toolchainDir: "C:\\plugins\\strix\\toolchain",
	dataDir: "C:\\Users\\me\\AppData\\Roaming\\astravia\\strix",
	workspace: "C:\\work\\demo",
};

const find = (entries: InstallPath[], id: string): InstallPath => {
	const hit = entries.find((entry) => entry.id === id);
	if (!hit) throw new Error(`missing ${id}`);
	return hit;
};

describe("host entries come first", () => {
	it("lists this system's docker locations before the other systems", () => {
		const entries = installPaths(base);
		const first = entries[0]!;
		expect(first.os).toBe("win32");
		expect(first.scope).toBe("host");
		// 其它系统只在末尾各一条，且标成 reference。
		const references = entries.filter((entry) => entry.scope === "reference");
		expect(references.map((entry) => entry.os).sort()).toEqual(["darwin", "linux"]);
		expect(entries.slice(0, entries.length - references.length).every((entry) => entry.scope !== "reference")).toBe(true);
	});

	it("skips docker locations entirely when the run is not containerised", () => {
		const entries = installPaths({ ...base, docker: false, container: null });
		expect(entries.filter((entry) => entry.id.startsWith("docker-"))).toEqual([]);
		// 工具链与数据目录仍然是事实，照列。
		expect(find(entries, "host-toolchain").path).toBe(base.toolchainDir);
		expect(find(entries, "host-data").path).toBe(base.dataDir);
	});
});

describe("container entries say how to look, not where to click", () => {
	it("carries a docker exec command for every container path", () => {
		const entries = installPaths(base);
		const container = entries.filter((entry) => entry.scope === "container");
		expect(container.length).toBeGreaterThan(0);
		for (const entry of container) {
			expect(entry.command).toContain(base.container!);
			expect(entry.command).toContain(entry.path);
		}
	});

	it("never claims a container path can be revealed on the host", () => {
		const entries = installPaths(base).filter((entry) => entry.scope === "container");
		for (const entry of entries) {
			expect(canReveal({ ...entry, exists: true })).toBe(false);
			expect(clickAction({ ...entry, exists: true })).toBe("copy-command");
		}
	});
});

describe("click behaviour follows what is actually true", () => {
	it("reveals a host path only when the service confirmed it exists", () => {
		const entry: InstallPath = { id: "x", scope: "host", os: "win32", label: "l", path: "C:\\x" };
		expect(clickAction(entry)).toBe("copy-path");
		expect(clickAction({ ...entry, exists: false })).toBe("copy-path");
		expect(clickAction({ ...entry, exists: true })).toBe("reveal");
	});

	it("copies a reference path: it belongs to another machine", () => {
		const entries = installPaths(base);
		const reference = entries.find((entry) => entry.scope === "reference")!;
		expect(clickAction({ ...reference, exists: undefined })).toBe("copy-path");
	});
});
