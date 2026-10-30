import type { ReactNode } from "react";

interface StudioChromeProps {
	/** 面包屑：品牌 → 当前层。最后一段是当前页，用正文色。 */
	crumb: string[];
	/** 右端事实区：凭证、同步状态一类，能截断就截断。 */
	right?: ReactNode;
}

/**
 * 标签页顶栏（设计稿 `WindowChrome` + `StudioRail` 之外的第三块，ADR 0027 §1）。
 *
 * 设计稿那三个红黄绿灯是桌面窗口的控件，标签页里没有窗口可关，所以不复刻；
 * 留下的是一条 36px 的面包屑行——它告诉用户「现在在市场里的哪一层」，
 * 右端只放能对上账的事实，不放装饰。
 */
export function StudioChrome({ crumb, right }: StudioChromeProps) {
	return (
		<div className="flex h-9 shrink-0 items-center gap-2 px-4 text-[11px] text-muted-foreground">
			<span className="flex min-w-0 items-baseline gap-1.5 truncate">
				{crumb.map((part, index) => {
					const last = index === crumb.length - 1;
					return (
						<span key={`${part}-${index}`} className="flex min-w-0 items-baseline gap-1.5">
							{index > 0 ? <span className="shrink-0 text-muted-foreground/50">/</span> : null}
							<span className={last ? "truncate font-medium text-foreground" : "truncate"}>{part}</span>
						</span>
					);
				})}
			</span>
			{right ? <span className="ml-auto flex min-w-0 shrink-0 items-center gap-2">{right}</span> : null}
		</div>
	);
}
