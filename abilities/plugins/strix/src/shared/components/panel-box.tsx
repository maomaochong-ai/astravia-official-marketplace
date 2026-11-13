/**
 * One section of the artefact rail: a title row, an optional count, and content.
 *
 * Replaces the bordered card the panel used to stack six of (ADR strix-0004). Two
 * rules from that decision live here:
 *
 *  - a count of zero is not a badge; it is an empty state;
 *  - a section with nothing in it collapses to one line that says so, and opens when
 *    the reader asks. Six expanded "nothing yet" blocks push the one section that does
 *    have content off the screen.
 */

import { useState } from "react";

export interface PanelBoxProps {
	title: string;
	/** Right-aligned note in the title row, e.g. a count. `"0"` is treated as empty. */
	hint?: string;
	/** Kept for call sites that used to highlight a focused pane. */
	focused?: boolean;
	/** Text of the collapsed row; when omitted an empty section stays open. */
	emptyLabel?: string;
	children: React.ReactNode;
}

export function PanelBox({ title, hint, focused, emptyLabel, children }: PanelBoxProps): React.ReactElement {
	const empty = hint === undefined || hint === "0" || hint.length === 0;
	const collapsible = empty && Boolean(emptyLabel);
	const [open, setOpen] = useState(false);
	const shown = !collapsible || open;

	return (
		<section className="astra-strix-section" data-focused={focused ? "yes" : "no"} data-empty={empty ? "yes" : "no"}>
			{empty ? (
				<h3 className="astra-strix-section-title">
					{title}
					{emptyLabel ? <span className="astra-strix-section-note">{emptyLabel}</span> : null}
				</h3>
			) : (
				<h3 className="astra-strix-section-title">
					{title}
					<span className="astra-strix-count" data-empty="no" title={`${title}: ${hint}`}>
						{hint}
					</span>
				</h3>
			)}
			{collapsible ? (
				<>
					<button
						type="button"
						className="astra-strix-section-toggle"
						aria-expanded={open}
						onClick={() => setOpen((previous) => !previous)}
					>
						{open ? "−" : "+"}
					</button>
					{shown ? <div className="astra-strix-section-collapsed-body">{children}</div> : null}
				</>
			) : (
				children
			)}
		</section>
	);
}
