import { Component, type ErrorInfo, type ReactNode } from "react";
import { getPluginContext } from "../../plugin-context";

/**
 * The tab must never be a blank rectangle.
 *
 * The panel owns a lot of state read from host storage at mount (history, notes, settings,
 * the AI provider list). Any of those can throw on a machine where storage is read-only or
 * a stored file is corrupt, and without a boundary the host renders an empty frame — which
 * reads to the user as "the tab is broken" with nothing to report.
 *
 * This is deliberately *not* a retry loop: a render error caused by bad state will throw
 * again. It shows what failed, where to find the log line, and one action that actually
 * helps — reset the panel by remounting it.
 */
export interface PanelBoundaryProps {
	/** Remount token: changing it re-creates the subtree after a reset. */
	resetKey: number;
	onReset(): void;
	/** Text shown above the error; passed in so this file holds no translations. */
	title: string;
	hint: string;
	actionLabel: string;
	children: ReactNode;
}

interface PanelBoundaryState {
	message: string | null;
}

export class PanelBoundary extends Component<PanelBoundaryProps, PanelBoundaryState> {
	state: PanelBoundaryState = { message: null };

	static getDerivedStateFromError(error: unknown): PanelBoundaryState {
		return { message: error instanceof Error ? error.message : String(error) };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		// One line the user can quote. The panel has no console of its own.
		console.error("[logocreator] panel render failed", error, info.componentStack);
		try {
			getPluginContext().ui.notify({ message: this.props.title, variant: "error" });
		} catch {
			/* notify is a nicety; a missing context must not throw here too. */
		}
	}

	render(): ReactNode {
		if (this.state.message === null) {
			/*
			 * 包层必须**把高度传下去**。
			 *
			 * 这里原来是一个裸 `<div key>`：它高度 auto，于是里面画布的 `h-full` 解析成 0，
			 * 而画布的区域全是绝对定位的子元素 —— 全被裁掉，面板只剩一条背景色。
			 * 「tab 打开了但里面是空的」就是这个包层造成的。
			 */
			return (
				<div key={this.props.resetKey} className="flex h-full min-h-0 w-full flex-col">
					{this.props.children}
				</div>
			);
		}
		return (
			<div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 bg-background px-6 py-10 text-center text-foreground">
				<p className="text-[13px] font-semibold">{this.props.title}</p>
				<p className="max-w-[46ch] text-[11.5px] leading-relaxed text-muted-foreground">{this.props.hint}</p>
				<code className="max-h-24 max-w-full overflow-auto rounded-md bg-muted px-2 py-1 font-mono text-[10.5px] text-muted-foreground">
					{this.state.message}
				</code>
				<button
					type="button"
					onClick={() => {
						this.setState({ message: null });
						this.props.onReset();
					}}
					className="mt-1 rounded-md border border-border px-2.5 py-1 text-[11.5px] transition-colors hover:bg-accent"
				>
					{this.props.actionLabel}
				</button>
			</div>
		);
	}
}
