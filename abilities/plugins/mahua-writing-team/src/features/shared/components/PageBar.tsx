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
 * 每个 surface 共用的一条页头（ADR 0026 §2 / 0027 §4）。
 *
 * 照设计稿 `PageHeader` 的比例：标题是 26–30px 的衬线大字，元信息压在它下面一行、
 * 用 11px 的等宽数字；右端操作与标题**基线对齐**。设计稿那枚返回箭头是纯图标，
 * 这里带上文字——标签页里图标按钮太小，认不出来就是坏的。
 */
export function PageBar({ back, actions, children }: PageBarProps) {
	return (
		<header className="flex shrink-0 flex-col gap-1.5 px-4 pb-4 pt-4 sm:px-6">
			{back ? (
				<button
					type="button"
					onClick={back.onClick}
					className="mb-0.5 flex shrink-0 items-center gap-1 self-start rounded-[6px] py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
				>
					<span aria-hidden="true" className="icon-[solar--alt-arrow-left-linear] size-3" />
					{back.label}
				</button>
			) : null}
			<div className="flex flex-wrap items-end gap-x-3 gap-y-2">
				<div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">{children}</div>
				{actions ? <div className="flex min-w-0 flex-wrap items-center gap-2 pb-0.5">{actions}</div> : null}
			</div>
		</header>
	);
}

/** 页头标题：唯一一处 26/30px 的衬线大字，别在页面里再写一遍。 */
export const PAGE_TITLE = "font-serif text-[26px] font-semibold leading-tight tracking-tight text-foreground sm:text-[30px]";

/** 页头元信息：等宽数字，跟标题同基线。 */
export const PAGE_META = "flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px] text-muted-foreground";
