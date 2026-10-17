/**
 * 目标类型选择：一排 6 个 chip（JavaScript / .NET / Native / Firmware / Web / Mobile）。
 *
 * 两种高亮同时存在，用户不能只看到其中一个：
 *   实线实底  = 用户手动选定（active 就是它）
 *   虚线 + 圆点 = 宿主对话里由真实工具调用识别出来的目标类型
 * 二者不一致时，chip 行下方给出「会话识别到 X，你选的是 Y」并提供「跟随识别」。
 *
 * 选中后下方显示：该目标的入口提示 + 本次需要的工具就绪面板（doctor 实测，不是静态建议）。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginCommandRunResult } from "@astravia-org/plugin-sdk";
import type { DoctorReport } from "../hooks/use-doctor-report";
import type { ReaLiveCall } from "../live/session-store";
import { TARGETS, getTarget, type TargetKind } from "../data/targets";
import { ReaToolReadiness } from "./rea-tool-readiness";

export interface ReaWorkflowTargetRoutingProps {
	/** 当前生效的目标类型（工作台选择 + 会话检测的合并结果）。 */
	readonly active: TargetKind | null;
	/** 是否由用户手动选定（false 时说明来自会话检测）。 */
	readonly picked: boolean;
	/** 从真实工具调用推断出的目标类型；只做提示，用户仍可手动改选。 */
	readonly detected?: TargetKind | null;
	readonly calls: readonly ReaLiveCall[];
	/** 此刻正在运行的工具名，用于把对应工具行标成「运行中」。 */
	readonly running: readonly string[];
	readonly report: DoctorReport;
	readonly run: (args: readonly string[], options: { cwd?: string; timeoutMs: number }) => Promise<PluginCommandRunResult>;
	readonly runCommand: ((file: string, args: readonly string[]) => Promise<PluginCommandRunResult>) | null;
	readonly cwd: string | null;
	readonly onPick: (kind: TargetKind) => void;
	readonly onClear: () => void;
	/** 放弃手动选择，跟随会话识别结果。 */
	readonly onFollowDetected: () => void;
}

export function ReaWorkflowTargetRouting({
	active,
	picked,
	detected,
	calls,
	running,
	report,
	run,
	cwd,
	runCommand,
	onPick,
	onClear,
	onFollowDetected,
}: ReaWorkflowTargetRoutingProps): JSX.Element {
	const { t } = useTranslation();
	const conflict = picked && detected !== null && detected !== undefined && active !== detected;

	return (
		<div aria-label={t("tab.target.sectionAria")}>
			<header className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
				<h3 className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					{t("tab.target.sectionTitle")}
				</h3>
				{picked ? (
					<button
						type="button"
						className="inline-flex h-5 shrink-0 items-center rounded px-0.5 text-[10.5px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						onClick={onClear}
					>
						{t("tab.target.clear")}
					</button>
				) : detected ? (
					<span className="shrink-0 whitespace-nowrap text-[10.5px] text-muted-foreground">{t("tab.target.autoDetected")}</span>
				) : null}
			</header>

			<div className="flex flex-wrap gap-1.5">
				{TARGETS.map((target) => {
					const isActive = active === target.kind;
					const isDetected = detected === target.kind;
					const cls = [
						"inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
						isActive
							? "border-primary/60 bg-primary/15 text-primary"
							: isDetected
								? "border-dashed border-amber-500/60 bg-amber-500/5 text-foreground/85"
								: "border-border bg-background/40 text-foreground/85 hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
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
							<span aria-hidden className={`${iconFor(target.kind)} shrink-0 text-[12px] leading-none`} />
							<span>{t(target.labelKey)}</span>
							{isDetected ? (
								<span
									aria-hidden
									className="size-1.5 shrink-0 rounded-full bg-amber-500 motion-safe:animate-pulse"
								/>
							) : null}
						</button>
					);
				})}
			</div>

			<div className="mt-1 flex min-w-0 items-center gap-2">
				{conflict && detected ? (
					<>
						<span className="min-w-0 flex-1 truncate text-[10.5px] text-amber-700 dark:text-amber-400" title={t("tab.target.conflictTitle")}>
							{t("tab.target.conflict", {
								detected: t(`tab.target.${detected}.label`),
								picked: active ? t(`tab.target.${active}.label`) : "",
							})}
						</span>
						<button
							type="button"
							onClick={onFollowDetected}
							className="inline-flex h-5 shrink-0 items-center gap-1 rounded border border-border px-1.5 text-[10px] font-medium text-foreground/85 transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span aria-hidden className="icon-[lucide--corner-down-right] size-2.5" />
							{t("tab.target.followDetected")}
						</button>
					</>
				) : detected ? (
					<span className="min-w-0 truncate text-[10.5px] text-muted-foreground" title={t("tab.target.legendDetected")}>
						{t("tab.target.legendDetected")}
					</span>
				) : null}
			</div>

			{active ? (
				<TargetDetail kind={active} calls={calls} running={running} report={report} run={run} runCommand={runCommand} cwd={cwd} />
			) : (
				<p className="mt-1 text-[10.5px] leading-snug text-muted-foreground" title={t("tab.target.noSignalHint")}>
					{t("tab.target.noSignalHint")}
				</p>
			)}
		</div>
	);
}

interface TargetDetailProps {
	readonly kind: TargetKind;
	readonly calls: readonly ReaLiveCall[];
	readonly running: readonly string[];
	readonly report: DoctorReport;
	readonly run: (args: readonly string[], options: { cwd?: string; timeoutMs: number }) => Promise<PluginCommandRunResult>;
	readonly runCommand: ((file: string, args: readonly string[]) => Promise<PluginCommandRunResult>) | null;
	readonly cwd: string | null;
}

function TargetDetail({ kind, calls, running, report, run, runCommand, cwd }: TargetDetailProps): JSX.Element {
	const { t } = useTranslation();
	const target = getTarget(kind);
	return (
		<div className="mt-2 rounded-[min(var(--radius-md),8px)] border border-border bg-background/50 px-2.5 py-1.5">
			<p className="text-[11px] leading-relaxed text-foreground/90">{t(target.hintKey)}</p>
			<ReaToolReadiness target={kind} calls={calls} running={running} report={report} run={run} runCommand={runCommand} cwd={cwd} />
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
