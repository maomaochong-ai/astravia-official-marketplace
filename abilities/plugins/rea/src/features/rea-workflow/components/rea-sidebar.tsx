/**
 * 左侧分节栏：固定宽度、`shrink-0`，与主内容区是 **并列的 flex 兄弟节点**。
 *
 * 上一版把侧栏放进同一张三列 grid 里，窄面板时列宽被内容撑开，侧栏浮在正文
 * 上面（截图里的「侧边栏与文字交叉」）。改成 flex 之后，侧栏只占自己的
 * `w-56`，主区拿 `min-w-0 flex-1`，任何宽度下都不再重叠。
 *
 * 面板拖到 720px 以下时收成 48px 图标轨：只留图标 + title，避免 320px 宽时
 * 侧栏挤掉正文，也避免做「悬浮展开」——那正是上一次的重叠来源。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { ReaMark } from "../../../shared/components/rea-mark";
import { REA_SECTION_GROUPS, type ReaSection } from "./rea-sections";

export type EngineTone = "success" | "warning" | "danger" | "idle";

const DOT_CLASS: Record<EngineTone, string> = {
	success: "bg-risk-low",
	warning: "bg-risk-medium",
	danger: "bg-risk-high",
	idle: "bg-text-4",
};

interface ReaSidebarProps {
	readonly section: ReaSection;
	readonly onSelect: (section: ReaSection) => void;
	readonly engineTone: EngineTone;
	readonly engineLabel: string;
	readonly engineDetail: string;
	readonly enginePulse?: boolean;
}

export function ReaSidebar({
	section,
	onSelect,
	engineTone,
	engineLabel,
	engineDetail,
	enginePulse = false,
}: ReaSidebarProps): JSX.Element {
	const { t } = useTranslation();

	return (
		<aside
			aria-label={t("ui.sidebar.aria")}
			className="flex w-56 shrink-0 flex-col border-r border-border bg-surface-2 @max-[720px]:w-12"
		>
			<div className="flex items-center gap-2.5 px-3 pb-3 pt-4 @max-[720px]:justify-center @max-[720px]:px-0">
				<ReaMark sizeClass="size-7" title={t("tab.label")} />
				<div className="min-w-0 leading-tight @max-[720px]:hidden">
					<div className="truncate text-body-sm font-semibold text-text">{t("ui.sidebar.brand")}</div>
					<div className="truncate text-micro-up text-text-4">{t("ui.sidebar.tagline")}</div>
				</div>
			</div>

			<nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-2">
				{REA_SECTION_GROUPS.map((group) => (
					<div key={group.id}>
						<div className="px-2 pb-1.5 text-micro-up font-medium uppercase tracking-wider text-text-4 @max-[720px]:sr-only">
							{t(group.labelKey)}
						</div>
						<div className="space-y-0.5">
							{group.items.map((item) => {
								const active = item.id === section;
								const cls = [
									"flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-body-sm transition-colors",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
									"@max-[720px]:justify-center @max-[720px]:px-0",
									active
										? "bg-surface-active font-medium text-text"
										: "text-text-2 hover:bg-surface-hover hover:text-text",
								].join(" ");
								return (
									<button
										key={item.id}
										type="button"
										onClick={() => onSelect(item.id)}
										aria-current={active ? "page" : undefined}
										title={t(item.labelKey)}
										className={cls}
									>
										<span aria-hidden className={`${item.icon} size-4 shrink-0 ${active ? "text-text" : "text-text-3"}`} />
										<span className="truncate @max-[720px]:sr-only">{t(item.labelKey)}</span>
									</button>
								);
							})}
						</div>
					</div>
				))}
			</nav>

			<div className="border-t border-border-subtle p-2">
				<div
					className="flex min-w-0 items-center gap-2 rounded-md bg-surface-3 px-2.5 py-2 @max-[720px]:justify-center @max-[720px]:px-0"
					title={`${engineLabel} · ${engineDetail}`}
				>
					<span
						aria-hidden
						className={`size-2 shrink-0 rounded-full ${DOT_CLASS[engineTone]} ${enginePulse ? "motion-safe:animate-pulse" : ""}`}
					/>
					<div className="min-w-0 leading-tight @max-[720px]:hidden">
						<div className="truncate text-caption text-text">{engineLabel}</div>
						<div className="truncate text-micro-up text-text-4">{engineDetail}</div>
					</div>
				</div>
			</div>
		</aside>
	);
}
