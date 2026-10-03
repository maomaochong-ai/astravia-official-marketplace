import { useCallback, useRef, useState } from "react";

/**
 * SQL 语法高亮编辑器 — CSS overlay 实现，零运行时依赖。
 *
 * 底层透明 textarea 接收输入，上层 <pre><code> 渲染高亮。
 * 两者尺寸/滚动同步。支持关键词/字符串/数字/注释四类着色。
 */

const KEYWORDS = new Set([
	"SELECT", "FROM", "WHERE", "INSERT", "INTO", "UPDATE", "DELETE",
	"CREATE", "DROP", "ALTER", "TABLE", "SCHEMA", "INDEX", "VIEW",
	"TRIGGER", "FUNCTION", "TRUNCATE", "GRANT", "REVOKE",
	"JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS",
	"GROUP", "BY", "ORDER", "LIMIT", "OFFSET", "UNION", "ALL", "DISTINCT",
	"CASE", "WHEN", "THEN", "ELSE", "END", "AS", "IN", "NOT", "AND", "OR",
	"IS", "NULL", "LIKE", "BETWEEN", "EXISTS", "HAVING", "WITH", "RECURSIVE",
	"SET", "VALUES", "ON", "USING", "PRIMARY", "KEY", "FOREIGN", "REFERENCES",
	"UNIQUE", "CHECK", "DEFAULT", "AUTO_INCREMENT", "TRUE", "FALSE",
	"EXPLAIN", "ANALYZE", "DESCRIBE", "DESC", "SHOW", "TABLES", "COLUMNS",
	"VARCHAR", "TEXT", "INT", "INTEGER", "BIGINT", "SMALLINT",
	"FLOAT", "REAL", "DOUBLE", "DECIMAL", "NUMERIC", "BOOLEAN",
	"DATE", "TIME", "TIMESTAMP", "DATETIME", "BLOB", "JSON", "JSONB",
	"ARRAY", "USE", "COMMIT", "ROLLBACK", "BEGIN", "TRANSACTION",
	"RETURNING", "LOCK", "FOR", "SHARE", "REPLACE", "IGNORE",
	"CASCADE", "RESTRICT", "TEMPORARY", "TEMP", "IF", "EXISTS",
	"INT", "FLOAT", "BIGINT", "DOUBLE", "INTEGER",
]);

type SegKind = "kw" | "str" | "num" | "cmt" | "id" | "text";

function highlight(sql: string): string {
	const segs: { k: SegKind; t: string }[] = [];
	let buf = "";
	let i = 0;

	function flush(k: SegKind) {
		if (buf) { segs.push({ k, t: buf }); buf = ""; }
	}

	while (i < sql.length) {
		const ch = sql[i];

		if (ch === "-" && sql[i + 1] === "-") {
			flush("text"); buf += "--"; i += 2;
			while (i < sql.length && sql[i] !== "\n") { buf += sql[i]; i++; }
			flush("cmt");
			continue;
		}

		if (ch === "/" && sql[i + 1] === "*") {
			flush("text"); buf += "/*"; i += 2;
			while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) { buf += sql[i]; i++; }
			if (i < sql.length) { buf += "*/"; i += 2; }
			flush("cmt");
			continue;
		}

		if (ch === "'") {
			flush("text"); buf += ch; i++;
			while (i < sql.length) {
				buf += sql[i]; i++;
				if (sql[i - 1] === "'") {
					if (sql[i] === "'" && i < sql.length) { buf += sql[i]; i++; continue; }
					break;
				}
			}
			flush("str");
			continue;
		}

		if (ch === '"') {
			flush("text"); buf += ch; i++;
			while (i < sql.length) {
				buf += sql[i]; i++;
				if (sql[i - 1] === '"' && sql[i] === '"') { buf += sql[i]; i++; continue; }
				if (sql[i - 1] === '"') break;
			}
			flush("id");
			continue;
		}

		if (/\d/.test(ch)) {
			flush("text"); buf += ch; i++;
			while (i < sql.length && /[\d.eE+\-]/.test(sql[i])) { buf += sql[i]; i++; }
			flush("num");
			continue;
		}

		if (/[a-zA-Z_]/.test(ch)) {
			flush("text"); buf += ch; i++;
			while (i < sql.length && /[a-zA-Z0-9_]/.test(sql[i])) { buf += sql[i]; i++; }
			flush(KEYWORDS.has(buf.toUpperCase()) ? "kw" : "id");
			continue;
		}

		flush("text"); buf += ch; i++;
		flush("text");
	}
	flush("text");

	return segs.map((s) => {
		const esc = s.t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		if (s.k === "kw") return `<span class="dbx-hl-kw">${esc}</span>`;
		if (s.k === "str") return `<span class="dbx-hl-str">${esc}</span>`;
		if (s.k === "num") return `<span class="dbx-hl-num">${esc}</span>`;
		if (s.k === "cmt") return `<span class="dbx-hl-cmt">${esc}</span>`;
		if (s.k === "id") return `<span class="dbx-hl-id">${esc}</span>`;
		return esc;
	}).join("");
}

interface Props {
	value: string;
	onChange: (v: string) => void;
	onRun: () => void;
	placeholder?: string;
	disabled?: boolean;
	/** 查询执行中：阻断重复提交，并在右上角提示。 */
	busy?: boolean;
}

export function SqlEditor({ value, onChange, onRun, placeholder, disabled, busy }: Props) {
	const taRef = useRef<HTMLTextAreaElement>(null);
	const preRef = useRef<HTMLPreElement>(null);
	const [scrollTop, setScrollTop] = useState(0);

	const onScroll = useCallback(() => {
		if (!taRef.current) return;
		setScrollTop(taRef.current.scrollTop);
	}, []);

	const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			if (!busy) onRun();
		}
	}, [onRun, busy]);

	const html = highlight(value);

	return (
		<div className="dbx-editor-wrap relative">
			{busy ? (
				<span className="absolute right-2 top-2 z-10 rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground">执行中…</span>
			) : null}
			<pre
				ref={preRef}
				className="dbx-editor-hl"
				style={{ transform: `translateY(${-scrollTop}px)` }}
				aria-hidden="true"
			>
				<code dangerouslySetInnerHTML={{ __html: html + "\n" }} />
			</pre>
			<textarea
				ref={taRef}
				className="dbx-editor"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onScroll={onScroll}
				onKeyDown={onKeyDown}
				placeholder={placeholder}
				disabled={disabled}
				spellCheck={false}
			/>
		</div>
	);
}

export { highlight as highlightSql };
