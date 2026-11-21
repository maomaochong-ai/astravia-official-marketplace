import { Component, type ErrorInfo, type ReactElement, type ReactNode } from "react";
import type { PageId } from "../../state";

interface PageBoundaryProps {
	/** 当前页 id：错误提示里要说出是哪一页。 */
	page: PageId;
	children: ReactNode;
}

interface PageBoundaryState {
	message: string | null;
}

/**
 * 单个页面的错误边界。
 *
 * 顶层只有一个 PanelBoundary 时，任何一页抛错都会整块变成「面板渲染失败」——
 * 用户既回不去，也说不出发生在哪。这里把边界下沉到页面：
 *
 *   · 侧栏与顶栏仍然可用，换一页就能继续用；
 *   · 提示里带页名与可展开的原始信息，能直接贴回来定位；
 *   · `key` 由调用方绑到 page id 上，切页即重建边界，一次错误不会把所有页锁死。
 *
 * 不在这里做的：自动重试。渲染期抛错多是代码或数据形状问题，重试只会再抛一次。
 */
export class PageBoundary extends Component<PageBoundaryProps, PageBoundaryState> {
	state: PageBoundaryState = { message: null };

	static getDerivedStateFromError(error: unknown): PageBoundaryState {
		return {
			message:
				error instanceof Error
					? `${error.name}: ${error.message}`
					: typeof error === "string"
						? error
						: JSON.stringify(error),
		};
	}

	componentDidCatch(error: unknown, info: ErrorInfo): void {
		console.error(`[hanshuang-pojia] page "${this.props.page}" render failed`, error, info.componentStack);
	}

	render(): ReactNode {
		if (this.state.message === null) return this.props.children;
		return <PageFallback page={this.props.page} message={this.state.message} onRetry={() => this.setState({ message: null })} />;
	}
}

/** 失效时的替代内容：说清是哪一页，给出可复制的错误，并留一个「重试这一页」。 */
function PageFallback({ page, message, onRetry }: { page: PageId; message: string; onRetry(): void }): ReactElement {
	return (
		<div className="fb-page" data-testid="page-boundary-fallback" data-page={page}>
			<div className="rounded-xl bg-surface-2 p-4 ring-1 ring-line-subtle">
				<p className="text-[13px] font-semibold text-text">这一页渲染失败了</p>
				<p className="mt-1 text-[11.5px] leading-relaxed text-text-3">
					其他页面不受影响，可以从左侧切换到别的页继续用。把下面这段贴回来就能定位：
				</p>
				<div className="mt-2 flex flex-wrap items-center gap-2">
					<span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-text-2">{page}</span>
					<button
						type="button"
						onClick={onRetry}
						className="rounded-md border border-line-subtle px-2 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						重试这一页
					</button>
				</div>
				<pre className="fb-scroll mt-2 max-h-[var(--fb-h-xs)] overflow-auto rounded-lg bg-surface-3 p-2.5 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap text-risk-high">
					{message}
				</pre>
			</div>
		</div>
	);
}
