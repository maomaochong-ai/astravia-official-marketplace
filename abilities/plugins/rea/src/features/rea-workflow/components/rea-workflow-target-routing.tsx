/**
 * 目标类型路由卡：tab 顶部一排 6 个 chip（JavaScript / .NET / Native / Firmware / Web / Mobile），
 * 选中后展示「该目标的推荐工具栈 + 入口命令」并把 stage 切到 route。
 *
 * 6 个 chip 的色号用 neutral；选中用 primary 半透明叠 + 边框高亮。
 */

import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { TARGETS, getTarget, type TargetKind } from "../data/targets";

export interface ReaWorkflowTargetRoutingProps {
	readonly onRoute: (stage: number) => void;
}

export function ReaWorkflowTargetRouting({ onRoute }: ReaWorkflowTargetRoutingProps): JSX.Element {
	const { t } = useTranslation();
	const [active, setActive] = useState<TargetKind | null>(null);

	const handlePick = (kind: TargetKind): void => {
		const target = getTarget(kind);
		setActive(kind);
		onRoute(target.routeStage);
	};

	return (
		<section
			className="border-b border-border bg-card/30 px-3 py-2.5"
			aria-label={t("tab.target.sectionAria")}
		>
			<header className="mb-1.5 flex items-center justify-between">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					{t("tab.target.sectionTitle")}
				</h3>
				{active ? (
					<button
						type="button"
						className="inline-flex h-5 items-center rounded text-[10.5px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						onClick={() => setActive(null)}
					>
						{t("tab.target.clear")}
					</button>
				) : null}
			</header>
			<div className="flex flex-wrap gap-1.5">
				{TARGETS.map((target) => {
					const isActive = active === target.kind;
					return (
						<button
							key={target.kind}
							type="button"
							onClick={() => handlePick(target.kind)}
							className={
								isActive
									? "inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/50 bg-primary/15 px-2.5 text-[11.5px] font-medium text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
									: "inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-background/40 px-2.5 text-[11.5px] font-medium text-foreground/85 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
							}
							aria-pressed={isActive}
						>
							<span aria-hidden className="text-[12px] leading-none">{iconFor(target.kind)}</span>
							<span>{t(target.labelKey)}</span>
						</button>
					);
				})}
			</div>
			{active ? <TargetDetail kind={active} /> : null}
		</section>
	);
}

function TargetDetail({ kind }: { kind: TargetKind }): JSX.Element {
	const { t } = useTranslation();
	const target = getTarget(kind);
	return (
		<div className="mt-2 rounded-[min(var(--radius-md),8px)] border border-border bg-background/50 px-2.5 py-1.5">
			<p className="text-[11px] leading-relaxed text-foreground/90">{t(target.hintKey)}</p>
			<p className="mt-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">
				{t("tab.target.toolsLabel")}
			</p>
			<p className="text-[11px] font-mono text-foreground/85">{t(target.toolsKey)}</p>
			<details className="mt-1.5">
				<summary className="cursor-pointer text-[10.5px] text-primary hover:underline">
					{t("tab.target.commandLabel")}
				</summary>
				<pre className="mt-1 overflow-auto rounded bg-muted/50 px-2 py-1 font-mono text-[10.5px] leading-relaxed text-foreground/85">
{t(target.commandKey)}
				</pre>
			</details>
		</div>
	);
}

function iconFor(kind: TargetKind): string {
	switch (kind) {
		case "javascript":
			return "JS";
		case "dotnet":
			return ".NET";
		case "native":
			return "⚙";
		case "firmware":
			return "▤";
		case "web":
			return "≋";
		case "mobile":
			return "▢";
	}
}
