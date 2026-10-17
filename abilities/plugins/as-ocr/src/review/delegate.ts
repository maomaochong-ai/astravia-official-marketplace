/**
 * 委托模式（delegation）：OCR 只做确定性工程，审查由宿主 agent 用自己的模型完成。
 *
 * 上游 `ocr review` 必须先配置 LLM（`~/.opencodereview/config.json` 或 OCR_LLM_* 等环境变量），
 * 否则直接报 `no valid LLM endpoint configured`；而宿主 agent 本身就有模型额度。
 * 委托模式因此是「零配置可用」的正解：`ocr delegate preview` 选文件、`ocr delegate rule` 给规则，
 * diff 由 git 取，判断交给会话里的模型。
 *
 * 本文件只放纯函数（参数组装 / preview 解析 / 简报拼装），便于单测。
 */

export type DelegateMode = "workspace" | "range" | "commit";

export interface DelegateInput {
	readonly from?: string;
	readonly to?: string;
	readonly commit?: string;
}

export interface DelegateFile {
	readonly path: string;
	readonly status: string;
	readonly insertions: number;
	readonly deletions: number;
}

export interface DelegateExcluded {
	readonly path: string;
	readonly reason: string;
}

export interface DelegatePreview {
	mode: DelegateMode;
	readonly refs: Record<string, string>;
	readonly files: DelegateFile[];
	readonly excluded: DelegateExcluded[];
	reviewable: number;
	total: number;
}

const EMPTY_PREVIEW: () => DelegatePreview = () => ({
	mode: "workspace",
	refs: {},
	files: [],
	excluded: [],
	reviewable: 0,
	total: 0,
});

/** `ocr delegate preview` 的参数；`--repo` 让范围不依赖子进程的工作目录。 */
export function buildPreviewArgs(input: DelegateInput, repo: string): string[] {
	const args = ["delegate", "preview", "--repo", repo];
	if (input.commit) args.push("--commit", input.commit);
	else if (input.from) args.push("--from", input.from, "--to", input.to ?? "HEAD");
	return args;
}

/** `ocr delegate rule` 的参数：一次问完所有可审查文件的规则（OCR 按内容分组去重）。 */
export function buildRuleArgs(paths: readonly string[], repo: string): string[] {
	return ["delegate", "rule", ...paths, "--repo", repo];
}

/**
 * 解析 `ocr delegate preview` 的文本输出。
 *
 * 形如：
 *   # Files (11 reviewable / 14 total)
 *   - mode: workspace
 *   - `a.ts` [modified] +2/-2
 *   ~~- `b.ts` [added] +3/-0 (excluded: default_path)~~
 */
export function parsePreview(text: string): DelegatePreview {
	const preview = EMPTY_PREVIEW();
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) continue;

		const header = /^#\s*Files\s*\((\d+)\s*reviewable\s*\/\s*(\d+)\s*total\)/i.exec(line);
		if (header) {
			preview.reviewable = Number(header[1]);
			preview.total = Number(header[2]);
			continue;
		}

		const meta = /^-\s*(mode|from|to|merge_base|commit):\s*(\S+)/.exec(line);
		if (meta) {
			if (meta[1] === "mode") preview.mode = meta[2] as DelegateMode;
			else preview.refs[meta[1]] = meta[2];
			continue;
		}

		const excluded = /^~~-\s*`(.+?)`.*?\(excluded:\s*(.+?)\)\s*~~$/.exec(line);
		if (excluded) {
			preview.excluded.push({ path: excluded[1], reason: excluded[2].trim() });
			continue;
		}

		const file = /^-\s*`(.+?)`\s*\[(.+?)\](?:\s*\+(\d+)\/-(\d+))?/.exec(line);
		if (file) {
			preview.files.push({
				path: file[1],
				status: file[2],
				insertions: Number(file[3] ?? 0),
				deletions: Number(file[4] ?? 0),
			});
		}
	}
	return preview;
}

/**
 * 单个文件的 diff 命令（按优先级尝试，取第一个有输出的）。
 *
 * 工作区模式下未跟踪的新文件在 `git diff HEAD` 里是空的，退回 `--no-index`（等价 /dev/null 对比，
 * 差异存在时退出码为 1，属正常结果）。参数与上游 delegate 文档一致：禁外部 diff、禁文本转换、禁颜色。
 */
export function gitDiffArgs(preview: DelegatePreview, path: string): string[][] {
	const base = ["--no-pager"];
	const guard = ["--no-ext-diff", "--no-textconv", "--no-color"];
	if (preview.mode === "commit" && preview.refs.commit) {
		return [[...base, "show", ...guard, preview.refs.commit, "--", path]];
	}
	if (preview.mode === "range") {
		const to = preview.refs.to ?? "HEAD";
		const range = preview.refs.merge_base ? `${preview.refs.merge_base}..${to}` : `${preview.refs.from}..${to}`;
		return [[...base, "diff", ...guard, range, "--", path]];
	}
	return [
		[...base, "diff", ...guard, "HEAD", "--", path],
		[...base, "diff", ...guard, "--no-index", "--", "/dev/null", path],
	];
}

export interface BriefFile {
	readonly file: DelegateFile;
	readonly diff: string;
	readonly truncated: boolean;
}

export interface BriefOptions {
	/** 单个 diff 的字符上限，超出截断。 */
	readonly maxDiffChars?: number;
	/** 全部 diff 的字符上限，超出后剩余文件只列路径。 */
	readonly maxTotalChars?: number;
}

const DEFAULT_MAX_DIFF = 12_000;
const DEFAULT_MAX_TOTAL = 60_000;
/** 剩余预算不足这个值就不再塞新文件（首个文件例外，保证简报里至少有东西可审）。 */
const MIN_SLICE_CHARS = 400;

/** 人可读的范围描述：workspace / main…HEAD / <commit>。 */
export function describeScope(preview: DelegatePreview): string {
	if (preview.mode === "commit" && preview.refs.commit) return preview.refs.commit.slice(0, 10);
	if (preview.mode === "range") return `${preview.refs.from ?? "?"}…${preview.refs.to ?? "HEAD"}`;
	return "workspace";
}

/**
 * 把 preview / 规则 / diff 拼成给模型的审查简报。
 *
 * 不做任何结论性描述——判断留给模型；没取到 diff 的文件明确标成「需自行读取」，
 * 避免模型把没看过的文件当成已审。
 */
export function composeBrief(options: {
	readonly root: string;
	readonly preview: DelegatePreview;
	readonly rules: string;
	readonly files: readonly BriefFile[];
	readonly missing: readonly string[];
}): string {
	const preview = options.preview;
	const skipped = options.missing.length;
	const head = [
		"## 审查范围（ocr 委托模式：文件筛选与规则由 ocr 给出，判断由你完成）",
		`- 工作区：${options.root}`,
		`- 范围：${describeScope(preview)}（mode: ${preview.mode}）`,
		`- 可审查文件：${preview.files.length} 个${preview.excluded.length > 0 ? `；已按 ocr 规则排除 ${preview.excluded.length} 个` : ""}`,
	].join("\n");

	const fileList = preview.files
		.map((f) => `- \`${f.path}\` [${f.status}] +${f.insertions}/-${f.deletions}`)
		.join("\n");

	const rules = options.rules.trim()
		? `## 审查规则（按路径匹配）\n\n${options.rules.trim()}`
		: "## 审查规则\n\n（ocr 未返回规则，按通用缺陷清单审查：空指针/异常处理/并发与状态、安全（XSS、注入、越权）、资源泄漏、边界与错误分支、明显回归。）";

	const body = options.files
		.map((entry, index) => {
			const header = `### ${index + 1}. \`${entry.file.path}\` [${entry.file.status}] +${entry.file.insertions}/-${entry.file.deletions}`;
			if (!entry.diff.trim()) return `${header}\n\n（无 diff 输出，需要你自行读取该文件判断。）`;
			return `${header}\n\n\`\`\`diff\n${entry.diff.trim()}\n\`\`\`${entry.truncated ? "\n（diff 过长已截断）" : ""}`;
		})
		.join("\n\n");

	const tail =
		skipped > 0
			? `\n\n未取到 diff 的文件（${skipped} 个，需要时自行读取）：\n${options.missing.map((p) => `- \`${p}\``).join("\n")}`
			: "";

	return `${head}\n\n${fileList}\n\n${rules}\n\n## 待审 diff\n\n${body}${tail}`;
}

/** 按预算裁剪 diff：先截单文件，再截总量，剩下的文件记入 missing。 */
export function selectDiffBudget(
	preview: DelegatePreview,
	diffs: ReadonlyMap<string, string>,
	options: BriefOptions = {},
): { files: BriefFile[]; missing: string[] } {
	const maxDiff = options.maxDiffChars ?? DEFAULT_MAX_DIFF;
	const maxTotal = options.maxTotalChars ?? DEFAULT_MAX_TOTAL;
	const files: BriefFile[] = [];
	const missing: string[] = [];
	let used = 0;
	for (const file of preview.files) {
		const diff = diffs.get(file.path) ?? "";
		if (!diff.trim()) {
			missing.push(file.path);
			continue;
		}
		const remaining = maxTotal - used;
		if (remaining < Math.min(MIN_SLICE_CHARS, maxDiff) && files.length > 0) {
			missing.push(file.path);
			continue;
		}
		const limit = Math.min(maxDiff, remaining);
		const truncated = diff.length > limit;
		const slice = truncated ? diff.slice(0, limit) : diff;
		used += slice.length;
		files.push({ file, diff: slice, truncated });
	}
	return { files, missing };
}
