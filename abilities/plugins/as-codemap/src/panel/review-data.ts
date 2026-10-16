/**
 * 审查 tab 的模拟数据。
 *
 * 真实环境里 review 结果应来自一个新的 agent tool `code_review_run`（本轮不实装），
 * 此处用静态样本撑起 UI，便于复刻 GitHub PR Review 的视觉。
 *
 * 严重度分四级：error / warning / info / hint。
 * 颜色在 ReviewTab 中按 Primer 风格 token 映射：
 * - error  → 红（#cf222e / 深色 #ff7b72）
 * - warning → 黄（#9a6700 / 深色 #d29922）
 * - info → 蓝（#0969da / 深色 #79c0ff）
 * - hint → 灰（#57606a / 深色 #8b949e）
 */
import type { CodeMapStore } from "../store/codemap-store";

export type ReviewSeverity = "error" | "warning" | "info" | "hint";

export type ReviewFileStatus = "added" | "modified" | "renamed" | "deleted" | "unchanged";

export interface ReviewFinding {
	id: string;
	rule: string;
	severity: ReviewSeverity;
	message: string;
	line: number;
	hunkStart: number;
}

export interface ReviewHunkLine {
	kind: "context" | "add" | "del";
	number: number | null;
	text: string;
	findingId?: string;
}

export interface ReviewFile {
	path: string;
	previousPath?: string;
	status: ReviewFileStatus;
	language: string;
	additions: number;
	deletions: number;
	hunks: { start: number; lines: ReviewHunkLine[] }[];
	findings: ReviewFinding[];
}

/**
 * 给当前 store 准备 mock review 数据：挑选图谱里前几个真实文件，再用确定性
 * 的伪审查发现关联到这些文件。如果 store 还没构建，就用一组不依赖工作区的
 * 默认样本。
 */
export function selectReviewFiles(store: CodeMapStore): ReviewFile[] {
	const index = store.getIndex();
	const symbols = index ? index.graph.symbols : [];
	const realFiles: string[] = [];
	const seen = new Set<string>();
	for (const sym of symbols) {
		if (!seen.has(sym.file)) {
			seen.add(sym.file);
			realFiles.push(sym.file);
			if (realFiles.length >= 4) break;
		}
	}

	const fallback: ReviewFile[] = [
		{
			path: "src/parser/symbol-graph.ts",
			status: "modified",
			language: "ts",
			additions: 18,
			deletions: 4,
			hunks: [
				{
					start: 28,
					lines: [
						{ kind: "context", number: 28, text: "const DECL_PATTERNS: RegExp[] = [" },
						{ kind: "add", number: 29, text: "  /\\\\bfunction\\\\s+([A-Za-z_$][\\\\w$]*)/," },
						{ kind: "add", number: 30, text: "  /\\\\bclass\\\\s+([A-Za-z_$][\\\\w$]*)/," },
						{ kind: "del", number: null, text: "  /function\\\\s+([A-Za-z_\\\\$][\\\\w\\\\$]*)/," },
						{ kind: "context", number: 31, text: "];" },
					],
				},
			],
			findings: [
				{
					id: "f1",
					rule: "as-codemap/lexical-overmatch",
					severity: "warning",
					message: "正则未做大小写不敏感控制；同名方法名匹配范围比预期更广。",
					line: 29,
					hunkStart: 28,
				},
				{
					id: "f2",
					rule: "as-codemap/unicode-boundary",
					severity: "info",
					message: "标识符允许 $，但未对 Unicode 标识符显式判断——大多数 TS 项目无影响。",
					line: 30,
					hunkStart: 28,
				},
			],
		},
		{
			path: "src/store/codemap-store.ts",
			status: "modified",
			language: "ts",
			additions: 42,
			deletions: 12,
			hunks: [
				{
					start: 67,
					lines: [
						{ kind: "context", number: 67, text: "private async walk(dir: string): Promise<string[]> {" },
						{ kind: "add", number: 68, text: "  // 之前对 readDir 抛错会终止整个 walk；现在改成记录并跳过" },
						{ kind: "add", number: 69, text: "  try {" },
						{ kind: "context", number: 70, text: "    const entries = await this.ctx.fs.readDir(dir);" },
						{ kind: "del", number: null, text: "    const entries = readdirSync(dir, { withFileTypes: true });" },
						{ kind: "context", number: 71, text: "    for (const entry of entries) {" },
					],
				},
			],
			findings: [
				{
					id: "f3",
					rule: "as-codemap/async-hostility",
					severity: "error",
					message: "try/catch 内使用同步风格的 ctx.fs.readDir 错误流会冒泡到 walk；改用 async 等价物。",
					line: 69,
					hunkStart: 67,
				},
				{
					id: "f4",
					rule: "as-codemap/dead-import",
					severity: "info",
					message: "原 readdirSync 已不再被引用，import 残留。",
					line: 70,
					hunkStart: 67,
				},
			],
		},
		{
			path: "src/panel/CodeMapPanel.tsx",
			status: "modified",
			language: "tsx",
			additions: 9,
			deletions: 6,
			hunks: [
				{
					start: 19,
					lines: [
						{ kind: "context", number: 19, text: "return (" },
						{ kind: "add", number: 20, text: "  <div className=\"flex h-full flex-col\">" },
						{ kind: "del", number: null, text: "  <div className=\"flex flex-col h-full\">" },
						{ kind: "context", number: 21, text: "    <div className=\"flex items-center gap-2 border-b border-border px-3 py-2\">" },
					],
				},
			],
			findings: [
				{
					id: "f5",
					rule: "as-codemap/severity-bucket",
					severity: "warning",
					message: "硬编码「代码图谱」未走 i18n.t，宿主切语言会失效。",
					line: 21,
					hunkStart: 19,
				},
			],
		},
		{
			path: "vite.config.ts",
			status: "modified",
			language: "ts",
			additions: 3,
			deletions: 1,
			hunks: [
				{
					start: 1,
					lines: [
						{ kind: "add", number: 1, text: "// @ts-nocheck" },
						{ kind: "context", number: 2, text: "import { defineConfig } from \"vite\";" },
						{ kind: "add", number: 3, text: "// vite 来自 .bun/ 软链，rollup 私有类型会冲突" },
						{ kind: "del", number: null, text: "// (no comment)" },
					],
				},
			],
			findings: [
				{
					id: "f6",
					rule: "as-codemap/ts-nocheck",
					severity: "warning",
					message: "整个配置文件 @ts-nocheck；IDE 无法给出任何提示，CI 也跳过检查。",
					line: 1,
					hunkStart: 1,
				},
				{
					id: "f7",
					rule: "as-codemap/symlink-shim",
					severity: "hint",
					message: "vite 来自 .bun/ 软链，rollup 私有类型冲突是已知副作用。",
					line: 3,
					hunkStart: 1,
				},
			],
		},
	];

	if (realFiles.length === 0) return fallback;

	// 把 fallback 顶替成工作区里真实存在的文件，保持视觉一致。
	return fallback.map((entry, i) => {
		const realPath = realFiles[i];
		if (!realPath) return entry;
		return { ...entry, path: realPath };
	});
}
