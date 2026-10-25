/**
 * 目标分节：把六种目标类型摊开成卡片，说明各自「第一步动哪里」。
 *
 * 工作台里的 chip 行只够切换；这里补上判断依据 —— 每种类型用在哪、
 * 第一个该调的工具是什么。用户拿不准时看这一页，比反复试点更快。
 *
 * 六个入口工具名是真实事实（data/targets.ts 的 entryTool），文案不承诺
 * 插件会替用户执行任何分析：执行永远在对话里的 Agent 侧。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { TARGETS, type TargetKind } from "../data/targets";
import { Panel, PanelHeader } from "../../../shared/components/panel";
import { ReaPage, ReaPageHeader } from "./rea-app-shell";

interface TargetsPageProps {
	readonly active: boolean;
	readonly current: TargetKind | null;
	readonly picked: boolean;
	readonly detected: TargetKind | null;
	readonly detectedPath: string | null;
	readonly onPick: (kind: TargetKind) => void;
	readonly onClear: () => void;
	readonly onFollowDetected: () => void;
	readonly onUseTarget: (path: string) => void;
}

export function TargetsPage({
	active,
	current,
	picked,
	detected,
	detectedPath,
	onPick,
	onClear,
	onFollowDetected,
	onUseTarget,
}: TargetsPageProps): JSX.Element {
	const { t } = useTranslation();
	const conflict = picked && detected !== null && current !== detected;

	return (
		<ReaPage active={active}>
			<ReaPageHeader
				title={t("ui.page.targets.title")}
				subtitle={t("ui.page.targets.subtitle")}
				actions={
					picked ? (
						<button
							type="button"
							onClick={onClear}
							className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-3 px-2.5 text-caption text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span aria-hidden className="icon-[lucide--eraser] size-3.5" />
							{t("tab.target.clear")}
						</button>
					) : undefined
				}
			/>

			{detected === null ? null : (
				<Panel>
					<PanelHeader
						title={t("tab.target.detectedTitle")}
						hint={detectedPath ?? undefined}
						actions={
							<span className="flex items-center gap-1.5">
								<button
									type="button"
									onClick={() => onPick(detected)}
									className="inline-flex h-6 items-center rounded-sm border border-border bg-surface-3 px-2 text-micro text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
								>
									{t(`tab.target.${detected}.label`)}
								</button>
								{conflict ? (
									<button
										type="button"
										onClick={onFollowDetected}
										className="inline-flex h-6 items-center rounded-sm border border-purple/40 bg-purple/10 px-2 text-micro text-purple-ink transition-colors hover:bg-purple/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
									>
										{t("tab.target.followDetected")}
									</button>
								) : null}
							</span>
						}
					/>
					<div className="flex flex-col gap-1.5 px-4 py-3">
						{detectedPath === null ? null : (
							<button
								type="button"
								onClick={() => onUseTarget(detectedPath)}
								className="flex min-w-0 items-center gap-2 rounded-md border border-border-subtle bg-surface-3 px-2.5 py-1.5 text-left transition-colors hover:border-purple/40 hover:bg-purple/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
							>
								<span aria-hidden className="icon-[lucide--file-search] size-3.5 shrink-0 text-text-3" />
								<span className="min-w-0 flex-1 truncate font-mono text-micro text-text-2">{detectedPath}</span>
								<span className="shrink-0 text-micro text-text-4">{t("ui.action.useTarget")}</span>
							</button>
						)}
						<p className="text-micro text-text-4">
							{conflict
								? t("tab.target.conflict", {
										detected: t(`tab.target.${detected}.label`),
										picked: current === null ? "" : t(`tab.target.${current}.label`),
									})
								: t("tab.target.autoDetected")}
						</p>
					</div>
				</Panel>
			)}

			<div className="grid min-w-0 grid-cols-1 gap-3 @min-[640px]:grid-cols-2 @min-[1100px]:grid-cols-3">
				{TARGETS.map((target) => {
					const isActive = current === target.kind;
					const isDetected = detected === target.kind;
					return (
						<button
							key={target.kind}
							type="button"
							onClick={() => onPick(target.kind)}
							aria-pressed={isActive}
							className={`flex min-w-0 flex-col gap-2 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
								isActive
									? "border-purple/50 bg-purple/8"
									: isDetected
										? "border-dashed border-border-strong bg-surface-2 hover:border-purple/40"
										: "border-border bg-surface-2 hover:border-border-strong hover:bg-surface-hover"
							}`}
						>
							<div className="flex min-w-0 items-center justify-between gap-2">
								<span className={`truncate text-caption font-medium ${isActive ? "text-purple-ink" : "text-text"}`}>
									{t(target.labelKey)}
								</span>
								{isActive ? (
									<span className="shrink-0 rounded-full bg-purple/15 px-1.5 py-0.5 text-micro-up text-purple-ink">
										{t("ui.targets.selected")}
									</span>
								) : isDetected ? (
									<span className="shrink-0 rounded-full bg-surface-chip px-1.5 py-0.5 text-micro-up text-text-3">
										{t("ui.targets.detected")}
									</span>
								) : null}
							</div>
							<p className="text-pretty text-micro leading-relaxed text-text-3">{t(target.hintKey)}</p>
							<p className="text-pretty text-micro leading-relaxed text-text-4">
								<span className="text-text-3">{t("ui.targets.firstMove")}</span> {t(target.firstMoveKey)}
							</p>
							<div className="mt-auto flex min-w-0 items-center gap-1.5 border-t border-border-subtle pt-2">
								<span aria-hidden className="icon-[lucide--corner-down-right] size-3 shrink-0 text-text-4" />
								<span className="min-w-0 flex-1 truncate font-mono text-micro-up text-text-2">{target.entryTool}</span>
							</div>
						</button>
					);
				})}
			</div>
		</ReaPage>
	);
}
