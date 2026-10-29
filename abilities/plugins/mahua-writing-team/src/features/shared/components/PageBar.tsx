import type { ReactNode } from "react";

interface PageBarProps {
	/** 上一层：书页回书架、阅读页回书页、书库回书架。不给就没有返回位。 */
	back?: { label: string; onClick(): void };
	/** 右端操作区，窄面板里会折到标题下面一行。 */
	actions?: ReactNode;
	/** 标题区：通常是一个 `h1` 加一行元信息（阶段、题材、章数、字数）。 */
	children: ReactNode;
}

/**
 * 每个 surface 共用的一条页头（ADR 0026）。
 *
 * 设计稿的 `PageHeader` 是 `items-end` 的一行；这里多一层 `flex-wrap`：标签页实宽只有
 * 400–1000px，标题长了、操作多了就必须折行，而不是把右端按钮挤出可视区。
 * 折行只发生在一条页头内部，不改变阅读顺序。
 */
export function PageBar({ back, actions, children }: PageBarProps) {
	return (
		<header className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 border-b border-border/40 px-5 pb-3 pt-4">
			{back ? (
				<button
					type="button"
					onClick={back.onClick}
					className="mb-0.5 shrink-0 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					← {back.label}
				</button>
			) : null}
			<div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
			{actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
		</header>
	);
}
