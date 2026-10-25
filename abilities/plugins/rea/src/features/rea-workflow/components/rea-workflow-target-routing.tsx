/**
 * 目标类型选择：一排 6 个 chip（JavaScript / .NET / Native / Firmware / Web / Mobile）。
 *
 * 两种高亮同时存在，用户不能只看到其中一个：
 *   实线实底   = 用户手动选定（active 就是它）
 *   虚线 + 圆点 = 宿主对话里由真实工具调用识别出来的目标类型
 * 二者不一致时，chip 行下方给出「会话识别到 X，你选的是 Y」并提供「跟随识别」。
 *
 * 工具就绪矩阵不在这里：它是「这台机器缺什么」的全局事实，不随目标类型切换，
 * 放在面板右栏（窄屏落到内容下方）可以一直看到。这里只留该目标的入口提示。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { TARGETS, getTarget, type TargetKind } from "../data/targets";
import { Eyebrow } from "../../../shared/components/eyebrow";
import { StatusDot } from "../../../shared/components/status-dot";

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
		<div aria-label={t("tab.target.sectionAria")} className="px-4 py-3">
			<header className="mb-2 flex min-w-0 items-center justify-between gap-2">
				<Eyebrow tone="strong">{t("tab.target.sectionTitle")}</Eyebrow>
				{picked ? (
					<button
						type="button"
						className="inline-flex h-5 shrink-0 items-center rounded px-0.5 text-micro-up text-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						onClick={onClear}
					>
						{t("tab.target.clear")}
					</button>
				) : detected ? (
					<span className="shrink-0 whitespace-nowrap text-micro-up text-faint">{t("tab.target.autoDetected")}</span>
				) : null}
			</header>

			<div className="flex flex-wrap gap-1.5">
				{TARGETS.map((target) => {
					const isActive = active === target.kind;
					const isDetected = detected === target.kind;
					const cls = [
						"inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
						isActive
							? "border-primary/50 bg-primary/12 text-primary"
							: isDetected
								? "border-dashed border-honey bg-apricot-light text-foreground/85"
								: "border-border bg-transparent text-foreground/80 hover:border-border-strong hover:bg-mist hover:text-foreground",
					].join(" ");
					return (
						<button
							key={target.kind}
							type="button"
							onClick={() => onPick(target.kind)}
							className={cls}
							aria-pressed={isActive}
							title={
								isActive
									? t("tab.target.pickedTitle")
									: isDetected
										? t("tab.target.detectedTitle")
										: t(target.hintKey)
							}
						>
							<span aria-hidden className={`${iconFor(target.kind)} shrink-0 text-caption leading-none`} />
							<span>{t(target.labelKey)}</span>
							{isDetected ? <StatusDot tone="warning" pulse /> : null}
						</button>
					);
				})}
			</div>

			<div className="mt-1.5 flex min-w-0 items-center gap-2">
				{conflict && detected ? (
					<>
						<span className="min-w-0 flex-1 truncate text-micro text-ochre" title={t("tab.target.conflictTitle")}>
							{t("tab.target.conflict", {
								detected: t(`tab.target.${detected}.label`),
								picked: active ? t(`tab.target.${active}.label`) : "",
							})}
						</span>
						<button
							type="button"
							onClick={onFollowDetected}
							className="inline-flex h-5 shrink-0 items-center gap-1 rounded-pill border border-border px-1.5 text-micro-up font-medium text-foreground/85 transition-colors hover:border-border-strong hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span aria-hidden className="icon-[lucide--corner-down-right] size-2.5" />
							{t("tab.target.followDetected")}
						</button>
					</>
				) : detected ? (
					<span className="min-w-0 truncate text-micro text-faint" title={t("tab.target.legendDetected")}>
						{t("tab.target.legendDetected")}
					</span>
				) : null}
			</div>

			{active ? (
				<p className="mt-2 text-pretty text-micro leading-relaxed text-foreground/85">{t(getTarget(active).hintKey)}</p>
			) : (
				<p className="mt-2 text-pretty text-micro leading-relaxed text-faint" title={t("tab.target.noSignalHint")}>
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
