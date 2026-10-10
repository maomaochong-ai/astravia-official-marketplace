/**
 * SQL 表名重写：把「API 数据源名」换成 DuckDB 读本地快照的表函数。
 *
 * 为什么需要：查询语言仍然是 SQL（用户不必学新语法），但 API 数据源不是真表。
 * 查询前把接口取下来的记录物化成 NDJSON，再把 SQL 里的表引用重写成
 * `read_json_auto('<绝对路径>')`，交给本机 DuckDB 执行。
 *
 * 例：`select posts.id from posts where posts.id = 1`
 *   → `select posts.id from read_json_auto('/…/api-cache/posts.ndjson') AS "posts" where posts.id = 1`
 *
 * 关键设计：重写后的表函数**带上原名的别名**（用户在 `posts.id` 里已经那么叫了），
 * 所以不需要把限定引用也改写 —— 那是把简单事做复杂的典型。
 *
 * 只做**词法扫描**，不做完整 SQL 解析：与字符串 / 注释 / 引号标识符保持安全距离，
 * 并且**只碰名字命中已配置数据源的标识符**，误判不会波及普通查询。
 * 纯函数模块，不接触网络 / 文件系统，便于单测。
 */

import { ApiSourceError } from "./api-source.mjs";

/** FROM / JOIN 之后紧跟这些词时，说明表名还没出现（修饰词），继续等。 */
const TABLE_MODIFIERS = new Set(["LATERAL", "ONLY"]);

/** 表引用之后的这些词说明别名不存在，FROM 子句到这儿就结束了。 */
const CLAUSE_KEYWORDS = new Set([
	"WHERE",
	"JOIN",
	"INNER",
	"LEFT",
	"RIGHT",
	"FULL",
	"OUTER",
	"CROSS",
	"NATURAL",
	"ON",
	"USING",
	"GROUP",
	"ORDER",
	"HAVING",
	"LIMIT",
	"OFFSET",
	"QUALIFY",
	"WINDOW",
	"SAMPLE",
	"UNION",
	"EXCEPT",
	"INTERSECT",
	"RETURNING",
	"VALUES",
	"TABLESAMPLE",
	"FROM",
]);

/**
 * 词法扫描。返回 token 数组，`kind` ∈ opaque / ident / quoted / punct。
 * opaque 涵盖空白、注释、字符串、数字 —— 它们整体原样保留，绝不参与重写。
 */
export function tokenize(sql) {
	const text = String(sql ?? "");
	const tokens = [];
	const n = text.length;
	let i = 0;

	while (i < n) {
		const ch = text[i];

		if (ch === "-" && text[i + 1] === "-") {
			const stop = text.indexOf("\n", i);
			const end = stop === -1 ? n : stop;
			tokens.push({ kind: "opaque", text: text.slice(i, end) });
			i = end;
			continue;
		}
		if (ch === "/" && text[i + 1] === "*") {
			const stop = text.indexOf("*/", i + 2);
			const end = stop === -1 ? n : stop + 2;
			tokens.push({ kind: "opaque", text: text.slice(i, end) });
			i = end;
			continue;
		}
		if (ch === "'") {
			let j = i + 1;
			while (j < n) {
				if (text[j] === "'") {
					if (text[j + 1] === "'") {
						j += 2;
						continue;
					}
					j += 1;
					break;
				}
				j += 1;
			}
			tokens.push({ kind: "opaque", text: text.slice(i, j) });
			i = j;
			continue;
		}
		if (ch === '"' || ch === "`") {
			const quote = ch;
			let j = i + 1;
			while (j < n) {
				if (text[j] === quote) {
					if (text[j + 1] === quote) {
						j += 2;
						continue;
					}
					j += 1;
					break;
				}
				j += 1;
			}
			const raw = text.slice(i, j);
			const inner = raw.slice(1, -1).split(quote + quote).join(quote);
			tokens.push({ kind: "quoted", text: raw, name: inner });
			i = j;
			continue;
		}
		if (ch === "$") {
			const match = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(text.slice(i));
			if (match) {
				const tag = match[0];
				const stop = text.indexOf(tag, i + tag.length);
				const end = stop === -1 ? n : stop + tag.length;
				tokens.push({ kind: "opaque", text: text.slice(i, end) });
				i = end;
				continue;
			}
		}
		// 中文字段/表名很常见，裸写（不加双引号）必须也算标识符，否则
		// `select * from 订单` 会因为 token 变成单个 punct 而漏掉重写。
		if (/[A-Za-z_\u0080-\uFFFF]/.test(ch)) {
			let j = i;
			while (j < n && /[A-Za-z0-9_$\u0080-\uFFFF]/.test(text[j])) j += 1;
			tokens.push({ kind: "ident", text: text.slice(i, j) });
			i = j;
			continue;
		}
		if (/[0-9]/.test(ch)) {
			let j = i;
			while (j < n && /[0-9a-fA-FxX.]/.test(text[j])) j += 1;
			tokens.push({ kind: "opaque", text: text.slice(i, j) });
			i = j;
			continue;
		}
		if (/\s/.test(ch)) {
			let j = i;
			while (j < n && /\s/.test(text[j])) j += 1;
			tokens.push({ kind: "opaque", text: text.slice(i, j) });
			i = j;
			continue;
		}
		tokens.push({ kind: "punct", text: ch });
		i += 1;
	}
	return tokens;
}

/** token 里的标识符名（引号标识符取内层），否则 null。 */
function identName(token) {
	if (!token) return null;
	if (token.kind === "ident") return token.text;
	if (token.kind === "quoted") return token.name;
	return null;
}

function nextSignificant(tokens, from) {
	for (let k = from; k < tokens.length; k += 1) {
		if (tokens[k].kind !== "opaque") return k;
	}
	return -1;
}

/**
 * 找出「表位置」的 token 下标，并判断每个后面是否已经写了别名。
 * 返回 `[{ index, hasAlias }]`。
 */
export function findTableRefs(tokens) {
	const refs = [];
	let expectTable = false;
	let fromList = false;
	let fromBaseDepth = 0;
	let depth = 0;

	for (let k = 0; k < tokens.length; k += 1) {
		const token = tokens[k];
		if (token.kind === "opaque") continue;

		if (token.kind === "punct") {
			if (token.text === "(") {
				depth += 1;
				if (expectTable) expectTable = false;
				continue;
			}
			if (token.text === ")") {
				depth -= 1;
				if (fromList && depth < fromBaseDepth) fromList = false;
				expectTable = false;
				continue;
			}
			if (token.text === ",") {
				if (fromList && depth === fromBaseDepth) expectTable = true;
				continue;
			}
			// 其余标点（. ; = …）意味着表引用已经结束
			if (token.text === ".") expectTable = false;
			continue;
		}

		if (token.kind === "quoted") {
			if (expectTable) {
				refs.push({ index: k, hasAlias: aliasFollows(tokens, k) });
				expectTable = false;
			}
			continue;
		}

		const name = token.text;
		const upper = name.toUpperCase();

		if (upper === "FROM" || upper === "JOIN") {
			expectTable = true;
			fromList = true;
			fromBaseDepth = depth;
			continue;
		}

		if (expectTable) {
			if (TABLE_MODIFIERS.has(upper)) continue;
			refs.push({ index: k, hasAlias: aliasFollows(tokens, k) });
			expectTable = false;
			continue;
		}

		if (CLAUSE_KEYWORDS.has(upper)) {
			fromList = false;
			expectTable = false;
		}
	}

	return refs;
}

/** 表名之后是否已经有别名（`AS x` / `x`）。 */
function aliasFollows(tokens, index) {
	const next = nextSignificant(tokens, index + 1);
	if (next === -1) return false;
	const token = tokens[next];
	if (token.kind === "punct") return false;
	const name = identName(token);
	if (name === null) return false;
	return !CLAUSE_KEYWORDS.has(name.toUpperCase());
}

function escapePath(path) {
	return String(path).split("'").join("''");
}

/**
 * 重写 SQL。
 *
 * @param {string} sql
 * @param {Map<string,string> | Record<string,string>} snapshotPaths 数据源名（小写）→ 快照绝对路径
 * @param {{ names?: string[] }} [options] 只在 SQL 里出现过的数据源名（用于附加「取数清单」）
 */
export function rewriteApiTableRefs(sql, snapshotPaths, options = {}) {
	const paths = snapshotPaths instanceof Map ? snapshotPaths : new Map(Object.entries(snapshotPaths ?? {}));
	const tokens = tokenize(sql);
	const refs = findTableRefs(tokens);
	const replaced = new Set();

	for (const ref of refs) {
		const token = tokens[ref.index];
		const name = identName(token);
		if (name === null) continue;
		const path = paths.get(name.toLowerCase());
		if (!path) continue;
		const alias = ref.hasAlias ? "" : ` AS "${name.split('"').join('""')}"`;
		token.rewrite = `read_json_auto('${escapePath(path)}')${alias}`;
		replaced.add(name.toLowerCase());
	}

	const rewritten = tokens.map((token) => token.rewrite ?? token.text).join("");
	return {
		sql: rewritten,
		replaced: [...replaced],
		referenced: options.names ? options.names.filter((n) => referencedIn(tokens, n)) : [...replaced],
		changed: replaced.size > 0,
	};
}

/** SQL 里是否以任意位置提到过这个名字（用于决定要不要去取数）。 */
export function referencedIn(tokens, name) {
	const wanted = String(name ?? "").toLowerCase();
	if (!wanted) return false;
	return tokens.some((token) => {
		const tokenName = identName(token);
		return tokenName !== null && tokenName.toLowerCase() === wanted;
	});
}

/** 便捷包装：名字列表 + 路径解析函数 → 重写结果。 */
export function rewriteForApiSources(sql, names, pathFor) {
	const paths = new Map();
	for (const name of names) {
		const path = pathFor(name);
		if (!path) throw new ApiSourceError("BAD_REQUEST", `数据源 ${name} 没有可用的快照路径`);
		paths.set(String(name).toLowerCase(), path);
	}
	return rewriteApiTableRefs(sql, paths, { names });
}
