import { describe, expect, it } from "vitest";

import { registerWorkspaceTools } from "../src/tools/workspace-tools.js";

interface Registered {
	id: string;
	handler(context: unknown): Promise<unknown>;
}

interface Harness {
	files: Record<string, string>;
	written: Record<string, string>;
	saved: { n: number; content: string; title?: string }[];
	call(input: Record<string, unknown>, cwd?: string): Promise<unknown>;
}

function harness(options: {
	files: Record<string, string>;
	chapters?: Record<number, string>;
	book?: { id: string; chapters: { n: number; title: string }[] } | null;
	saveError?: string;
}): Harness {
	const written: Record<string, string> = {};
	const saved: Harness["saved"] = [];
	const registrations: Registered[] = [];

	const fs = {
		async readDir(path: string) {
			const prefix = `${path}/`;
			return Object.keys(options.files)
				.filter((file) => file.startsWith(prefix) && !file.slice(prefix.length).includes("/"))
				.map((file) => ({ name: file.slice(prefix.length), path: file, isDirectory: false }));
		},
		async readFile(path: string) {
			return { content: options.files[path] ?? "" };
		},
		async writeFile(path: string, content: string) {
			written[path] = content;
		},
		async stat() {
			return null;
		},
		async createDirectory() {
			return undefined;
		},
	};

	const ctx = {
		fs,
		agent: { registerTool: (registration: Registered) => registrations.push(registration) },
	};

	const service = {
		async readChapter(n: number) {
			const text = options.chapters?.[n];
			return text === undefined ? { ok: false as const, error: "chapter-not-found" } : { ok: true as const, data: { n, text } };
		},
		async saveChapter(input: { n: number; content: string; title?: string }) {
			if (options.saveError) return { ok: false as const, error: options.saveError };
			saved.push(input);
			return { ok: true as const, data: { chapters: [{ n: input.n, words: input.content.length }] } };
		},
		async resolveBook() {
			return options.book ?? null;
		},
	};

	registerWorkspaceTools(ctx as never, service as never);
	const registered = registrations.find((item) => item.id === "mahua_sync_workspace");
	if (!registered) throw new Error("mahua_sync_workspace was not registered");

	return {
		files: options.files,
		written,
		saved,
		call: (input, cwd = "/work") =>
			registered.handler({ trigger: { input }, session: { cwd } }) as Promise<unknown>,
	};
}

describe("mahua_sync_workspace", () => {
	it("imports only the three accepted file names and reports the rest", async () => {
		const run = harness({
			files: {
				"/work/1.md": "# 第一章 起风\n\n正文 A",
				"/work/第2章.md": "# 第二章 落雨\n\n正文 B",
				"/work/chapter-03.md": "# 第三章 转晴\n\n正文 C",
				"/work/notes.md": "随手记",
			},
		});

		const result = (await run.call({ direction: "import" })) as {
			ok: boolean;
			imported: { n: number }[];
			unmatched: string[];
		};

		expect(result.ok).toBe(true);
		expect(result.imported.map((item) => item.n)).toEqual([1, 2, 3]);
		expect(result.unmatched).toEqual(["notes.md"]);
		// 标题取自首行 Markdown 标题，而不是文件名。
		expect(run.saved.find((item) => item.n === 2)?.title).toBe("第二章 落雨");
	});

	it("skips a chapter whose text already matches the stored one", async () => {
		const run = harness({
			files: { "/work/1.md": "同样的正文" },
			chapters: { 1: "同样的正文" },
		});

		const result = (await run.call({ direction: "import" })) as { unchanged: number[]; imported: unknown[] };

		expect(result.unchanged).toEqual([1]);
		expect(result.imported).toEqual([]);
		expect(run.saved).toEqual([]);
	});

	it("reports a rejected save per file instead of failing the whole import", async () => {
		const run = harness({
			files: { "/work/1.md": "一章", "/work/2.md": "二章" },
			saveError: "outline-required",
		});

		const result = (await run.call({ direction: "import" })) as {
			ok: boolean;
			failed: { file: string; error: string }[];
		};

		expect(result.ok).toBe(false);
		expect(result.failed.map((item) => item.file)).toEqual(["1.md", "2.md"]);
		expect(result.failed[0]?.error).toBe("outline-required");
	});

	it("exports every drafted chapter under chapters/<n>.md", async () => {
		const run = harness({
			files: {},
			book: { id: "b1", chapters: [{ n: 2, title: "" }, { n: 1, title: "起风" }] },
			chapters: { 1: "正文 A", 2: "正文 B" },
		});

		const result = (await run.call({ direction: "export" })) as { ok: boolean; written: number[] };

		expect(result.ok).toBe(true);
		expect(result.written).toEqual([1, 2]);
		expect(run.written["/work/chapters/1.md"]).toBe("# 起风\n\n正文 A");
		// 没有标题的章节不凭空造一行 `# `。
		expect(run.written["/work/chapters/2.md"]).toBe("正文 B");
	});

	it("falls back to the session cwd and rejects an empty root", async () => {
		const run = harness({ files: { "/work/1.md": "一章" }, chapters: { 1: "旧" } });

		await run.call({ direction: "import" }, "/work");
		expect(run.saved.map((item) => item.n)).toEqual([1]);

		await expect(run.call({ direction: "import" }, "")).resolves.toMatchObject({ ok: false, error: "no-directory" });
	});
});
