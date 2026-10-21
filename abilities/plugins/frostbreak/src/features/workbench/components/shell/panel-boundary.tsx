import { Component, type ErrorInfo, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";

interface PanelBoundaryProps {
	children: ReactNode;
}

interface PanelBoundaryState {
	message: string | null;
}

function BoundaryFallback({ message }: { message: string }): ReactElement {
	const { t } = useTranslation();
	return (
		<div className="fb-root flex min-h-0 flex-1 items-center justify-center bg-background p-6 text-foreground">
			<div className="w-full max-w-lg rounded-xl border border-line bg-surface p-5">
				<p className="text-sm font-semibold">{t("panel.crash.title")}</p>
				<p className="mt-2 text-xs leading-relaxed text-text-3">{t("panel.crash.body")}</p>
				<pre className="fb-scroll mt-3 max-h-40 overflow-auto rounded-lg bg-surface-3 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-risk-high">
					{message}
				</pre>
			</div>
		</div>
	);
}

/**
 * 面板边界：宿主把 tab 的异常直接升级成整块空白，所以这里兜住页内抛错，
 * 至少留下可读的原因，让用户能把消息贴回来。
 */
export class PanelBoundary extends Component<PanelBoundaryProps, PanelBoundaryState> {
	state: PanelBoundaryState = { message: null };

	static getDerivedStateFromError(error: unknown): PanelBoundaryState {
		return { message: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
	}

	componentDidCatch(error: unknown, info: ErrorInfo): void {
		console.error("[frostbreak] panel render failed", error, info.componentStack);
	}

	render(): ReactNode {
		if (this.state.message !== null) return <BoundaryFallback message={this.state.message} />;
		return this.props.children;
	}
}
