/**
 * One section of the artefact rail: a title row, an optional count, and content.
 *
 * Replaces the bordered card the panel used to stack six of (ADR strix-0004): in a
 * terminal a box was the only way to group lines, but in a tab it turns every two-line
 * fact into a frame, and six frames of "0" read as six reasons nothing happened. A
 * count of zero is rendered as an empty state, never as a badge that says `0`.
 */

export interface PanelBoxProps {
	title: string;
	/** Right-aligned note in the title row, e.g. a count. `"0"` is treated as empty. */
	hint?: string;
	/** Kept for call sites that used to highlight a focused pane. */
	focused?: boolean;
	children: React.ReactNode;
}

export function PanelBox({ title, hint, focused, children }: PanelBoxProps): React.ReactElement {
	const empty = hint === undefined || hint === "0" || hint.length === 0;
	return (
		<section className="astra-strix-section" data-focused={focused ? "yes" : "no"}>
			<h3 className="astra-strix-section-title">
				{title}
				{empty ? null : (
					<span className="astra-strix-count" data-empty="no">
						{hint}
					</span>
				)}
			</h3>
			{children}
		</section>
	);
}
