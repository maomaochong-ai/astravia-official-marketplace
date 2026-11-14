/**
 * One block of the scan trace: what ran, and what it produced.
 *
 * The reading order is upstream's tool renderer (render/registry.go): the tool name, its
 * arguments, then the status line. The two additions are the ones a pointer makes possible
 * — the output folds away, and the block keeps the exit code and duration it closed with.
 *
 * 这里**没有**用户发言、没有 agent 回复（ADR strix-0007）。宿主的聊天区已经把两样都渲染
 * 好了：markdown、可复制、可以滚很远；面板再画一遍就是同一段文字的第二份存在。轨迹
 * 存在的理由是聊天区没有的东西：命令原文、退出码、耗时、输出尾巴、哪一步在跑。
 */

import { useState } from "react";
import type { TraceEntry } from "../../../runtime-contract";
import { presentTool } from "../tool-presentation";

export interface TraceBlockProps {
	entry: TraceEntry;
}

/** Collapsed output budget: enough to see what a command did, small enough to scroll. */
const OUTPUT_PREVIEW_LINES = 16;

function ToolBlock({ entry }: { entry: TraceEntry }): React.ReactElement {
	const [open, setOpen] = useState(false);
	const state = entry.ok === undefined ? "running" : entry.ok ? "ok" : "fail";
	// 逐工具外观：上游 24 个渲染器的家族化版本（tool-presentation.ts）。
	// 未登记的工具落到 generic，也就是上游的 `→ Using tool <name>`。
	const look = presentTool(entry.label);
	const status = state === "running" ? "● In progress..." : state === "ok" ? "✓ Done" : "✗ Failed";
	const output = entry.output ?? "";
	const lines = output ? output.split("\n") : [];
	const truncated = lines.length > OUTPUT_PREVIEW_LINES;
	const visible = open ? output : lines.slice(0, OUTPUT_PREVIEW_LINES).join("\n");
	const expandable = Boolean(output) && look.expandable;

	return (
		<div className="astra-strix-tool" data-state={state} data-family={look.family}>
			<div className="astra-strix-tool-head" data-tone={look.tone}>
				<span className="astra-strix-tool-glyph-mark" aria-hidden="true">
					{look.glyph}
				</span>
				<span className="astra-strix-tool-name">{look.title}</span>
				{look.family === "generic" ? <span className="astra-strix-dim"> {entry.label}</span> : null}
				{lines.length ? <span className="astra-strix-tool-meta">{lines.length} 行</span> : null}
			</div>
			{entry.detail ? <code className="astra-strix-tool-args">{entry.detail}</code> : null}
			<button
				type="button"
				className="astra-strix-tool-status"
				data-state={state}
				onClick={() => (expandable ? setOpen((value) => !value) : undefined)}
				aria-expanded={expandable ? open : undefined}
			>
				{state === "running" ? (
					<span className="astra-strix-sweep" data-size="row" data-active="yes" aria-hidden="true">
						{Array.from({ length: 4 }, (_, index) => (
							<span key={index} style={{ animationDelay: `${index * 90}ms` }} />
						))}
					</span>
				) : null}
				<span className="astra-strix-tool-glyph">{status}</span>
				{expandable ? (
					<span className="astra-strix-dim">
						{" "}
						{open ? "▾" : "▸"}
						{truncated && !open ? " 已截断" : ""}
					</span>
				) : null}
			</button>
			{visible ? <pre className="astra-strix-tool-output">{visible}</pre> : null}
		</div>
	);
}

/** Paragraphs, so a long conclusion is scannable instead of one wall of text. */
function Prose({ text, className }: { text: string; className: string }): React.ReactElement {
	const paragraphs = text.split(/\n{2,}/).filter((block) => block.trim().length > 0);
	if (paragraphs.length <= 1) return <p className={className}>{text}</p>;
	return (
		<div className="astra-strix-prose">
			{paragraphs.map((block, index) => (
				<p key={`${index}-${block.slice(0, 24)}`} className={className}>
					{block}
				</p>
			))}
		</div>
	);
}

export function TraceBlock({ entry }: TraceBlockProps): React.ReactElement {
	if (entry.kind === "tool") return <ToolBlock entry={entry} />;
	if (entry.kind === "note") {
		// 相邻同文合并后的计数：一条 ×12 比十二行重复更能说明“它在重试”。
		return (
			<p className="astra-strix-note">
				{entry.label}
				{entry.count && entry.count > 1 ? <span className="astra-strix-note-count"> ×{entry.count}</span> : null}
			</p>
		);
	}
	return <Prose text={entry.label} className="astra-strix-say" />;
}
