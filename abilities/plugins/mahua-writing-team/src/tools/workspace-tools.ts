/**
 * 工作区同步：普通对话里模型直接把章节写进工作区文件时，把两边对齐。
 *
 * 工作台只在插件存储里翻页，看不见工作区里落盘的 `.md`；反过来，插件写完的章节
 * 也不会出现在工作区。这里给一个**显式**的双向工具，而不是在后台偷偷扫描：
 * 哪个目录、哪些章、要不要覆盖，都由调用方当场决定。
 *
 * 章号只认三种文件名：`12.md`、`第12章.md`、`chapter-12.md`（大小写不限）。
 * 认不出来的文件不猜顺序——猜错会把正文写到别的章上，所以原样报回去让调用方改名。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";

import type { StudioService } from "../application/studio-service.js";
import { bookIdProperty } from "../application/tool-schemas.js";
import { SCENARIOS } from "../scenarios.js";

type Direction = "import" | "export";

interface SyncInput {
	direction: Direction;
	bookId?: string;
	/** 省略时用会话自己的工作目录。 */
	directory?: string;
}

const CHAPTER_FILE = [/^(\d{1,4})\.md$/i, /^第\s*(\d{1,4})\s*章\.md$/i, /^(?:chapter|ch)[-_ ]?(\d{1,4})\.md$/i];

/** 文件名 → 章号；认不出来返回 null。 */
function chapterNumberOf(fileName: string): number | null {
	for (const pattern of CHAPTER_FILE) {
		const match = fileName.match(pattern);
		if (!match) continue;
		const n = Number.parseInt(match[1] ?? "", 10);
		return Number.isFinite(n) && n > 0 ? n : null;
	}
	return null;
}

/** 首行的 Markdown 标题就是章节标题；没有就用文件名。 */
function titleOf(content: string, fileName: string): string {
	const firstLine = content.split("\n", 1)[0]?.trim() ?? "";
	const heading = firstLine.match(/^#{1,3}\s+(.+)$/);
	if (heading?.[1]) return heading[1].trim();
	return fileName.replace(/\.md$/i, "");
}

export function registerWorkspaceTools(ctx: PluginContext, service: StudioService): void {
	ctx.agent.registerTool<SyncInput>({
		id: "mahua_sync_workspace",
		label: "Mahua Novels: sync workspace files",
		description:
			"Reconcile the studio with plain `.md` chapter files in the session workspace. `import` reads `<n>.md` / `第<n>章.md` / `chapter-<n>.md` into the book and skips chapters whose text is unchanged; `export` writes every drafted chapter back to `<directory>/chapters/<n>.md`. Use it when a novel was written in a plain conversation instead of the studio team. Requires an activated credential.",
		parameters: {
			type: "object",
			properties: {
				direction: { type: "string", enum: ["import", "export"], description: "Which way to copy." },
				bookId: bookIdProperty(),
				directory: {
					type: "string",
					description: "Absolute directory to read or write. Defaults to the session working directory.",
				},
			},
			required: ["direction"],
			additionalProperties: false,
		},
		scope_use: [...SCENARIOS],
		handler: async (context) => {
			const input = context.trigger.input;
			const root = (input.directory?.trim() || context.session.cwd || "").replace(/[\\/]+$/, "");
			if (!root) return { ok: false, error: "no-directory", detail: "pass `directory` explicitly" };

			if (input.direction === "import") return importChapters(ctx, service, root, input.bookId);
			if (input.direction === "export") return exportChapters(ctx, service, root, input.bookId);
			return { ok: false, error: "invalid-direction", detail: String(input.direction) };
		},
	});
}

async function importChapters(
	ctx: PluginContext,
	service: StudioService,
	root: string,
	bookId?: string,
): Promise<unknown> {
	const entries = await ctx.fs.readDir(root);
	const imported: { n: number; words: number }[] = [];
	const unchanged: number[] = [];
	const unmatched: string[] = [];
	const failed: { file: string; error: string }[] = [];

	const candidates = entries
		.filter((entry) => !entry.isDirectory && /\.md$/i.test(entry.name))
		.map((entry) => ({ entry, n: chapterNumberOf(entry.name) }))
		.filter((item) => {
			if (item.n === null) unmatched.push(item.entry.name);
			return item.n !== null;
		})
		.sort((left, right) => (left.n ?? 0) - (right.n ?? 0));

	for (const { entry, n } of candidates) {
		if (n === null) continue;
		const { content } = await ctx.fs.readFile(entry.path);
		const current = await service.readChapter(n, bookId);
		if (current.ok && current.data.text === content) {
			unchanged.push(n);
			continue;
		}

		const result = await service.saveChapter({ n, content, title: titleOf(content, entry.name) }, bookId);
		if (!result.ok) {
			failed.push({ file: entry.name, error: result.error });
			continue;
		}
		imported.push({ n, words: result.data.chapters.find((chapter) => chapter.n === n)?.words ?? 0 });
	}

	return { ok: failed.length === 0, root, imported, unchanged, unmatched, failed };
}

async function exportChapters(
	ctx: PluginContext,
	service: StudioService,
	root: string,
	bookId?: string,
): Promise<unknown> {
	const book = await service.resolveBook(bookId);
	if (!book) return { ok: false, error: "book-not-found", root };

	const directory = `${root}/chapters`;
	const existing = await ctx.fs.stat(directory);
	if (!existing) await ctx.fs.createDirectory(directory);

	const written: number[] = [];
	const failed: { n: number; error: string }[] = [];

	for (const chapter of book.chapters.slice().sort((left, right) => left.n - right.n)) {
		const result = await service.readChapter(chapter.n, book.id);
		if (!result.ok || result.data.text.length === 0) continue;
		const heading = chapter.title.trim() ? `# ${chapter.title}\n\n` : "";
		try {
			await ctx.fs.writeFile(`${directory}/${chapter.n}.md`, `${heading}${result.data.text}`);
			written.push(chapter.n);
		} catch (error) {
			failed.push({ n: chapter.n, error: error instanceof Error ? error.message : String(error) });
		}
	}

	return { ok: failed.length === 0, root, directory, written, failed };
}
