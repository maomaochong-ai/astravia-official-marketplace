/**
 * 外壳布局：`[侧栏] [顶栏 / 主内容]`，两层都是 flex，不用 grid，也不用绝对定位。
 *
 * 三个 `min-h-0` / `min-w-0` 不是装饰：flex 子项的默认 `min-width:auto` 会让
 * 长路径、长哈希把列撑宽，进而让侧栏被挤到内容下面（上一版的交叉正是这个机制）。
 * 这里把每一层都显式声明为可收缩，滚动只发生在 `main` 里。
 *
 * 分节页由容器一次性全部挂载、切换时用 `hidden` 隐藏：
 * 工具探测、doctor、安装进度都挂在页面内部的 hook 上，按需挂载会在每次切页时
 * 重跑一遍探测，并把正在进行的安装状态丢掉。
 */

import type { JSX, ReactNode } from "react";

interface ReaAppShellProps {
	readonly sidebar: ReactNode;
	readonly topbar: ReactNode;
	readonly children: ReactNode;
}

export function ReaAppShell({ sidebar, topbar, children }: ReaAppShellProps): JSX.Element {
	return (
		<div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
			{sidebar}
			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
				{topbar}
				<main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-surface">{children}</main>
			</div>
		</div>
	);
}

interface ReaPageProps {
	readonly active: boolean;
	readonly children: ReactNode;
}

/** 一页内容：未激活时从布局与无障碍树里同时移除，避免隐藏内容被读屏念出来。 */
export function ReaPage({ active, children }: ReaPageProps): JSX.Element {
	return (
		<div hidden={!active} aria-hidden={!active} className="flex flex-col gap-4 p-5 @max-[720px]:p-3">
			{children}
		</div>
	);
}

interface ReaPageHeaderProps {
	readonly title: string;
	readonly subtitle: string;
	readonly actions?: ReactNode;
}

/** 页头：15px 标题 + 12px 说明，右侧一组同高度动作。 */
export function ReaPageHeader({ title, subtitle, actions }: ReaPageHeaderProps): JSX.Element {
	return (
		<div className="flex min-w-0 items-start justify-between gap-3">
			<div className="min-w-0">
				<h1 className="truncate text-heading font-semibold text-text">{title}</h1>
				<p className="mt-0.5 text-pretty text-caption text-text-3">{subtitle}</p>
			</div>
			{actions === undefined ? null : <div className="flex shrink-0 items-center gap-2">{actions}</div>}
		</div>
	);
}
