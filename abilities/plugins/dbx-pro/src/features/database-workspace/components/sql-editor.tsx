/**
 * SqlEditor — SQL 编辑器（CodeMirror 6，对标 dbx 桌面壳）。
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
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
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

const MONO_FONT = "'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace";

/** 暗色编辑器外观。 */
const editorTheme = EditorView.theme({
	"&": { backgroundColor: "transparent", color: "#d6d9e0", height: "100%" },
	".cm-content": {
		fontFamily: MONO_FONT,
		fontSize: "13px",
		lineHeight: "1.6",
		padding: "8px 0",
		caretColor: "#9ca3af",
	},
	".cm-scroller": { overflow: "auto", fontFamily: MONO_FONT },
	".cm-gutters": {
		backgroundColor: "transparent",
		borderRight: "1px solid var(--border)",
		color: "#525866",
		paddingLeft: "4px",
	},
	".cm-line": { padding: "0 12px" },
	"&.cm-focused": { outline: "none" },
	".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.035)" },
	".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.035)" },
	".cm-cursor, .cm-dropCursor": { borderLeftColor: "#9ca3af" },
	".cm-tooltip": {
		border: "1px solid var(--border)",
		backgroundColor: "#16181d",
		borderRadius: "6px",
	},
	".cm-tooltip-autocomplete ul li[aria-selected]": {
		backgroundColor: "rgba(96,165,250,0.2)",
		color: "#e5e7eb",
	},
});

/** SQL 语法高亮配色。 */
const sqlHighlight = syntaxHighlighting(
	HighlightStyle.define([
		{ tag: [tags.keyword, tags.operatorKeyword], color: "#c792ea" },
		{ tag: [tags.string, tags.special(tags.string)], color: "#c3e88d" },
		{ tag: tags.number, color: "#f78c6c" },
		{ tag: tags.comment, color: "#5b6172", fontStyle: "italic" },
		{ tag: tags.typeName, color: "#ffcb6b" },
		{ tag: tags.function(tags.variableName), color: "#82aaff" },
		{ tag: tags.operator, color: "#89ddff" },
		{ tag: tags.punctuation, color: "#8b93a7" },
	]),
);

function dialectFor(dbType: string | undefined) {
	const type = String(dbType ?? "").toLowerCase();
	if (/postgres|(^|\b)pg|redhift/.test(type)) return PostgreSQL;
	if (/mysql|maria|tidb|starrocks|doris/.test(type)) return MySQL;
	if (/mssql|sqlserver/.test(type)) return MSSQL;
	if (/sqlite/.test(type)) return SQLite;
	return undefined;
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

	const setSql = useCallback(
		(next: string) => {
			if (activeTabId) dispatch({ type: "updateTab", id: activeTabId, patch: { sql: next } });
		},
		[activeTabId, dispatch],
	);

	const runCurrent = useCallback(
		(view: EditorView) => {
			if (!activeTabId || activeTabRunning) return;
			const { from, to } = view.state.selection.main;
			let selected: string | undefined;
			if (to > from) {
				const fragment = view.state.doc.sliceString(from, to);
				if (fragment.trim()) selected = fragment;
			}
			void runTabSql(activeTabId, selected);
		},
		[activeTabId, activeTabRunning, runTabSql],
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
						if (update.docChanged) setSql(update.state.doc.toString());
					}),
					runKeymap,
					keymap.of([...defaultKeymap, ...completionKeymap]),
					editorTheme,
					sqlHighlight,
				],
			}),
			parent: hostRef.current,
		});
		viewRef.current = view;
		setEditorReady(true);
		return () => {
			view.destroy();
			viewRef.current = null;
			setEditorReady(false);
		};
		// activeTab.id：切 tab 重建；sql 不进依赖（编辑器自持 doc，避免输入时重建）
	}, [activeTab?.id, activeConn?.db_type, runCurrent, setSql]);

	function tidy() {
		if (!viewRef.current || !activeTab) return;
		// 轻量整理：折叠 3+ 连续空行为 2 行
		const next = viewRef.current.state.doc.toString().replace(/\n{3,}/g, "\n\n").trim();
		viewRef.current.dispatch({
			changes: { from: 0, to: viewRef.current.state.doc.length, insert: next },
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

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			{/* 工具栏 */}
			<div className="dbx-chrome flex h-8 shrink-0 items-center gap-1 px-2">
				<button
					type="button"
					onClick={() => viewRef.current && runCurrent(viewRef.current)}
					disabled={running || !hasConn}
					title="执行（⌘/Ctrl + Enter）"
					className="flex h-6 items-center gap-1 rounded bg-emerald-600/90 px-2 text-[11px] font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-[var(--dbx-surface-2)] disabled:text-muted-foreground"
				>
					{running ? <span className="icon-[lucide--loader] h-3 w-3 animate-spin" /> : <span className="icon-[lucide--play] h-3 w-3" />}
					{running ? "执行中" : "执行"}
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
					{!hasConn && <span className="ml-1 rounded bg-red-500/10 px-1 text-red-400">请先选中连接</span>}
				</div>
			</div>

			{/* CodeMirror 挂载点：按 tab.id 重建 */}
			<div className="relative min-h-0 flex-1">
				<div key={activeTab?.id} ref={hostRef} className="absolute inset-0 overflow-hidden" />
				{!editorReady && (
					<div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground/70">
						<span className="icon-[lucide--loader] mr-2 h-3 w-3 animate-spin" />
						加载编辑器…
					</div>
				)}
				{running && (
					<div className="pointer-events-none absolute right-3 top-3 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-black">
						执行中…
					</div>
				)}
			</div>
		</div>
	);
}
