/**
 * One entry of the trace, drawn the way upstream's TUI draws a tool call.
 *
 * Upstream renders a running command as `→ Using tool exec_command`, its arguments
 * underneath, and a status glyph (render/registry.go). This keeps that reading
 * order - what ran, what it printed, how it ended - and adds the two things a
 * mouse can use and a terminal cannot: the output folds away, and the row carries
 * its duration.
 */

import { useState } from "react";
import type { TraceEntry } from "../../../runtime-contract";

export interface TraceBlockProps {
	entry: TraceEntry;
}

function status(entry: TraceEntry): { glyph: string; label: string; tone: string } {
	if (entry.kind === "note") return { glyph: "·", label: entry.label, tone: "astra-strix-dim" };
	if (entry.ok === undefined) return { glyph: "●", label: "In progress…", tone: "astra-strix-amber" };
	if (entry.ok) return { glyph: "✓", label: "Done", tone: "astra-strix-green" };
	return { glyph: "✗", label: "Failed", tone: "astra-strix-red" };
}

function clock(at: number): string {
	const date = new Date(at);
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(
		date.getSeconds(),
	).padStart(2, "0")}`;
}

export function TraceBlock({ entry }: TraceBlockProps): React.ReactElement {
	const [open, setOpen] = useState(false);
	const mark = status(entry);

	if (entry.kind === "note") {
		return (
			<p className="astra-strix-note">
				<span className="astra-strix-note-dot" />
				{entry.label}
				<span className="astra-strix-note-time">{clock(entry.at)}</span>
			</p>
		);
	}

	const hasOutput = Boolean(entry.output);

	return (
		<article className="astra-strix-tool" data-state={entry.ok === undefined ? "running" : entry.ok ? "ok" : "fail"}>
			<button
				type="button"
				className="astra-strix-tool-row"
				onClick={() => (hasOutput ? setOpen((value) => !value) : undefined)}
				aria-expanded={hasOutput ? open : undefined}
			>
				<span className={`astra-strix-tool-glyph ${mark.tone}`}>{mark.glyph}</span>
				<span className="astra-strix-tool-body">
					<span className="astra-strix-tool-head">
						<span className="astra-strix-dim">exec_command</span>
						<span className={`astra-strix-tool-state ${mark.tone}`}>{mark.label}</span>
						{entry.detail ? <span className="astra-strix-tool-meta">{entry.detail}</span> : null}
						<span className="astra-strix-tool-meta">{clock(entry.at)}</span>
					</span>
					<code className="astra-strix-tool-cmd">{entry.label}</code>
				</span>
				{hasOutput ? <span className="astra-strix-tool-chevron">{open ? "▾" : "▸"}</span> : null}
			</button>
			{open && hasOutput ? <pre className="astra-strix-tool-output">{entry.output}</pre> : null}
		</article>
	);
}
