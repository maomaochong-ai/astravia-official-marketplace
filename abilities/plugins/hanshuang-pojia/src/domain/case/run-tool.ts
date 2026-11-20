/**
 * 先例工具的执行计划：把「跑哪一个、先自检、再带什么参数」算成纯数据。
 *
 * 拆出来是为了可测：真正执行要开进程，而「参数怎么拆、manifest 里的入口是否对得上、
 * 自检先行」这三件事都能在这里断言，不必依赖机器上有 python。
 *
 * 三条硬约定（与 `docs/audits/case-tools-intake.md` 的 P0 一致）：
 *   1. **永远先跑 `--self-test`**，不通过就停 —— 让「跑不了」是一条明确错误，
 *      而不是一个看起来成功的错补丁；
 *   2. 参数按 shell 习惯的空白拆分，支持单双引号包住含空格的路径；
 *   3. 不猜入口：manifest 里没有的工具直接拒绝，并列出实际有的。
 */

import type { ShippedPrecedent } from "./precedents";

export interface PrecedentToolSpec {
	readonly id: string;
	readonly entry: string;
	readonly purpose: string;
	readonly args?: readonly string[];
	readonly expect?: string;
	readonly selfTest?: string;
}

export interface RunToolPlan {
	readonly slug: string;
	readonly toolId: string;
	readonly entry: string;
	/** 自检参数：`[<entryPath>, "--self-test"]`。 */
	readonly selfTest: readonly string[];
	/** 真跑参数；调用方没给参数时为 null（只做自检）。 */
	readonly run: readonly string[] | null;
	/** manifest 里声明的参数形状，用于提示用户怎么填。 */
	readonly usage: readonly string[];
}

/** 空白拆分，单双引号包住的部分保持完整；不处理转义（先例工具的参数里没有）。 */
export function splitArgs(input: string | undefined): string[] {
	const text = (input ?? "").trim();
	if (text.length === 0) return [];
	const out: string[] = [];
	let current = "";
	let quote: '"' | "'" | null = null;
	for (const char of text) {
		if (quote) {
			if (char === quote) quote = null;
			else current += char;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (/\s/.test(char)) {
			if (current.length > 0) {
				out.push(current);
				current = "";
			}
			continue;
		}
		current += char;
	}
	if (current.length > 0) out.push(current);
	return out;
}

export function toolsOf(precedent: ShippedPrecedent): readonly PrecedentToolSpec[] {
	return (precedent.tools?.tools ?? []) as readonly PrecedentToolSpec[];
}

/** 按 id 或文件名找工具；两者都不匹配返回 undefined（调用方负责报错并列出可选）。 */
export function findTool(precedent: ShippedPrecedent, query: string): PrecedentToolSpec | undefined {
	const needle = query.trim().toLowerCase();
	if (needle.length === 0) return undefined;
	return toolsOf(precedent).find(tool => tool.id.toLowerCase() === needle || tool.entry.toLowerCase() === needle);
}

/**
 * 生成执行计划。`entryPath` 是脚本在工作区里的相对路径（调用方拼好），
 * 因为「脚本自己解析 hpkit」靠的是 `sys.argv[0]` 的位置，不需要 cwd。
 */
export function planRunTool(precedent: ShippedPrecedent, tool: PrecedentToolSpec, entryPath: string, argsText?: string): RunToolPlan {
	const args = splitArgs(argsText);
	return {
		slug: precedent.slug,
		toolId: tool.id,
		entry: tool.entry,
		selfTest: [entryPath, "--self-test"],
		run: args.length > 0 ? [entryPath, ...args] : null,
		usage: tool.args ?? [],
	};
}
