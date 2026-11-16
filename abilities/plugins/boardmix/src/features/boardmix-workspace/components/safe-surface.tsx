import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * 插件渲染面的兜底边界。
 *
 * 为什么必须有：宿主的渲染器不会替每个插件组件设边界——插件里任何一次 render 抛错，
 * 整个窗口就白（深色主题下是黑屏），用户看到的是"发了句话，界面没了"。
 *
 * 这里把错误收在自己这一块里：显示一行可读的原因 + 重试按钮，宿主其余部分照常可用。
 * 边界在 React 里只能是 class（没有 hook 等价物），所以这个小类保留在插件内。
 */
interface SafeSurfaceProps {
	/** createElement 转发时 children 是变参，所以这里允许缺省。 */
	children?: ReactNode;
	/** 出错时显示的标题（比如「白板面板」）。 */
	label: string;
}

interface SafeSurfaceState {
	error: Error | null;
}

export class SafeSurface extends Component<SafeSurfaceProps, SafeSurfaceState> {
	state: SafeSurfaceState = { error: null };

	static getDerivedStateFromError(error: Error): SafeSurfaceState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		// 只在控制台留一行：插件不该把堆栈写进宿主的界面。
		console.error("[boardmix]", this.props.label, error.message, info.componentStack);
	}

	render(): ReactNode {
		if (!this.state.error) return this.props.children ?? null;
		return (
			<div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
				<p className="font-medium text-destructive">
					{this.props.label} 渲染失败
				</p>
				<p className="max-w-md break-words font-mono text-[11px]">{this.state.error.message}</p>
				<button
					type="button"
					className="mt-1 h-7 rounded-md border border-border px-2.5 text-xs text-foreground hover:bg-muted/60"
					onClick={() => this.setState({ error: null })}
				>
					重试
				</button>
			</div>
		);
	}
}
