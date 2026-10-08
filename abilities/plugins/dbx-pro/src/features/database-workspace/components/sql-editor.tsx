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
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import {
	EditorView,
	keymap,
	lineNumbers,
	highlightActiveLine,
	highlightActiveLineGutter,
} from "@codemirror/view";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { foldAll, unfoldAll } from "@codemirror/language";
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
import { getFs, getUi } from "../../../runtime-contract";
import {
	formatDialect,
	mysql,
	postgresql,
	sql as standardSql,
	sqlite,
	transactsql,
	type DialectOptions,
} from "sql-formatter";
import { resolveExecutableSql } from "../services/executable-sql";

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
		fontFamily: MONO_FONT,
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
		fontFamily: MONO_FONT,
	},
	".cm-tooltip-autocomplete ul li[aria-selected]": {
		backgroundColor: "var(--dbx-cm-tooltip-selected)",
		color: "var(--dbx-cm-text)",
	},
});

/** SQL 语法高亮配色 —— 明 / 暗两套具体颜色。
 *  注意：CodeMirror 的 HighlightStyle 由 style-mod 注入全局样式表，
 *  里面写 var() 在部分宿主挂载方式下取不到变量导致整屏无高亮，
 *  因此 token 颜色用具体色值，按检测到的主题选择对应扩展；
 *  编辑器外壳（背景/行号/选区）仍可用 CSS 变量。 */
function sqlHighlightColors(p: {
	keyword: string; string_: string; number: string; comment: string;
	typeName: string; fn: string; operator: string; punctuation: string;
}) {
	return syntaxHighlighting(
		HighlightStyle.define([
			{ tag: [tags.keyword, tags.operatorKeyword], color: p.keyword },
			{ tag: [tags.string, tags.special(tags.string)], color: p.string_ },
			{ tag: tags.number, color: p.number },
			{ tag: tags.comment, color: p.comment, fontStyle: "italic" },
			{ tag: tags.typeName, color: p.typeName },
			{ tag: tags.function(tags.variableName), color: p.fn },
			{ tag: tags.operator, color: p.operator },
			{ tag: tags.punctuation, color: p.punctuation },
		]),
	);
}

const sqlHighlightDark = sqlHighlightColors({
	keyword: "#c792ea",
	string_: "#c3e88d",
	number: "#f78c6c",
	comment: "#6b7280",
	typeName: "#ffcb6b",
	fn: "#82aaff",
	operator: "#89ddff",
	punctuation: "#9aa3b2",
});

const sqlHighlightLight = sqlHighlightColors({
	// One Light 取向：白底上对比足够、饱和度克制
	keyword: "#a626a4",
	string_: "#50a14f",
	number: "#b76b01",
	comment: "#a0a1a7",
	typeName: "#c18401",
	fn: "#4078f2",
	operator: "#383a42",
	punctuation: "#5c6370",
});

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
	const { state, dispatch, runTabSql, cancelExecution } = useWorkbench();
	const hostRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const wrapCompartmentRef = useRef(new Compartment());
	const [editorReady, setEditorReady] = useState(false);
	const [wordWrap, setWordWrap] = useState(true);
	/** 选区字符数：> 0 时执行 / 计划只跑选中的那段（工具栏就地提示，不用猜）。 */
	const [selectionLength, setSelectionLength] = useState(0);

	const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0];
	const activeConn = state.connections.find((c) => c.name === activeTab?.connectionName);
	// 用稳定的 tab id / running 作为回调依赖：若依赖整个 activeTab 对象，每次输入
	// 更新 sql 都会产生新对象，进而让 EditorView effect 反复重建、无法连续输入。
	const activeTabId = activeTab?.id;
	const activeTabRunning = activeTab?.isRunning ?? false;

	// 明 / 暗主题（检测插件根背景亮度）：决定高亮扩展与 data-dbx-theme。
	const theme = useDetectedTheme();
	const highlightExt = theme === "light" ? sqlHighlightLight : sqlHighlightDark;

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

	const runCurrent = useCallback((view: EditorView) => {
		const tabId = activeTabIdRef.current;
		if (!tabId || activeTabRunningRef.current) return;
		// 有选区只执行选区：片段就地取，不回写 tab.sql（不污染用户原文）。
		const selected = resolveExecutableSql(view.state.doc, view.state.selection.main);
		void runTabSqlRef.current(tabId, selected, undefined, { mode: "server" });
	}, []);

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
					wrapCompartmentRef.current.of(EditorView.lineWrapping),
					EditorState.allowMultipleSelections.of(true),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) setSqlRef.current(update.state.doc.toString());
					if (update.selectionSet || update.docChanged) setSelectionLength(update.state.selection.main.to - update.state.selection.main.from);
				}),
					runKeymap,
					keymap.of([...defaultKeymap, ...completionKeymap, ...historyKeymap]),
					history(),
				editorTheme,
				highlightExt,
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
	// activeTab.id：切 tab 重建；sql 不进依赖（编辑器自持 doc，避免输入时重建）；
	// theme：宿主切换明 / 暗主题时重建以更换高亮配色。
}, [activeTab?.id, activeConn?.db_type, runCurrent, highlightExt]);

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

	/** 停止执行：cancelExecution 把 tab.isRunning 置 false，引擎层后续自行复位。 */
	function handleStop() {
		if (!activeTabId) return;
		cancelExecution(activeTabId);
	}

	/** Execute in current tab */
	function handleExecute() {
		if (!viewRef.current || !activeTabId) return;
		if (running) { handleStop(); return; }
		runCurrent(viewRef.current);
	}

	/** Execute selection/full SQL in a NEW result tab */
	function handleExecuteInNew() {
		if (!viewRef.current || !activeTab || running || !hasConn) return;
		const override = resolveExecutableSql(viewRef.current.state.doc, viewRef.current.state.selection.main);
		void runTabSql(activeTab.id, override, activeTab.connectionName ?? undefined, { mode: "server" });
	}

	/** Save SQL to file via宿主 fs API */
	async function handleSave() {
		if (!activeTab || !activeTab.sql.trim()) return;
		const fs = getFs();
		if (!fs) return;
		try {
			const path = await fs.saveAs(`${activeTab.label ?? "query"}.sql`, activeTab.sql, "utf8", {
				title: "保存 SQL",
				filters: [{ name: "SQL", extensions: ["sql"] }],
			});
			const ui = getUi();
			if (path && ui?.showToast) {
				await ui.showToast({ message: `SQL 已保存到 ${path}`, variant: "success" });
			}
		} catch {
			// 保存失败静默处理
		}
	}

	/** EXPLAIN：用 EXPLAIN <sql> 包装然后执行。如果有选区则执行选区的 EXPLAIN。 */
	function handleExplain() {
		if (!viewRef.current || !activeTabId || running) return;
		const selected = resolveExecutableSql(viewRef.current.state.doc, viewRef.current.state.selection.main);
		const snippet = (selected ?? viewRef.current.state.doc.toString()).trim();
		if (!snippet) return;
		void runTabSql(activeTabId, `EXPLAIN ${snippet}`, activeTab.connectionName ?? undefined, { mode: "server" });
	}

	/** Fold all / Unfold all code blocks */
	function handleFoldAll() {
		const v = viewRef.current; if (!v) return;
		foldAll(v);
	}
	function handleUnfoldAll() {
		const v = viewRef.current; if (!v) return;
		unfoldAll(v);
	}

	/** Word wrap toggle — 通过 Compartment 动态 reconfigure */
	function toggleWordWrap() {
		setWordWrap((prev) => !prev);
	}
	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;
		view.dispatch({
			effects: wrapCompartmentRef.current.reconfigure(
				wordWrap ? EditorView.lineWrapping : [],
			),
		});
	}, [wordWrap]);

	return (
		<div data-dbx-theme={theme} className="dbx-sql-theme flex min-h-0 flex-1 flex-col bg-background">
			{/* 工具栏 —— flex-nowrap + overflow-x-auto：宽度不够时横向滚动，不挤压按钮 */}
			<div className="dbx-chrome flex h-8 shrink-0 items-center gap-1 overflow-x-auto whitespace-nowrap px-2">
				{/* Execute / Stop toggle */}
				<button
					type="button"
					onClick={handleExecute}
					disabled={!running && !hasConn}
					title={running ? "停止执行" : selectionLength > 0 ? "执行选中片段（⌘/Ctrl + Enter）" : "执行（⌘/Ctrl + Enter）"}
					className="dbx-cta"
					style={running ? { backgroundColor: "rgb(220 38 38)", borderColor: "rgb(220 38 38)" } : { height: 24, padding: "0 8px" }}
				>
					<span className={running ? "icon-[lucide--square] h-3 w-3 fill-current" : "icon-[lucide--play] h-3 w-3"} />
					{running ? "停止" : "执行"}
				</button>
				{/* Execute in new tab */}
				<button
					type="button"
					onClick={handleExecuteInNew}
					disabled={running || !hasConn}
					title={selectionLength > 0 ? "在新结果标签页执行选中片段" : "在新结果标签页执行"}
					className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-violet-600 hover:bg-violet-500/10 hover:text-violet-700 disabled:opacity-30 dark:text-violet-300 dark:hover:text-violet-200"
				>
					<span className="icon-[lucide--square-play] h-3 w-3" />
					新标签
				</button>

				<div className="mx-1 h-4 w-px bg-[var(--dbx-surface-2)]" />

				{/* EXPLAIN */}
				<button
					type="button"
					onClick={handleExplain}
					disabled={running || !hasConn}
					title="执行 EXPLAIN 计划"
					className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-teal-600 hover:bg-teal-500/10 hover:text-teal-700 disabled:opacity-30 dark:text-teal-300 dark:hover:text-teal-200"
				>
					<span className="icon-[lucide--git-branch] h-3 w-3" />
					计划
				</button>
				{/* Fold all */}
				<button
					type="button"
					onClick={handleFoldAll}
					title="折叠全部"
					className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-orange-600 hover:bg-orange-500/10 hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-200"
				>
					<span className="icon-[lucide--fold-vertical] h-3 w-3" />
				</button>
				{/* Unfold all */}
				<button
					type="button"
					onClick={handleUnfoldAll}
					title="展开全部"
					className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-orange-600 hover:bg-orange-500/10 hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-200"
				>
					<span className="icon-[lucide--unfold-vertical] h-3 w-3" />
				</button>
				{/* Word wrap toggle */}
				<button
					type="button"
					onClick={toggleWordWrap}
					title={wordWrap ? "关闭自动换行" : "开启自动换行"}
					className={`flex h-6 items-center gap-1 rounded px-1.5 text-[11px] ${wordWrap ? "text-green-600 dark:text-green-300" : "text-muted-foreground"} hover:bg-green-500/10 hover:text-green-700 dark:hover:text-green-200`}
				>
					<span className="icon-[lucide--wrap-text] h-3 w-3" />
				</button>

				<div className="mx-1 h-4 w-px bg-[var(--dbx-surface-2)]" />

				{/* Format (tidy) */}
				<button
					type="button"
					onClick={tidy}
					title="格式化 SQL"
					className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200"
				>
					<span className="icon-[lucide--align-left] h-3 w-3" />
					整理
				</button>
				{/* Clear */}
				<button
					type="button"
					onClick={clearEditor}
					title="清空"
					className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-foreground/70 hover:bg-[var(--dbx-hover)] hover:text-foreground"
				>
					<span className="icon-[lucide--trash-2] h-3 w-3" />
					清空
				</button>
				{/* Save SQL */}
				<button
					type="button"
					onClick={handleSave}
					title="保存 SQL 到文件"
					className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-blue-600 hover:bg-blue-500/10 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
				>
					<span className="icon-[lucide--save] h-3 w-3" />
					保存
				</button>

				<div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
					{selectionLength > 0 && (
						<span className="rounded bg-emerald-500/10 px-1 text-emerald-600 dark:text-emerald-300">
							已选中 {selectionLength} 字符 · 执行将只运行选区
						</span>
					)}
					<span className="icon-[lucide--database] h-2.5 w-2.5" />
					{activeTab?.connectionName ?? "未绑定"}
					{!hasConn && <span className="ml-1 rounded px-1" style={{ color: "var(--destructive)", backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)" }}>请先选中连接</span>}
				</div>
			</div>

			{/* CodeMirror 挂载点：按 tab.id 重建，overflow-hidden 防止光标/tooltip 溢出 */}
			<div className="relative min-h-0 flex-1 overflow-hidden">
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
