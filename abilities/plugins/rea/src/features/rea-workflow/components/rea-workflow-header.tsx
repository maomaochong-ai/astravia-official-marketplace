/**
 * 面板标题条：品牌标记 + 名称 + 一句话定位 + 右侧动作槽。
 *
 * 这里没有 macOS 三色圆点 —— 那是设计稿 1440×900 模拟窗口的外框，
 * 插件运行在宿主 activity tab 里，窗口 chrome 由宿主提供。
 * 保留下来的是「这是哪个工具、它做什么、现在能点哪」这三件事。
 */

import type { JSX, ReactNode } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { ReaMark } from "../../../shared/components/rea-mark";
import { Pill } from "../../../shared/components/pill";

interface WorkflowHeaderProps {
	readonly children?: ReactNode;
}

export function ReaWorkflowHeader({ children }: WorkflowHeaderProps): JSX.Element {
	const { t } = useTranslation();
	return (
		<header className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-2.5">
			<ReaMark sizeClass="size-7" title={t("tab.title")} />
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-2">
					<h1 className="min-w-0 truncate text-body-sm font-semibold leading-tight text-foreground">{t("tab.title")}</h1>
					<Pill tone="quiet" className="h-5 px-2 text-micro-up">
						{t("tab.workflowBadge")}
					</Pill>
				</div>
				<p className="mt-0.5 truncate text-micro leading-tight text-faint" title={t("tab.subtitle")}>
					{t("tab.subtitle")}
				</p>
			</div>
			{children ? <div className="flex shrink-0 items-center gap-1">{children}</div> : null}
		</header>
	);
}
