import { useCallback, useRef, useState } from "react";

/**
 * SQL 语法高亮 textarea — CSS overlay 方案，零依赖。
 * 底层一个透明 textarea（接收输入），上层一个 <pre><code>（渲染高亮）。
 * 两者尺寸/滚动同步。
 */

const KEYWORDS = new Set([
	"SELECT", "FROM", "WHERE", "INSERT", "INTO", "UPDATE", "DELETE",
	"CREATE", "DROP", "ALTER", "TABLE", "DATABASE", "SCHEMA", "INDEX",
	"VIEW", "TRIGGER", "FUNCTION", "PROCEDURE", "TRUNCATE",
	"GRANT", "REVOKE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL",
	"CROSS", "NATURAL", "GROUP", "BY", "ORDER", "LIMIT", "OFFSET",
	"UNION", "ALL", "DISTINCT", "CASE", "WHEN", "THEN", "ELSE", "END",
	"AS", "IN", "NOT", "AND", "OR", "IS", "NULL", "LIKE", "ILIKE",
	"BETWEEN", "EXISTS", "HAVING", "WITH", "RECURSIVE", "SET", "VALUES",
	"ON", "USING", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "UNIQUE",
	"CHECK", "DEFAULT", "AUTO_INCREMENT", "SERIAL", "BIGSERIAL",
	"TRUE", "FALSE", "EXPLAIN", "ANALYZE", "DESCRIBE", "DESC", "SHOW",
	"TABLES", "COLUMNS", "VARCHAR", "TEXT", "INT", "INTEGER", "BIGINT",
	"SMALLINT", "FLOAT", "REAL", "DOUBLE", "DECIMAL", "NUMERIC",
	"BOOLEAN", "BOOL", "DATE", "TIME", "TIMESTAMP", "DATETIME",
	"BLOB", "JSON", "JSONB", "ARRAY", "USE", "COMMIT", "ROLLBACK",
	"BEGIN", "TRANSACTION", "RETURNING", "LOCK", "FOR", "SHARE",
	"REPLACE", "IGNORE", "CASCADE", "RESTRICT", "TEMPORARY", "TEMP",
	"IF", "EXISTS", "UNIQUE", "INTEGER", "FLOAT", "BIGINT", "DOUBLE",
]);

type Segment = { type: string; text: string };

export function highlightSql(sql: string): string {
	const segments: Segment[] = [];
	let i = 0;
	let buf = "";

	function flush(type: string) {
		if (buf) { segments.push({ type, text: buf }); buf = ""; }
	}

	while (i < sql.length) {
		const ch = sql[i];

		// 行注释
		if (ch === "-" && sql[i + 1] === "-") {
			flush("text");
			buf += "--"; i += 2;
			while (i < sql.length && sql[i] !== "\n") { buf += sql[i]; i++; }
			flush("comment");
			continue;
		}

		// 块注释
		if (ch === "/" && sql[i + 1] === "*") {
			flush("text");
			buf += "/*"; i += 2;
			while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) { buf += sql[i]; i++; }
			if (i < sql.length) { buf += "*/"; i += 2; }
			flush("comment");
			continue;
		}

		// 字符串
		if (ch === "'") {
			flush("text");
			buf += ch; i++;
			while (i < sql.length) {
				buf += sql[i]; i++;
				if (sql[i - 1] === "'" && (sql[i] !== "'" || (sql[i] === "'" && i < sql.length && sql[i + 1] === "'"))) {
					if (sql[i - 1] === "'" && sql[i] === "'") { buf += sql[i]; i++; continue; }
					break;
				}
			}
			flush("string");
			continue;
		}

		// 双引号标识符
		if (ch === '"') {
			flush("text");
			buf += ch; i++;
			while (i < sql.length) {
				buf += sql[i]; i++;
				if (sql[i - 1] === '"' && sql[i] === '"') { buf += sql[i]; i++; continue; }
				if (sql[i - 1] === '"') break;
			}
			flush("ident");
			continue;
		}

		// 数字
		if (/\d/.test(ch)) {
			flush("text");
			buf += ch; i++;
			while (i < sql.length && /[\d.eE+\-]/.test(sql[i])) { buf += sql[i]; i++; }
			flush("number");
			continue;
		}

		// 标识符 / 关键字
		if (/[a-zA-Z_]/.test(ch)) {
			flush("text");
			buf += ch; i++;
			while (i < sql.length && /[a-zA-Z0-9_]/.test(sql[i])) { buf += sql[i]; i++; }
			const word = buf.toUpperCase();
			if (KEYWORDS.has(word)) flush("keyword");
			else flush("ident");
			continue;
		}

		// 标点 / 换行
		flush("text");
		buf += ch; i++;
		if (!/[a-zA-Z0-9_"'\-/*]/.test(ch)) flush("text");
	}
	flush("text");

	// 生成 HTML
	return segments.map((s) => {
		const esc = s.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		if (s.type === "keyword") return `<span class="kw">${esc}</span>`;
		if (s.type === "string") return `<span class="str">${esc}</span>`;
		if (s.type === "number") return `<span class="num">${esc}</span>`;
		if (s.type === "comment") return `<span class="cmt">${esc}</span>`;
		if (s.type === "ident") return `<span class="id">${esc}</span>`;
		return esc;
	}).join("");
}

interface SqlEditorProps {
	value: string;
	onChange: (v: string) => void;
	onRun: () => void;
	placeholder?: string;
	disabled?: boolean;
	height?: number | string;
}

export function SqlEditor({
	value, onChange, onRun, placeholder, disabled, height,
}: SqlEditorProps) {
	const taRef = useRef<HTMLTextAreaElement>(null);
	const preRef = useRef<HTMLPreElement>(null);
	const [scrollTop, setScrollTop] = useState(0);

	const handleScroll = useCallback(() => {
		if (!taRef.current) return;
		setScrollTop(taRef.current.scrollTop);
	}, []);

	const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			onRun();
		}
	}, [onRun]);

	const html = highlightSql(value) || '<span class="ph">' + (placeholder ?? "") + '</span>';

	return (
		<div className="dbx-editor-wrap" style={{ height: height ?? undefined, position: "relative" }}>
			<pre
				ref={preRef}
				className="dbx-editor-hl"
				style={{
					transform: `translateY(${-scrollTop}px)`,
				}}
				aria-hidden="true"
			>
				<code dangerouslySetInnerHTML={{ __html: html + "\n" }} />
			</pre>
			<textarea
				ref={taRef}
				className="dbx-editor"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onScroll={handleScroll}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				disabled={disabled}
				spellCheck={false}
			/>
		</div>
	);
}
