/**
 * 宽面板左栏：这是哪个阶段、还剩多少、往下走哪一步。
 *
 * 内容三段，自上而下回答问题：
 *   1. 在哪 —— 阶段 N / 6 + 本阶段标题与一句说明；
 *   2. 去哪 —— 六个阶段的竖向编号轨道（真实信号驱动）；
 *   3. 进度 —— 底部钉住的执行环覆盖条，不随滚动跑掉。
 *
 * 调用数 / 错误数不在这里：它们已经由顶部实时摘要条和右栏调用日志各自给出，
 * 一个事实在一个面板里只留一处。这里只回答「整体走到哪了」。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { Eyebrow } from "../../../shared/components/eyebrow";
import { ReaStageRail, type StageRailItem } from "./rea-stage-rail";

interface WorkflowRailProps {
	readonly currentStage: number;
	readonly total: number;
	readonly heading: string;
	readonly subtitle: string;
	readonly items: readonly StageRailItem[];
	readonly onSelect: (stage: number) => void;
	readonly ariaLabel: string;
	/** 已有真实调用的工具环节占比；null 时不画进度条，避免显示一个假的 0%。 */
	readonly passPercent: number | null;
}

export function ReaWorkflowRail({
	currentStage,
	total,
	heading,
	subtitle,
	items,
	onSelect,
	ariaLabel,
	passPercent,
}: WorkflowRailProps): JSX.Element {
	const { t } = useTranslation();
	return (
		<aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto border-r border-border bg-card/20 px-3 py-4 @min-[880px]:sticky @min-[880px]:top-0 @min-[880px]:flex @min-[880px]:max-h-[calc(100dvh-7rem)] @min-[1180px]:static @min-[1180px]:h-auto @min-[1180px]:max-h-none">
			<div className="flex flex-col gap-1.5">
				<Eyebrow tone="sage">{t("tab.detail.stageOf", { current: currentStage, total })}</Eyebrow>
				<h2 className="text-heading font-semibold leading-tight text-foreground">{heading}</h2>
				<p className="text-micro leading-snug text-faint">{subtitle}</p>
			</div>

			<ReaStageRail items={items} onSelect={onSelect} ariaLabel={ariaLabel} />

			<div className="mt-auto flex flex-col gap-1.5 rounded-tile border border-border bg-card p-3 shadow-card">
				{passPercent === null ? (
					<p className="text-micro leading-snug text-faint">{t("live.idle")}</p>
				) : (
					<>
						<span className="text-micro text-faint">{t("live.loop.pass", { percent: passPercent })}</span>
						<div className="h-1.5 w-full overflow-hidden rounded-pill bg-mist">
							<div
								className="h-full rounded-pill bg-primary transition-[width] duration-500"
								style={{ width: `${passPercent}%` }}
							/>
						</div>
					</>
				)}
			</div>
		</aside>
	);
}
