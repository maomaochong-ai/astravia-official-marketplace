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
 */

import { useState } from "react";
import type { TraceEntry } from "../../../runtime-contract";

export interface TraceBlockProps {
	entry: TraceEntry;
}

function ToolBlock({ entry }: { entry: TraceEntry }): React.ReactElement {
	const [open, setOpen] = useState(false);
	const state = entry.ok === undefined ? "running" : entry.ok ? "ok" : "fail";
	const status = state === "running" ? "● In progress..." : state === "ok" ? "✓ Done" : "✗ Failed";
	const expandable = Boolean(entry.output);

	return (
		<div className="astra-strix-tool" data-state={state}>
			<div className="astra-strix-tool-head">
				<span className="astra-strix-dim">→ Using tool </span>
				<span className="astra-strix-tool-name">{entry.label}</span>
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
				{expandable ? <span className="astra-strix-dim"> {open ? "▾" : "▸"}</span> : null}
			</button>
			{open && entry.output ? <pre className="astra-strix-tool-output">{entry.output}</pre> : null}
		</div>
	);
}

export function TraceBlock({ entry }: TraceBlockProps): React.ReactElement {
	if (entry.kind === "tool") return <ToolBlock entry={entry} />;

	if (entry.kind === "note") {
		return <p className="astra-strix-note">{entry.label}</p>;
	}

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

	return <p className="astra-strix-say">{entry.label}</p>;
}
