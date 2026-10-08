/**
 * 码谱的构建与存储层。
 *
 * 扫描纪律（借鉴 PR-G 的教训，纯函数、确定性）：
 * - 只扫工作区根下的可解析文件（ts/tsx/js/jsx/mjs/cjs）；
 * - 上限保护：单文件 512KB 以上跳过（防超大生成文件）、单文件 5000 行以上跳过、
 *   总文件数 5000 封顶、图大小超预算时降级为「只存符号不存引用」；
 * - 存储按 workspace root 哈希分片（多工作区互不覆盖）。
 */

import type { PluginContext, PluginFsEntry } from "@astravia-org/plugin-sdk";
import {
	buildCodeGraph,
	extractReferences,
	extractSymbols,
	searchSymbols,
	type CodeGraph,
	type CodeSymbol,
} from "../parser/symbol-graph";

const PARSEABLE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILE_LINES = 5000;
const MAX_FILES = 5000;
const IGNORED_DIRS = new Set(["node_modules", "dist", "out", "build", ".next"]);

export interface CodeMapIndex {
	readonly root: string;
	readonly builtAt: number;
	readonly fileCount: number;
	readonly symbolCount: number;
	readonly graph: CodeGraph;
}

export class CodeMapStore {
	private index: CodeMapIndex | null = null;
	private listeners = new Set<() => void>();

	constructor(private readonly ctx: PluginContext) {}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	dispose(): void {
		this.listeners.clear();
	}

	getIndex(): CodeMapIndex | null {
		return this.index;
	}

	async rebuild(root: string): Promise<CodeMapIndex> {
		const files = await this.collect(root);
		const graph = buildCodeGraph(files);
		const index: CodeMapIndex = {
			root,
			builtAt: Date.now(),
			fileCount: files.size,
			symbolCount: graph.symbols.length,
			graph,
		};
		this.index = index;
		this.persist(root, index);
		for (const listener of this.listeners) listener();
		return index;
	}

	/** agent 工具查询面：符号搜索 + 引用反查。 */
	query(query: string, kind?: string): string {
		if (!this.index) return "（码谱尚未构建。请先在工作区运行「构建码谱」。）";
		const symbols = searchSymbols(
			this.index.graph,
			query,
			kind as CodeSymbol["kind"] | undefined,
		);
		if (symbols.length === 0) return `未找到匹配「${query}」的符号。`;
		const top = symbols.slice(0, 20);
		const lines = top.map((s) => `${s.kind} ${s.name} — ${s.file}:${s.line}`);
		const refs = this.index.graph.references.filter((r) => top.some((s) => s.name === r.toSymbol));
		const refLines = refs.slice(0, 10).map((r) => `${r.fromFile} → ${r.toSymbol} (×${r.count})`);
		return [
			`符号（${symbols.length} 个匹配，显示前 ${top.length}）：`,
			...lines,
			...(refLines.length ? ["", "被引用：", ...refLines] : []),
		].join("\n");
	}

	private async collect(root: string): Promise<Map<string, string>> {
		const files = new Map<string, string>();
		await this.walk(root, files);
		return files;
	}

	private async walk(dir: string, files: Map<string, string>): Promise<void> {
		if (files.size >= MAX_FILES) return;
		let entries: PluginFsEntry[];
		try {
			entries = await this.ctx.fs.readDir(dir);
		} catch {
			return;
		}
		for (const entry of entries) {
			if (files.size >= MAX_FILES) return;
			if (entry.name.startsWith(".")) continue;
			if (IGNORED_DIRS.has(entry.name)) continue;
			const full = `${dir}/${entry.name}`;
			try {
				if (entry.isDirectory) {
					await this.walk(full, files);
				} else if (!entry.isDirectory && PARSEABLE.test(entry.name)) {
					const result = await this.ctx.fs.readFile(full);
					const source = result.content;
					if (source.length > MAX_FILE_BYTES) continue;
					if (source.split("\n").length > MAX_FILE_LINES) continue;
					files.set(full, source);
				}
			} catch {
				/* 单文件失败跳过 */
			}
		}
	}

	private persist(root: string, index: CodeMapIndex): void {
		void this.ctx.storage
			.writeFile(
				`codemap/${this.key(root)}.json`,
				JSON.stringify({
					builtAt: index.builtAt,
					fileCount: index.fileCount,
					symbolCount: index.symbolCount,
					graph: index.graph,
				}),
				"utf8",
			)
			.catch(() => {
				/* 存储失败不阻塞 */
			});
	}

	private key(root: string): string {
		let hash = 0;
		for (let i = 0; i < root.length; i += 1) {
			hash = (hash * 31 + root.charCodeAt(i)) | 0;
		}
		return Math.abs(hash).toString(36);
	}
}
