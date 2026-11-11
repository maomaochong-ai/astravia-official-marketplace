/**
 * Panel shell: a rounded card with a header row, matching upstream's sidebar boxes
 * (view.go:panelBox) and borrowing one idea from the host's own UI - the title row
 * is a dim label with an optional count on the right.
 */

export interface PanelBoxProps {
	title: string;
	/** Right-aligned note in the title row, e.g. a count. */
	hint?: string;
	/** Green border, for the pane that currently has the user's attention. */
	focused?: boolean;
	children: React.ReactNode;
}

export function PanelBox({ title, hint, focused, children }: PanelBoxProps): React.ReactElement {
	return (
		<section className={focused ? "astra-strix-box astra-strix-box-focused" : "astra-strix-box"}>
			<header className="astra-strix-box-head">
				<span className="astra-strix-box-title">{title}</span>
				{hint ? <span className="astra-strix-box-hint">{hint}</span> : null}
			</header>
			<div className="astra-strix-box-body">{children}</div>
		</section>
	);
}
