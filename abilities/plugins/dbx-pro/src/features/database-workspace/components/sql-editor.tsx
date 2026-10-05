/**
 * SqlEditor — SQL 编辑器（CodeMirror 6）。
 *
 * - 按连接类型选择 SQL dialect（PostgreSQL/MySQL/MSSQL/SQLite）
 * - 暗色语法高亮、行号、括号匹配 / 自动闭合、自动补全（关键字）
 * - ⌘/Ctrl+Enter：有选区执行选区，否则执行全部
 * - 工具栏：执行、整理、清空、连接状态
 *
 * 编辑器按 tab 实例化（host 以 tab.id 为 key），切 tab 时以该 tab 的 SQL 重建。
 */

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import {
	EditorView,
	keymap,
	lineNumbers,
	highlightActiveLine,
	highlightActiveLineGutter,
} from "@codemirror/view";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle } from "@codemirror/language";
import {
	bracketMatching,
	indentOnInput,
	syntaxHighlighting,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { autocompletion, closeBrackets, completionKeymap } from "@codemirror/autocomplete";
import { MSSQL, MySQL, PostgreSQL, SQLite, sql } from "@codemirror/lang-sql";
import { useWorkbench } from "../hooks/use-workbench";
import { useDetectedTheme } from "../../../shared/hooks/use-detected-theme";
import {
	formatDialect,
	mysql,
	postgresql,
	sql as standardSql,
	sqlite,
	transactsql,
	type DialectOptions,
} from "sql-formatter";

const MONO_FONT = "'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace";

/**
 * 编辑器外观：颜色全部走 --dbx-cm-* 变量，明 / 暗两套取值在 sql-editor.css
 * 按插件根 data-dbx-theme 切换，宿主强制主题时不会出现浅底浅字。
 */
const editorTheme = EditorView.theme({
	"&": { backgroundColor: "transparent", color: "var(--dbx-cm-text)", height: "100%" },
	".cm-content": {
		fontFamily: MONO_FONT,
		fontSize: "13px",
		lineHeight: "1.6",
		padding: "8px 12px 8px 8px",
		caretColor: "var(--dbx-cm-caret)",
	},
	".cm-scroller": { overflow: "auto", fontFamily: MONO_FONT },
	".cm-gutters": {
		backgroundColor: "transparent",
		borderRight: "1px solid var(--dbx-cm-gutter-border)",
		color: "var(--dbx-cm-gutter)",
		paddingLeft: "8px",
		paddingRight: "8px",
	},
	".cm-line": { padding: "0 4px" },
	"&.cm-focused": { outline: "none" },
	".cm-activeLine": { backgroundColor: "var(--dbx-cm-active-line)" },
	".cm-activeLineGutter": { backgroundColor: "var(--dbx-cm-active-line)" },
	".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--dbx-cm-caret)" },
	".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
		backgroundColor: "var(--dbx-cm-selection) !important",
	},
	".cm-tooltip": {
		border: "1px solid var(--dbx-cm-tooltip-border)",
		backgroundColor: "var(--dbx-cm-tooltip-bg)",
		borderRadius: "6px",
		color: "var(--dbx-cm-text)",
	},
	".cm-tooltip-autocomplete ul li[aria-selected]": {
		backgroundColor: "var(--dbx-cm-tooltip-selected)",
		color: "var(--dbx-cm-text)",
	},
});

/** SQL 语法高亮：颜色同样走变量，明 / 暗在 CSS 侧切换。 */
const sqlHighlight = syntaxHighlighting(
	HighlightStyle.define([
		{ tag: [tags.keyword, tags.operatorKeyword], color: "var(--dbx-cm-keyword)" },
		{ tag: [tags.string, tags.special(tags.string)], color: "var(--dbx-cm-string)" },
		{ tag: tags.number, color: "var(--dbx-cm-number)" },
		{ tag: tags.comment, color: "var(--dbx-cm-comment)", fontStyle: "italic" },
		{ tag: tags.typeName, color: "var(--dbx-cm-type)" },
		{ tag: tags.function(tags.variableName), color: "var(--dbx-cm-function)" },
		{ tag: tags.operator, color: "var(--dbx-cm-operator)" },
		{ tag: tags.punctuation, color: "var(--dbx-cm-punctuation)" },
	]),
);

function dialectFor(dbType: string | undefined) {
	const type = String(dbType ?? "").toLowerCase();
	if (/postgres|(^|\b)pg|redshift/.test(type)) return PostgreSQL;
	if (/mysql|maria|tidy|starrocks|doris/.test(type)) return MySQL;
	if (/mssql|sqlserver/.test(type)) return MSSQL;
	if (/sqlite/.test(type)) return SQLite;
	return undefined;
}

/** dbType → sql-formatter 方言对象（只引用所需方言，其余被 tree-shake）。 */
function formatterDialect(dbType: string | undefined): DialectOptions {
	const type = String(dbType ?? "").toLowerCase();
	if (/postgres|(^|\b)pg|redshift/.test(type)) return postgresql;
	if (/mysql|maria|tidb|starrocks|doris/.test(type)) return mysql;
	if (/mssql|sqlserver/.test(type)) return transactsql;
	if (/sqlite/.test(type)) return sqlite;
	return standardSql;
}

export function SqlEditor(): JSX.Element {
	const { state, dispatch, runTabSql } = useWorkbench();
	const hostRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const [editorReady, setEditorReady] = useState(false);

	const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0];
	const activeConn = state.connections.find((c) => c.name === activeTab?.connectionName);
	// 用稳定的 tab id / running 作为回调依赖：若依赖整个 activeTab 对象，每次输入
	// 更新 sql 都会产生新对象，进而让 EditorView effect 反复重建、无法连续输入。
	const activeTabId = activeTab?.id;
	const activeTabRunning = activeTab?.isRunning ?? false;

	// 关键：runTabSql 由 provider 每次 render 都生成新闭包，一旦进入 deps 会导致
	// EditorView 被反复销毁重建（无法输入）。用 ref 持最新引用，回调保持稳定身份。
	const runTabSqlRef = useRef(runTabSql);
	runTabSqlRef.current = runTabSql;
	const activeTabIdRef = useRef(activeTabId);
	activeTabIdRef.current = activeTabId;
	const activeTabRunningRef = useRef(activeTabRunning);
	activeTabRunningRef.current = activeTabRunning;

	const setSql = useCallback(
		(next: string) => {
			if (activeTabId) dispatch({ type: "updateTab", id: activeTabId, patch: { sql: next } });
		},
		[activeTabId, dispatch],
	);
	const setSqlRef = useRef(setSql);
	setSqlRef.current = setSql;

	const runCurrent = useCallback(
		(view: EditorView) => {
			const tabId = activeTabIdRef.current;
			if (!tabId || activeTabRunningRef.current) return;
			const { from, to } = view.state.selection.main;
			let selected: string | undefined;
			if (to > from) {
				const fragment = view.state.doc.sliceString(from, to);
				if (fragment.trim()) selected = fragment;
			}
			void runTabSqlRef.current(tabId, selected);
		},
		[],
	);

	// 按 activeTab 构建 EditorView。
	useEffect(() => {
		if (!hostRef.current || !activeTab) return;
		const runKeymap: Extension = keymap.of([
			{ key: "Mod-Enter", run: (view) => { runCurrent(view); return true; } },
			indentWithTab,
		]);

		const view = new EditorView({
			state: EditorState.create({
				doc: activeTab.sql,
				extensions: [
					lineNumbers(),
					highlightActiveLineGutter(),
					sql({
						dialect: dialectFor(activeConn?.db_type),
						upperCaseKeywords: true,
					}),
					indentOnInput(),
					bracketMatching(),
					closeBrackets(),
					autocompletion(),
					highlightActiveLine(),
					EditorView.lineWrapping,
					EditorState.allowMultipleSelections.of(true),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) setSqlRef.current(update.state.doc.toString());
				}),
					runKeymap,
					keymap.of([...defaultKeymap, ...completionKeymap, ...historyKeymap]),
					history(),
					editorTheme,
					sqlHighlight,
				],
			}),
			parent: hostRef.current,
		});
		viewRef.current = view;
		// 新 tab 创建后自动聚焦，允许用户直接输入
		view.focus();
		setEditorReady(true);
		return () => {
			view.destroy();
			viewRef.current = null;
			setEditorReady(false);
		};
		// activeTab.id：切 tab 重建；sql 不进依赖（编辑器自持 doc，避免输入时重建）
	}, [activeTab?.id, activeConn?.db_type, runCurrent]);

	/** 整理：用 sql-formatter 格式化当前 SQL。 */
	function tidy() {
		const view = viewRef.current;
		if (!view || !activeTab) return;
		const source = view.state.doc.toString();
		if (!source.trim()) return;
		let formatted: string;
		try {
			formatted = formatDialect(source, {
				dialect: formatterDialect(activeConn?.db_type),
				keywordCase: "upper",
				tabWidth: 2,
			});
		} catch {
			// 方言解析失败（含专有语法 / 存储过程等）：退回轻量整理，不把原始内容弄丢。
			formatted = source.replace(/\n{3,}/g, "\n\n").trim();
		}
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: formatted },
		});
	}

	function clearEditor() {
		if (!viewRef.current) return;
		viewRef.current.dispatch({
			changes: { from: 0, to: viewRef.current.state.doc.length, insert: "" },
		});
	}

	const running = activeTab?.isRunning ?? false;
	const hasConn = Boolean(activeTab?.connectionName);
	const theme = useDetectedTheme();

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			{/* 工具栏 */}
			<div className="dbx-chrome flex h-8 shrink-0 items-center gap-1 px-2">
				<button
					type="button"
					onClick={() => viewRef.current && runCurrent(viewRef.current)}
					disabled={running || !hasConn}
					title="执行（⌘/Ctrl + Enter）"
					className="dbx-cta"
					style={{ height: 24, padding: "0 8px" }}
				>
					<span className="icon-[lucide--play] h-3 w-3" />
					执行
				</button>
				<div className="mx-1 h-4 w-px bg-[var(--dbx-surface-2)]" />
				<button
					type="button"
					onClick={tidy}
					title="整理 SQL"
					className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-foreground/70 hover:bg-[var(--dbx-hover)] hover:text-foreground"
				>
					<span className="icon-[lucide--list-filter] h-3 w-3" />
					整理
				</button>
				<button
					type="button"
					onClick={clearEditor}
					title="清空"
					className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-foreground/70 hover:bg-[var(--dbx-hover)] hover:text-foreground"
				>
					<span className="icon-[lucide--trash-2] h-3 w-3" />
					清空
				</button>
				<div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
					<span className="icon-[lucide--database] h-2.5 w-2.5" />
					{activeTab?.connectionName ?? "未绑定"}
					{!hasConn && <span className="ml-1 rounded px-1" style={{ color: "var(--destructive)", backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)" }}>请先选中连接</span>}
				</div>
			</div>

			{/* CodeMirror 挂载点：按 tab.id 重建，overflow-hidden 防止光标/tooltip 溢出 */}
			<div
				data-dbx-theme={theme}
				className="dbx-sql-theme relative min-h-0 flex-1 overflow-hidden"
			>
				<div key={activeTab?.id} ref={hostRef} className="absolute inset-0" />
				{!editorReady && (
					<div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground/70">
						<span className="icon-[lucide--loader] mr-2 h-3 w-3 animate-spin" />
						加载编辑器…
					</div>
				)}
			</div>
		</div>
	);
}
