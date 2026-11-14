/**
 * One block of the scan trace.
 *
 * The reading order is upstream's tool renderer (render/registry.go): the tool
 * name, its arguments, then the status line. The two additions are the ones a
 * pointer makes possible - the output folds away, and the block keeps the exit
 * code and duration it closed with.
 *
 * Assistant and note lines are upstream's chat renderer: dim italics for a status
 * note, a blue bar and `You:` for what the operator typed, and plain body text for
 * the agent.
 *
 * Two rows are not upstream's: the host conversation's own messages. The panel and the
 * chat drive one sandbox (ADR strix-0003), so a transcript that showed only the panel's
 * half would read as if the user had typed into thin air. They carry their own label, and
 * prose is split into paragraphs — a model answer arriving as one 900-character block is
 * the "output format" complaint the workbench was supposed to answer.
 */

import { useState } from "react";
import type { TraceEntry } from "../../../runtime-contract";

export interface TraceBlockProps {
	entry: TraceEntry;
	/** Label for a message typed in the host chat; falls back to `You`. */
	hostLabel?: string;
	/** Label for the host agent's own answer; falls back to nothing. */
	hostSayLabel?: string;
}

/** Collapsed output budget: enough to see what a command did, small enough to scroll. */
const OUTPUT_PREVIEW_LINES = 16;

function ToolBlock({ entry }: { entry: TraceEntry }): React.ReactElement {
	const [open, setOpen] = useState(false);
	const state = entry.ok === undefined ? "running" : entry.ok ? "ok" : "fail";
	const status = state === "running" ? "● In progress..." : state === "ok" ? "✓ Done" : "✗ Failed";
	const output = entry.output ?? "";
	const lines = output ? output.split("\n") : [];
	const truncated = lines.length > OUTPUT_PREVIEW_LINES;
	const visible = open ? output : lines.slice(0, OUTPUT_PREVIEW_LINES).join("\n");
	const expandable = Boolean(output);

	return (
		<div className="astra-strix-tool" data-state={state}>
			<div className="astra-strix-tool-head">
				<span className="astra-strix-dim">→ Using tool </span>
				<span className="astra-strix-tool-name">{entry.label}</span>
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

/** Paragraphs, so a long answer is scannable instead of one wall of text. */
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

function HostRow({ entry, label }: { entry: TraceEntry; label: string }): React.ReactElement {
	return (
		<div className="astra-strix-host">
			<p>
				<span className="astra-strix-host-bar" aria-hidden="true">
					▍
				</span>
				<span className="astra-strix-host-name">{label}</span>
			</p>
			<Prose text={entry.label} className="astra-strix-host-text" />
		</div>
	);
}

export function TraceBlock({ entry, hostLabel, hostSayLabel }: TraceBlockProps): React.ReactElement {
	if (entry.kind === "tool") return <ToolBlock entry={entry} />;

	if (entry.kind === "note") {
		return <p className="astra-strix-note">{entry.label}</p>;
	}

	if (entry.kind === "host") return <HostRow entry={entry} label={hostLabel ?? "You"} />;

	if (entry.kind === "host-say") return <HostRow entry={entry} label={hostSayLabel ?? "Host"} />;

	if (entry.kind === "user") {
		return (
			<div className="astra-strix-you">
				{entry.label.split("\n").map((line, index) => (
					<p key={`${index}-${line}`}>
						<span className="astra-strix-you-bar" aria-hidden="true">
							▍
						</span>
						<span className="astra-strix-you-name">{index === 0 ? "You:" : ""}</span> {line}
					</p>
				))}
			</div>
		);
	}

	return <Prose text={entry.label} className="astra-strix-say" />;
}
