import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslator, type Translate } from "../hooks/use-translator";
import { WorkbenchNotice } from "./WorkbenchNotice";

/**
 * 工作台的最后一道护栏。
 *
 * 为什么需要：宿主的 `activate` 是一次事务，但**渲染期**抛错不归它管——一个页面在 render
 * 里炸了，React 会把整棵子树卸掉，读者看到的是空白面板，而控制台在另一个进程里，没人会去看。
 * 「标签页里什么都渲染不出来」这个症状，一半的成因就长这样：不是没注册上，是注册上了、画的时候炸了。
 *
 * 它只兜渲染错误（含 `componentDidCatch` 之前发生的 props/state 计算），不兜存储读写——
 * 那些已经有 `data.error` 这条正经通路了。
 */

interface BoundaryProps {
	children: ReactNode;
	translate: Translate;
}

interface BoundaryState {
	error: Error | null;
}

class WorkbenchErrorBoundary extends Component<BoundaryProps, BoundaryState> {
	state: BoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): BoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		// 交给宿主的主进程日志，同时留在渲染层控制台里。日志只给开发者看，所以不进 locales。
		console.error("[mahua-writing-team] workbench render failed", error, info.componentStack);
	}

	private readonly retry = () => {
		this.setState({ error: null });
	};

	render(): ReactNode {
		const { error } = this.state;
		if (!error) return this.props.children;

		const t = this.props.translate;

		return (
			<WorkbenchNotice
				title={t("window.crashed")}
				hint={t("window.crashedHint")}
				detail={error.message || String(error)}
				action={
					<button
						type="button"
						onClick={this.retry}
						className="mt-1 flex h-7 items-center rounded-control bg-cinnabar px-3 text-[10px] font-semibold text-canvas transition-colors hover:bg-cinnabar/88"
					>
						{t("window.crashedRetry")}
					</button>
				}
			/>
		);
	}
}

export function WorkbenchBoundary({ children }: { children: ReactNode }) {
	const t = useTranslator();
	return <WorkbenchErrorBoundary translate={t}>{children}</WorkbenchErrorBoundary>;
}
