/**
 * SqlEditor — SQL 编辑器。
 *
 * 沿用已验证的透明 textarea + CSS overlay 语法高亮方案，零运行时依赖。
 * 额外支持：Tab 键缩进 / Shift+Tab 反缩进、⌘/Ctrl+Enter 执行、
 *          工具栏（运行、格式化、清空）。
 *
 * 绑定 workbench-context：自动读写当前活动 tab 的 sql。
 */

import { useCallback, useRef, useState, type JSX } from "react";
import { useWorkbench } from "./workbench-context";
import { highlightSql } from "../../../shared/utils/sql-highlight";

export function SqlEditor(): JSX.Element {
	const { state, dispatch, runTabSql } = useWorkbench();
	const taRef = useRef<HTMLTextAreaElement>(null);
	const preRef = useRef<HTMLPreElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [scrollLeft, setScrollLeft] = useState(0);

	const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0];
	const sql = activeTab?.sql ?? "";

	function setSql(next: string) {
		if (!activeTab) return;
		dispatch({ type: "updateTab", id: activeTab.id, patch: { sql: next } });
	}

	const onScroll = useCallback(() => {
		if (!taRef.current) return;
		setScrollTop(taRef.current.scrollTop);
		setScrollLeft(taRef.current.scrollLeft);
	}, []);

	const runCurrent = useCallback(() => {
		if (!activeTab) return;
		void runTabSql(activeTab.id);
	}, [activeTab, runTabSql]);

	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			// ⌘/Ctrl + Enter → 执行
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				if (!activeTab?.isRunning) runCurrent();
				return;
			}
			// Tab → 缩进
			if (e.key === "Tab") {
				e.preventDefault();
				const ta = e.currentTarget;
				const start = ta.selectionStart;
				const end = ta.selectionEnd;
				const value = ta.value;
				if (e.shiftKey) {
					// 反缩进
					let lineStart = start;
					while (lineStart > 0 && value[lineStart - 1] !== "\n") lineStart--;
					const before = value.slice(0, lineStart);
					const selected = value.slice(lineStart, end);
					const after = value.slice(end);
					const dedented = selected
						.split("\n")
						.map((line) => (line.startsWith("\t") ? line.slice(1) : line.replace(/^ {1,4}/, "")))
						.join("\n");
					const next = before + dedented + after;
					setSql(next);
					requestAnimationFrame(() => {
						ta.selectionStart = lineStart;
						ta.selectionEnd = lineStart + dedented.length;
					});
				} else {
					const next = value.slice(0, start) + "\t" + value.slice(end);
					setSql(next);
					requestAnimationFrame(() => {
						ta.selectionStart = ta.selectionEnd = start + 1;
					});
				}
			}
		},
		[activeTab?.isRunning, runCurrent],
	);

	function formatSql() {
		// 轻量格式化：关键字大写 + 简单换行（关键字列表预留，当前仅做去空行）
		let result = sql;
		// 先去多余空行
		result = result.replace(/\n{3,}/g, "\n\n");
		setSql(result.trim() + "\n");
	}

	function clearEditor() {
		if (!confirm("清空当前 SQL？")) return;
		setSql("");
	}

	const html = highlightSql(sql);
	const running = activeTab?.isRunning ?? false;
	const hasConn = Boolean(activeTab?.connectionName);

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			{/* 工具栏 */}
			<div className="flex h-8 shrink-0 items-center gap-1 border-b border-border bg-[#111320]/60 px-2">
				<button
					type="button"
					onClick={runCurrent}
					disabled={running || !hasConn}
					title="执行（⌘/Ctrl + Enter）"
					className="flex h-6 items-center gap-1 rounded bg-emerald-600/90 px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
				>
					{running ? (
						<span className="icon-[lucide--loader] h-3 w-3 animate-spin" />
					) : (
						<span className="icon-[lucide--play] h-3 w-3" />
					)}
					{running ? "执行中" : "执行"}
				</button>
				<div className="mx-1 h-4 w-px bg-zinc-700" />
				<button
					type="button"
					onClick={formatSql}
					title="格式化"
					className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-muted-foreground hover:bg-zinc-800 hover:text-zinc-200"
				>
					<span className="icon-[lucide--indent] h-3 w-3" />
					格式
				</button>
				<button
					type="button"
					onClick={clearEditor}
					title="清空"
					className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-muted-foreground hover:bg-zinc-800 hover:text-zinc-200"
				>
					<span className="icon-[lucide--trash-2] h-3 w-3" />
					清空
				</button>
				<div className="mx-1 h-4 w-px bg-zinc-700" />
				<span className="flex items-center gap-1 text-[10px] text-zinc-600">
					<span className="icon-[lucide--keyboard] h-2.5 w-2.5" />
					⌘/Ctrl+Enter 运行
				</span>
				<div className="ml-auto flex items-center gap-1 text-[10px] text-zinc-600">
					<span className="icon-[lucide--database] h-2.5 w-2.5" />
					{activeTab?.connectionName ?? "未绑定"}
					{!activeTab?.connectionName && (
						<span className="ml-1 rounded bg-red-500/10 px-1 text-red-400">请先选中连接</span>
					)}
				</div>
			</div>

			{/* 编辑器主体 */}
			<div className="relative min-h-0 flex-1">
				<pre
					ref={preRef}
					className="dbx-editor-hl"
					style={{
						transform: `translate(${-scrollLeft}px, ${-scrollTop}px)`,
						color: "var(--foreground)",
						fontSize: 13,
						lineHeight: 1.6,
						fontFamily: "'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace",
					}}
					aria-hidden="true"
				>
					<code dangerouslySetInnerHTML={{ __html: html + "\n" }} />
				</pre>
				<textarea
					ref={taRef}
					value={sql}
					onChange={(e) => setSql(e.target.value)}
					onScroll={onScroll}
					onKeyDown={onKeyDown}
					spellCheck={false}
					placeholder="在此输入 SQL..."
					style={{
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						padding: 12,
						fontFamily: "'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace",
						fontSize: 13,
						lineHeight: 1.6,
						border: "none",
						outline: "none",
						background: "transparent",
						color: "transparent",
						caretColor: "#a1a1aa",
						resize: "none",
						tabSize: 4,
						whiteSpace: "pre",
						overflow: "auto",
						zIndex: 2,
					}}
				/>
				{running && (
					<div className="pointer-events-none absolute right-3 top-3 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-black">
						执行中…
					</div>
				)}
			</div>
		</div>
	);
}
