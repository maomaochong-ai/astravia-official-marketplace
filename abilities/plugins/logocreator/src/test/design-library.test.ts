// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PluginFsApi } from "@astravia-org/plugin-sdk";
import {
	clearDesignDocumentCache,
	invalidateDesignDocuments,
	listDesignDocuments,
} from "../domain/design-library";

/**
 * 设计稿清单：面板要能列出工作区里已有的 `.astravia-log` 并切换。
 *
 * 三条约束来自真实后果：
 *  - 同目录里新旧两个文件名并存时只能出一条（否则切换器出现两个「acme」）；
 *  - 顺序按文件时间倒序（刚生成的那份应当排第一）；
 *  - `listFilesRecursive` 的 `names` 在旧宿主上会被忽略，因此必须自己再筛一遍 ——
 *    否则任何叫 `design.json` 的文件都会变成一条「设计稿」。
 */
function fsWith(paths: { path: string; modifiedAt: number }[]): PluginFsApi {
	return {
		listFilesRecursive: async () => paths,
	} as unknown as PluginFsApi;
}

describe("design documents on disk", () => {
	it("keeps one entry per brand folder, preferring the current file name", async () => {
		clearDesignDocumentCache();
		const docs = await listDesignDocuments(
			fsWith([
				{ path: "acme.logocreator-design/design.astravia-log", modifiedAt: 200 },
				{ path: "acme.logocreator-design/design.json", modifiedAt: 100 },
			]),
			"/work",
		);
		expect(docs).toHaveLength(1);
		expect(docs[0]?.path).toBe("acme.logocreator-design/design.astravia-log");
		expect(docs[0]?.slug).toBe("acme");
		expect(docs[0]?.folder).toBe("acme.logocreator-design");
	});

	it("lists newest first and ignores manifests outside a design folder", async () => {
		clearDesignDocumentCache();
		const docs = await listDesignDocuments(
			fsWith([
				{ path: "old.logocreator-design/design.astravia-log", modifiedAt: 10 },
				{ path: "new.logocreator-design/design.astravia-log", modifiedAt: 90 },
				// 旧宿主忽略 `names` 时会把这些也返回：它们不是设计稿。
				{ path: "src/design.json", modifiedAt: 999 },
				{ path: "node_modules/pkg/design.json", modifiedAt: 999 },
			]),
			"/work",
		);
		expect(docs.map(doc => doc.slug)).toEqual(["new", "old"]);
	});

	it("caches briefly so re-renders do not re-walk the tree, and invalidates on demand", async () => {
		clearDesignDocumentCache();
		let calls = 0;
		const fs = {
			listFilesRecursive: async () => {
				calls += 1;
				return [{ path: "a.logocreator-design/design.astravia-log", modifiedAt: 5 }];
			},
		} as unknown as PluginFsApi;

		await listDesignDocuments(fs, "/work");
		await listDesignDocuments(fs, "/work");
		expect(calls).toBe(1);

		await listDesignDocuments(fs, "/work", true);
		expect(calls).toBe(2);

		invalidateDesignDocuments("/work");
		await listDesignDocuments(fs, "/work");
		expect(calls).toBe(3);
	});

	it("returns an empty list instead of throwing when the host refuses to read", async () => {
		clearDesignDocumentCache();
		const fs = {
			listFilesRecursive: async () => {
				throw new Error("permission denied: fs.read");
			},
		} as unknown as PluginFsApi;
		await expect(listDesignDocuments(fs, "/work")).resolves.toEqual([]);
		// 没有工作区时也不扫。
		await expect(listDesignDocuments(fs, null)).resolves.toEqual([]);
	});
});
