/**
 * Bordered pane, matching the upstream TUI's `panelBox`.
 *
 * Upstream draws every sidebar section as a rounded box with a dim border that
 * turns green on focus (strix/interface/tui/internal/app/view.go). The tab uses
 * the same shape so the plugin reads as the same product.
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
