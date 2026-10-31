import type { ReactNode } from "react";

/**
 * 窗口条：三个纸钉、面包屑、右侧一行状态。
 *
 * 三个圆点是装饰（宿主的窗口按钮不归插件管），不绑事件；右侧那格留给调用方，
 * 书架放字数、运行台放连接状态，不写死。
 */
export function WindowChrome({ crumb, right }: { crumb: string; right?: ReactNode }) {
	return (
		<div className="flex h-11 shrink-0 items-center gap-3 bg-canvas px-4">
			<div className="flex items-center gap-1.5">
				<span className="size-2.5 rounded-pill bg-line-strong" />
				<span className="size-2.5 rounded-pill bg-line-strong" />
				<span className="size-2.5 rounded-pill bg-line-strong" />
			</div>
			<span className="ml-2 truncate text-micro tracking-wide text-ink-soft">{crumb}</span>
			<div className="ml-auto flex items-center gap-3 text-micro text-ink-faint">{right}</div>
		</div>
	);
}
