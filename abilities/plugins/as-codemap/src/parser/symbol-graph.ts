/**
 * TypeScript/JavaScript 的轻量符号-引用图提取（零依赖，纯函数）。
 *
 * 设计取舍（诚实声明）：
 * - 不引入 web-tree-sitter：仓库无该依赖，插件包需自带 wasm 资源，
 *   分发与体积成本高，违背「稳定优先」；
 * - 用**括号计数 + 声明头识别**提取符号（function/class/method/const），
 *   引用边用标识符词法匹配；精确度对 TS/JS 工程足够，对同名的
 *   局部变量会有假阳性——面板与工具描述都明示「拓扑导航用，不做
 *   重构级精确分析」；
 * - 后续若要更高精度，把 extractSymbols/extractReferences 换成
 *   tree-sitter 实现即可，图模型与上层接口不变。
 */

export type SymbolKind = "function" | "class" | "method" | "const" | "interface";

export interface CodeSymbol {
	readonly id: string;
	readonly name: string;
	readonly kind: SymbolKind;
	readonly file: string;
	readonly line: number;
}

export interface CodeReference {
	readonly fromFile: string;
	readonly toSymbol: string;
	readonly count: number;
}

export interface CodeGraph {
	readonly symbols: readonly CodeSymbol[];
	readonly references: readonly CodeReference[];
}

interface Match {
	readonly name: string;
	readonly kind: SymbolKind;
	readonly line: number;
}

const DECL_PATTERNS: ReadonlyArray<{ readonly re: RegExp; readonly kind: SymbolKind }> = [
	{ re: /^\s*export\s+default\s+async\s+function\s+([A-Za-z_$][\w$]*)/, kind: "function" },
	{ re: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/, kind: "function" },
	{ re: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, kind: "class" },
	{ re: /^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/, kind: "interface" },
	{ re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=/, kind: "const" },
	{ re: /^[ \t]+(?:public\s+|private\s+|protected\s+|static\s+|async\s+|get\s+|set\s+|readonly\s+|override\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(.*\)\s*(?::.*)?\s*\{/, kind: "method" },
];

const RESERVED = new Set([
	"if","for","while","switch","catch","return","function","class","const","let","var",
	"new","typeof","await","async","import","export","from","default","true","false",
	"null","undefined","this","super","void","delete","in","of","else","do","try","throw",
]);

function makeSymbolId(file: string, name: string, line: number): string {
	return `${file}:${line}:${name}`;
}

/** 单文件的符号声明提取（声明头识别，不进函数体）。 */
export function extractSymbols(file: string, source: string): readonly CodeSymbol[] {
	const lines = source.split("\n");
	const found: CodeSymbol[] = [];
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i] as string;
		if (line.trimStart().startsWith("//")) continue;
		for (const pattern of DECL_PATTERNS) {
			const m = pattern.re.exec(line);
			if (!m?.[1]) continue;
			const name = m[1];
			found.push({
				id: makeSymbolId(file, name, i + 1),
				name,
				kind: pattern.kind,
				file,
				line: i + 1,
			});
			break;
		}
	}
	return found;
}

/** 单文件对一组符号名的引用计数（词法匹配，排除声明行自身）。 */
export function extractReferences(file: string, source: string, symbols: readonly CodeSymbol[]): readonly CodeReference[] {
	if (symbols.length === 0) return [];
	const byName = new Map<string, number>();
	const declLines = new Set(symbols.filter((s) => s.file === file).map((s) => s.line));
	const lines = source.split("\n");
	for (let i = 0; i < lines.length; i += 1) {
		if (declLines.has(i + 1)) continue;
		const line = lines[i] as string;
		if (line.trimStart().startsWith("//")) continue;
		const tokens = line.match(/[A-Za-z_$][\w$]*/g);
		if (!tokens) continue;
		for (const token of tokens) {
			byName.set(token, (byName.get(token) ?? 0) + 1);
		}
	}
	const out: CodeReference[] = [];
	for (const symbol of symbols) {
		const count = byName.get(symbol.name) ?? 0;
		if (count > 0) out.push({ fromFile: file, toSymbol: symbol.name, count });
	}
	return out;
}

/** 组装工作区图（symbols 去重：同名多处声明都保留，引用按 file×name 聚合）。 */
export function buildCodeGraph(files: ReadonlyMap<string, string>): CodeGraph {
	const symbols: CodeSymbol[] = [];
	for (const [file, source] of files) {
		if (!isParseable(file)) continue;
		symbols.push(...extractSymbols(file, source));
	}
	const byName = new Map<string, CodeSymbol[]>();
	for (const symbol of symbols) {
		const list = byName.get(symbol.name) ?? [];
		list.push(symbol);
		byName.set(symbol.name, list);
	}
	const references: CodeReference[] = [];
	for (const [file, source] of files) {
		if (!isParseable(file)) continue;
		for (const reference of extractReferences(file, source, [...byName.values()].flat())) {
			const existing = references.find((r) => r.fromFile === reference.fromFile && r.toSymbol === reference.toSymbol);
			if (existing) {
				references.splice(references.indexOf(existing), 1, { ...existing, count: existing.count + reference.count });
			} else {
				references.push(reference);
			}
		}
	}
	return { symbols, references };
}

function isParseable(file: string): boolean {
	return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file);
}

export function isReservedWord(name: string): boolean {
	return RESERVED.has(name);
}

/** 符号搜索（agent 工具用）：名称子串匹配，kind 可选过滤。 */
export function searchSymbols(graph: CodeGraph, query: string, kind?: SymbolKind): readonly CodeSymbol[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [];
	return graph.symbols
		.filter((s) => s.name.toLowerCase().includes(needle))
		.filter((s) => (kind ? s.kind === kind : true))
		.sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file));
}
