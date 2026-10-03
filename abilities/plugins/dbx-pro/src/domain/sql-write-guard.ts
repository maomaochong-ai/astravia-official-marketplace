/**
 * 插件侧写闸门 —— 只服务于**本地 CLI 回退路径**。
 *
 * 背景：引擎路径的写闸门在 `service/src/engine/query-guard.mjs` 里（权威实现）。
 * 一旦面板回退到 `sqlite3` CLI，引擎那道闸门就不在链上了，于是这里补一道**保守**判定：
 *
 *   1. 判定只用于「拦不拦」，绝不改写要被执行的 SQL 文本（字符串字面量必须原样送达）；
 *   2. 无法判定的语句一律按写处理（宁可误拦，不可放过）；
 *   3. 字符串感知扫描：分号、注释符只要落在字面量里面，就不是语法记号，不得据此切分或剥离。
 *
 * 与引擎侧的两处刻意差异（都记在案）：
 *   - 引擎按 `statement.columns()` 在执行期细分读写；这里没有执行期信息，只能静态保守判定；
 *   - 这里额外把 `conn.read_only` 与「设置里未开启允许写」都算作阻断理由。
 */

/** 语句分类：read = 只读取；write = 可能改动数据库状态（含无法判定）。 */
export type SqlClassification = "read" | "write";

/** 写语句被阻断时抛出的错误码，与引擎侧同名，便于 UI 统一提示。 */
export const WRITE_BLOCKED = "WRITE_BLOCKED";

export interface CliWriteGuardOptions {
	/** 设置里是否显式开启「允许写语句」 */
	allowWrites?: boolean;
	/** 连接配置上的只读开关（优先级高于 allowWrites） */
	readOnly?: boolean;
}

/**
 * 读取类首关键字白名单。
 * 关键设计：**首关键字不在此白名单即判为写**（保守兜底），所以下面那张内嵌写关键字表
 * 只需要覆盖「首词看着像读、句子里却藏着写」的情况，不必穷举所有写语句。
 */
const READ_KEYWORDS = new Set(["SELECT", "VALUES", "EXPLAIN", "SHOW", "DESCRIBE", "DESC", "TABLE", "PRAGMA"]);

/** 内嵌写关键字（用于 WITH ... INSERT、EXPLAIN INSERT 这类"首词不是写"的语句）。 */
const EMBEDDED_WRITE_KEYWORDS = new Set([
	"INSERT", "UPDATE", "DELETE", "REPLACE", "MERGE", "UPSERT", "CREATE", "ALTER", "DROP", "TRUNCATE",
	"VACUUM", "REINDEX", "ATTACH", "DETACH", "BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "RENAME", "IMPORT",
]);

export interface SqlScanHandlers {
	/** 收到一段「代码」文本（已剔除注释） */
	onCode?: (text: string) => void;
	/** 收到一个字符串字面量（含引号） */
	onLiteral?: (text: string) => void;
}

/**
 * 字符串感知扫描：把 SQL 拆成「代码」与「字面量」两种片段。
 * 支持 `'...'`（含 `''` 转义）、`"..."`、反引号、`[...]`，以及行注释 `--` 与块注释（斜杠星号）。
 * 未闭合的字面量/注释会一直吞到结尾（保守：外侧不再产生新的语句边界）。
 */
export function scanSql(sql: string, handlers: SqlScanHandlers = {}): void {
	const text = String(sql ?? "");
	const length = text.length;
	let code = "";
	let index = 0;

	const flushCode = () => {
		if (code) {
			handlers.onCode?.(code);
			code = "";
		}
	};

	while (index < length) {
		const char = text[index] as string;
		const next = index + 1 < length ? text[index + 1] : "";

		if (char === "'" || char === '"' || char === "`") {
			const quote = char;
			flushCode();
			let literal = quote;
			index += 1;
			while (index < length) {
				const inner = text[index] as string;
				literal += inner;
				index += 1;
				if (inner === quote) {
					if (text[index] === quote) {
						literal += text[index] as string;
						index += 1;
						continue;
					}
					break;
				}
				if (inner === "\\" && index < length) {
					literal += text[index] as string;
					index += 1;
				}
			}
			handlers.onLiteral?.(literal);
			continue;
		}

		if (char === "[") {
			flushCode();
			let literal = "[";
			index += 1;
			while (index < length) {
				const inner = text[index] as string;
				literal += inner;
				index += 1;
				if (inner === "]") break;
			}
			handlers.onLiteral?.(literal);
			continue;
		}

		if (char === "-" && next === "-") {
			flushCode();
			index += 2;
			while (index < length && text[index] !== "\n") index += 1;
			code += " ";
			continue;
		}

		if (char === "/" && next === "*") {
			flushCode();
			index += 2;
			while (index < length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
			index += 2;
			code += " ";
			continue;
		}

		if (char === ";") {
			code += ";";
			flushCode();
			index += 1;
			continue;
		}

		code += char;
		index += 1;
	}

	flushCode();
}

/** 按语句切分（字符串感知；分号只作为语句边界）。 */
export function splitSqlStatements(sql: string): string[] {
	const statements: string[] = [];
	scanSql(sql, {
		onCode: (code) => {
			for (const piece of code.split(";")) statements.push(piece);
		},
		onLiteral: (literal) => {
			const last = statements.length - 1;
			if (last >= 0) statements[last] = `${statements[last]}${literal}`;
		},
	});
	return statements.map((statement) => statement.trim()).filter((statement) => statement.length > 0);
}

/** 去掉字符串与注释后的「代码骨架」，供关键字判定使用（不用于执行）。 */
function codeSkeleton(statement: string): string {
	let skeleton = "";
	scanSql(statement, {
		onCode: (code) => {
			skeleton += ` ${code}`;
		},
		onLiteral: () => {
			skeleton += " ?";
		},
	});
	return skeleton.replace(/\s+/g, " ").trim();
}

function keywordsOf(statement: string): string[] {
	return codeSkeleton(statement)
		.split(/[^A-Za-z0-9_$]+/)
		.map((token) => token.toUpperCase())
		.filter((token) => token.length > 0);
}

/**
 * 单语句分类（保守）。
 * - 首关键字不在读取白名单 → write（覆盖所有 DDL/DML/未知语句）；
 * - PRAGMA 带 `=`（赋值形态）→ write；
 * - 骨架里出现内嵌写关键字 → write（覆盖 `WITH ... INSERT`）；
 * - `SELECT ... INTO ...` → write。
 */
export function classifyStatement(statement: string): SqlClassification {
	const keywords = keywordsOf(statement);
	if (keywords.length === 0) return "write";
	const head = keywords[0] as string;
	const skeleton = codeSkeleton(statement);

	for (const keyword of keywords) {
		if (EMBEDDED_WRITE_KEYWORDS.has(keyword)) return "write";
	}
	if (head === "SELECT" && /\bINTO\b/i.test(skeleton)) return "write";
	if (head === "PRAGMA" && /PRAGMA\s+[A-Za-z0-9_$]+\s*=/i.test(skeleton)) return "write";
	if (READ_KEYWORDS.has(head)) return "read";
	return "write";
}

export interface SqlClassificationResult {
	classification: SqlClassification;
	statementCount: number;
	/** 被判为写的语句（供提示） */
	writeStatements: string[];
}

/** 整段 SQL 的分类：任一条语句可能写，整段就是写。 */
export function classifySql(sql: string): SqlClassificationResult {
	const statements = splitSqlStatements(sql);
	if (statements.length === 0) {
		return { classification: "write", statementCount: 0, writeStatements: [] };
	}
	const writeStatements = statements.filter((statement) => classifyStatement(statement) === "write");
	return {
		classification: writeStatements.length > 0 ? "write" : "read",
		statementCount: statements.length,
		writeStatements,
	};
}

function preview(statement: string, max = 60): string {
	const compact = statement.replace(/\s+/g, " ").trim();
	return compact.length > max ? `${compact.slice(0, max)}…` : compact;
}

export class WriteBlockedError extends Error {
	readonly code = WRITE_BLOCKED;
	readonly reason: string;
	readonly statements: string[];

	constructor(reason: string, statements: string[]) {
		const hits = statements.map(preview).join(" / ");
		super(
			reason === "read-only"
				? `写语句被阻断：连接已开启「只读」。命中的语句：${hits}`
				: `写语句被阻断：当前未开启「允许写语句」。请在右侧「设置」中开启后重试。命中的语句：${hits}`,
		);
		this.name = "WriteBlockedError";
		this.reason = reason;
		this.statements = statements;
	}
}

/**
 * CLI 回退路径的写闸门。
 * 抛 `WriteBlockedError`（code = WRITE_BLOCKED）；放行时返回分类结果，便于调用方记账。
 */
export function assertCliWriteAllowed(sql: string, options: CliWriteGuardOptions = {}): SqlClassificationResult {
	const result = classifySql(sql);
	if (result.classification === "read") return result;
	if (options.readOnly === true) throw new WriteBlockedError("read-only", result.writeStatements);
	if (options.allowWrites !== true) throw new WriteBlockedError("writes-disabled", result.writeStatements);
	return result;
}
