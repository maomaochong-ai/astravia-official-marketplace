/**
 * One line of the trace, rendered the way upstream's TUI renders a tool call.
 *
 * Upstream draws a running command as `→ Using tool exec_command`, its arguments
 * underneath, and a status glyph (`● In progress... / ✓ Done / ✗ Failed`,
 * strix/interface/tui/internal/render/registry.go). The plugin's trace is the same
 * information: a command the agent ran through Strix's sandbox, and how it ended.
 */

import type { TraceEntry } from "../../../runtime-contract";

export interface TraceBlockProps {
	entry: TraceEntry;
}

function status(entry: TraceEntry): { glyph: string; tone: string } {
	if (entry.kind === "note") return { glyph: "·", tone: "astra-strix-dim" };
	if (entry.ok === undefined) return { glyph: "● In progress...", tone: "astra-strix-amber" };
	if (entry.ok) return { glyph: "✓ Done", tone: "astra-strix-green" };
	return { glyph: "✗ Failed", tone: "astra-strix-red" };
}

export function TraceBlock({ entry }: TraceBlockProps): React.ReactElement {
	const mark = status(entry);
	if (entry.kind === "note") {
		return (
			<p className="astra-strix-note">
				<span className="astra-strix-dim">· </span>
				{entry.label}
			</p>
		);
	}
	return (
		<div className="astra-strix-tool">
			<p className="astra-strix-tool-head">
				<span className="astra-strix-dim">→ Using tool </span>
				<strong className="astra-strix-blue">exec_command</strong>
			</p>
			<pre className="astra-strix-tool-arg">{entry.label}</pre>
			{entry.detail ? <p className="astra-strix-tool-arg astra-strix-dim">{entry.detail}</p> : null}
			<p className={mark.tone}>{mark.glyph}</p>
		</div>
	);
}
