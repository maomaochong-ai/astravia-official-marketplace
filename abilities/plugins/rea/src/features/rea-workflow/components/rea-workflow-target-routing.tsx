/**
 * 目标类型选择：6 个按钮，两列。
 *
 * 两种高亮同时存在，用户不能只看到其中一个：
 *   实线 + 紫底 = 用户手动选定
 *   虚线 + 圆点 = 宿主对话里由真实工具调用识别出来的目标类型
 * 二者不一致时，下方给出「会话识别到 X，你选的是 Y」并提供「跟随识别」。
 *
 * 这里只做选择；每个目标「为什么这样排查、第一步跑什么」在「目标」页展开，
 * 因为那是一段要读的说明，塞进两列的窄卡片会挤成一行行折行文本。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { TARGETS, getTarget, type TargetKind } from "../data/targets";

export interface ReaWorkflowTargetRoutingProps {
	/** 当前生效的目标类型（工作台选择 + 会话检测的合并结果）。 */
	readonly active: TargetKind | null;
	/** 是否由用户手动选定（false 时说明来自会话检测）。 */
	readonly picked: boolean;
	/** 从真实工具调用推断出的目标类型；只做提示，用户仍可手动改选。 */
	readonly detected?: TargetKind | null;
	readonly onPick: (kind: TargetKind) => void;
	readonly onClear: () => void;
	/** 放弃手动选择，跟随会话识别结果。 */
	readonly onFollowDetected: () => void;
}

export function ReaWorkflowTargetRouting({
	active,
	picked,
	detected,
	onPick,
	onClear,
	onFollowDetected,
}: ReaWorkflowTargetRoutingProps): JSX.Element {
	const { t } = useTranslation();
	const conflict = picked && detected !== null && detected !== undefined && active !== detected;

	return (
		<div aria-label={t("tab.target.sectionAria")} className="flex flex-col gap-2 px-4 py-3">
			<div className="flex min-w-0 items-center justify-between gap-2">
				<span className="text-micro font-medium text-text-3">{t("tab.target.sectionTitle")}</span>
				{picked ? (
					<button
						type="button"
						className="inline-flex h-5 shrink-0 items-center rounded-sm px-1 text-micro text-text-4 transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						onClick={onClear}
					>
						{t("tab.target.clear")}
					</button>
				) : detected ? (
					<span className="shrink-0 whitespace-nowrap text-micro text-text-4">{t("tab.target.autoDetected")}</span>
				) : null}
			</div>

			<div className="grid grid-cols-2 gap-1.5">
				{TARGETS.map((target) => {
					const isActive = active === target.kind;
					const isDetected = detected === target.kind;
					const cls = [
						"inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md border px-2 text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
						isActive
							? "border-purple/50 bg-purple/10 text-purple-ink"
							: isDetected
								? "border-dashed border-risk-medium/60 bg-risk-medium/10 text-text"
								: "border-border bg-surface-3 text-text-2 hover:bg-surface-hover hover:text-text",
					].join(" ");
					return (
						<button
							key={target.kind}
							type="button"
							onClick={() => onPick(target.kind)}
							className={cls}
							aria-pressed={isActive}
							title={isActive ? t("tab.target.pickedTitle") : isDetected ? t("tab.target.detectedTitle") : t(target.hintKey)}
						>
							<span aria-hidden className={`${iconFor(target.kind)} size-3.5 shrink-0`} />
							<span className="truncate">{t(target.labelKey)}</span>
							{isDetected ? (
								<span aria-hidden className="ml-auto size-1.5 shrink-0 rounded-full bg-risk-medium motion-safe:animate-pulse" />
							) : null}
						</button>
					);
				})}
			</div>

			{conflict && detected ? (
				<div className="flex min-w-0 items-center gap-2">
					<span className="min-w-0 flex-1 truncate text-micro text-risk-medium" title={t("tab.target.conflictTitle")}>
						{t("tab.target.conflict", {
							detected: t(`tab.target.${detected}.label`),
							picked: active ? t(`tab.target.${active}.label`) : "",
						})}
					</span>
					<button
						type="button"
						onClick={onFollowDetected}
						className="inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border border-border px-1.5 text-micro font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<span aria-hidden className="icon-[lucide--corner-down-right] size-2.5" />
						{t("tab.target.followDetected")}
					</button>
				</div>
			) : detected ? (
				<span className="min-w-0 truncate text-micro text-text-4" title={t("tab.target.legendDetected")}>
					{t("tab.target.legendDetected")}
				</span>
			) : null}

			{active ? (
				<p className="text-pretty text-micro leading-relaxed text-text-3">{t(getTarget(active).hintKey)}</p>
			) : (
				<p className="text-pretty text-micro leading-relaxed text-text-4" title={t("tab.target.noSignalHint")}>
					{t("tab.target.noSignalHint")}
				</p>
			)}
		</div>
	);
}

/** 目标图标统一取自 @iconify-json/lucide，经 @iconify/tailwind4 生成图标工具类。 */
function iconFor(kind: TargetKind): string {
	switch (kind) {
		case "javascript":
			return "icon-[lucide--file-code]";
		case "dotnet":
			return "icon-[lucide--binary]";
		case "native":
			return "icon-[lucide--cpu]";
		case "firmware":
			return "icon-[lucide--hard-drive]";
		case "web":
			return "icon-[lucide--globe]";
		case "mobile":
			return "icon-[lucide--smartphone]";
	}
}
