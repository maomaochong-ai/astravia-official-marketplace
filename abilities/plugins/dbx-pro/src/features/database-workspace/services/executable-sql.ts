/**
 * 「本次要执行的 SQL 文本」判定 — 选中片段执行 / 全量执行。
 *
 * SQL 编辑器声明了「有选区执行选区，否则执行全部」，这段判定原先内联在
 * sql-editor.tsx 的三处入口（当前 tab 执行、新 tab 执行、EXPLAIN）里，
 * 每处各写一遍 `to > from ? sliceString(...) : undefined`。
 *
 * 抽成纯函数有两个目的：
 * 1. 三个入口共用同一份语义，避免只有主入口改对了、EXPLAIN 仍然跑全量；
 * 2. 可回归：选区在语法上可能只是空白（用户拖了个空行），此时必须回退整篇，
 *    否则会把一条空 SQL 发给引擎，得到「SQL 不能为空」这种无意义的报错。
 *
 * 纯函数，不依赖 CodeMirror，便于单测。
 */

/** 选区（与 CodeMirror 的 `EditorSelection.range` 结构兼容）。 */
export interface SelectionRange {
	from: number;
	to: number;
}

/**
 * 只依赖 CodeMirror `Text` 的两个成员，避免为了取片段把整篇文档 copy 成字符串。
 * 传普通字符串同样可用（内部转成 slice）。
 */
export interface SliceableText {
	length: number;
	sliceString(from: number, to: number): string;
}

export type ExecutableSource = string | SliceableText;

function slice(source: ExecutableSource, from: number, to: number): string {
	return typeof source === "string" ? source.slice(from, to) : source.sliceString(from, to);
}

function docLength(source: ExecutableSource): number {
	return source.length;
}

/**
 * 解析可执行 SQL。
 *
 * @returns 非空选区的文本（原样保留缩进与换行，不做 trim 改写）；
 *          返回 `undefined` 表示「没有可用选区」，调用方按整篇 SQL 执行。
 */
export function resolveExecutableSql(
	source: ExecutableSource,
	selection?: SelectionRange | null,
): string | undefined {
	if (!selection) return undefined;
	const { from, to } = selection;
	if (!Number.isFinite(from) || !Number.isFinite(to)) return undefined;
	const start = Math.max(0, Math.min(from, docLength(source)));
	const end = Math.max(0, Math.min(to, docLength(source)));
	if (end <= start) return undefined;
	const fragment = slice(source, start, end);
	// 只有空白 / 换行的选区视为「没有选区」：多半是误拖，不该把整篇变成一条空 SQL。
	return fragment.trim() ? fragment : undefined;
}
