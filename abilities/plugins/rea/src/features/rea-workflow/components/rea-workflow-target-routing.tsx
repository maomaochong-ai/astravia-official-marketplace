/**
 * 目标类型选择：一排 6 个 chip（JavaScript / .NET / Native / Firmware / Web / Mobile）。
 *
 * 受控组件：选中状态由工作台持有，便于「选目标 → 命令清单随之切换 → 一键交给 Agent」
 * 这条链路共享同一份数据。芯片下方只说明该目标的判定依据与推荐工具栈；
 * 具体可跑的命令由工作台的命令清单提供，这里不再写命令行文本。
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
}

export function ReaWorkflowTargetRouting({
	active,
	picked,
	detected,
	onPick,
	onClear,
}: ReaWorkflowTargetRoutingProps): JSX.Element {
	const { t } = useTranslation();
	return (
		<div aria-label={t("tab.target.sectionAria")}>
			<header className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					{t("tab.target.sectionTitle")}
				</h3>
				{picked ? (
					<button
						type="button"
						className="inline-flex h-5 items-center rounded text-[10.5px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
					return (
						<button
							key={target.kind}
							type="button"
							onClick={() => onPick(target.kind)}
							className={
								isActive
									? "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/50 bg-primary/15 px-2.5 text-[11.5px] font-medium text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
									: "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-background/40 px-2.5 text-[11.5px] font-medium text-foreground/85 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
							}
							aria-pressed={isActive}
						>
							<span aria-hidden className={`${iconFor(target.kind)} shrink-0 text-[12px] leading-none`} />
							<span>{t(target.labelKey)}</span>
						</button>
					);
				})}
			</div>
			{active ? <TargetDetail kind={active} /> : null}
		</div>
	);
}

function TargetDetail({ kind }: { kind: TargetKind }): JSX.Element {
	const { t } = useTranslation();
	const target = getTarget(kind);
	return (
		<div className="mt-2 rounded-[min(var(--radius-md),8px)] border border-border bg-background/50 px-2.5 py-1.5">
			<p className="text-[11px] leading-relaxed text-foreground/90">{t(target.hintKey)}</p>
			<p className="mt-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">{t("tab.target.toolsLabel")}</p>
			<p className="text-[11px] font-mono text-foreground/85">{t(target.toolsKey)}</p>
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
