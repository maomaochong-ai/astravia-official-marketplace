/**
 * Error boundary for the console pane.
 *
 * The pane is a Module Federation remote inside the host's conversation surface. If
 * it throws during render the host shows an empty area and the reason only reaches
 * a log file, so a broken render reads as "the plugin does nothing". This catches
 * the failure and prints it where the user is already looking, with the message the
 * developer needs.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

export interface ConsoleBoundaryProps {
	t: (key: string) => string;
	children: ReactNode;
}

interface State {
	error?: Error;
	stack?: string;
}

export class ConsoleBoundary extends Component<ConsoleBoundaryProps, State> {
	state: State = {};

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		// Keep the console trace: the host's log is the only place a maintainer can
		// read it after the fact.
		console.error("[strix] console pane crashed", error, info.componentStack);
		this.setState({ stack: info.componentStack ?? undefined });
	}

	render(): ReactNode {
		const { error, stack } = this.state;
		if (!error) return this.props.children;
		const t = this.props.t;
		return (
			<div className="astra-strix-panel astra-strix-panel-broken">
				<div className="astra-strix-crash" role="alert">
					<p className="astra-strix-crash-title">{t("crash.title")}</p>
					<p className="astra-strix-hint">{t("crash.hint")}</p>
					<pre className="astra-strix-evidence">{`${error.name}: ${error.message}${stack ? `\n${stack.trim()}` : ""}`}</pre>
					<button type="button" className="astra-strix-button" onClick={() => this.setState({})}>
						{t("crash.retry")}
					</button>
				</div>
			</div>
		);
	}
}
