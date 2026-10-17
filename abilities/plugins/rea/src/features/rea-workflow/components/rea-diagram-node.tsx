/**
 * 流程示意图的单个节点。
 *
 * 用 DOM 而不是 SVG：客户端面板宽度可能只有 300px，固定 viewBox 缩放的 SVG 会把 9px 字号
 * 压到 4px 且文字溢出圆角矩形。这里的节点靠 `min-w-0` + `break-words` 自动换行，任何宽度都不裁切。
 *
 * 实时态：传入 `live` 后，节点会带上真实调用次数 / 正在跑的工具名 / 失败数。
 * 徽标行固定 9px 并允许截断，窄面板里也不会把标题挤变形。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { DiagramNodeLive } from "../live/diagram-live";

export type DiagramTone = "primary" | "neutral" | "warning" | "quiet";

const TONE: Record<DiagramTone, { readonly box: string; readonly title: string }> = {
	primary: { box: "border-primary/50 bg-primary/10", title: "text-foreground" },
	neutral: { box: "border-border bg-card", title: "text-foreground" },
	warning: { box: "border-amber-500/50 bg-amber-500/10", title: "text-amber-700 dark:text-amber-400" },
	quiet: { box: "border-dashed border-border bg-transparent", title: "text-foreground" },
};

interface NodeProps {
	readonly tone?: DiagramTone;
	readonly title: string;
	readonly hint?: string;
	/** 命令、字段名等需要等宽字体的内容。 */
	readonly mono?: boolean;
	/** 真实会话活动；缺省表示这个节点只是参考内容。 */
	readonly live?: DiagramNodeLive;
	/** 会话已经开跑，但这个节点没有命中：说明本次没走到这一步，而不是还在等。 */
	readonly unmet?: boolean;
}

export function ReaDiagramNode({ tone = "neutral", title, hint, mono = false, live, unmet = false }: NodeProps): JSX.Element {
	const { t } = useTranslation();
	const style = TONE[tone];
	const state = live?.state ?? "idle";
	const stateBox =
		state === "active"
			? "border-primary/80 bg-primary/10 motion-safe:animate-rea-ring"
			: state === "failed"
				? "border-red-500/60 bg-red-500/5"
				: state === "hit"
					? "border-primary/45"
					: "";
	return (
		<div
			className={`min-w-0 rounded-[min(var(--radius-md),8px)] border px-2.5 py-2 text-center transition-colors duration-200 ${style.box} ${stateBox}`}
			data-rea-node-state={state}
		>
			<div
				className={`break-words text-[11px] font-medium leading-tight ${style.title} ${mono ? "font-mono" : ""}`}
			>
				{title}
			</div>
			{hint ? (
				<div className="mt-1 break-words text-[10px] leading-snug text-muted-foreground">{hint}</div>
			) : null}
			{live && (state !== "idle" || unmet) ? (
				<div className="mt-1 flex min-w-0 items-center justify-center gap-1 text-[9px] leading-none motion-safe:animate-rea-rise">
					{state === "active" ? (
						<>
							<span className="size-1 shrink-0 rounded-full bg-primary motion-safe:animate-ping" aria-hidden />
							<span className="shrink-0 font-medium text-primary">{t("tab.live.diagram.running")}</span>
							{live.running[0] ? (
								<code className="min-w-0 truncate font-mono text-foreground/80" title={live.running[0]}>
									{live.running[0]}
								</code>
							) : null}
						</>
					) : state === "failed" ? (
						<>
							<span aria-hidden className="icon-[lucide--triangle-alert] size-2.5 shrink-0 text-red-500" />
							<span className="shrink-0 font-medium tabular-nums text-red-600 dark:text-red-400">
								{t("tab.live.diagram.failed", { count: live.errors })}
							</span>
						</>
					) : state === "idle" ? (
						<span className="shrink-0 text-muted-foreground" title={t("tab.live.diagram.unmetHint")}>
							{t("tab.live.diagram.unmet")}
						</span>
					) : (
						<>
							<span aria-hidden className="icon-[lucide--circle-check] size-2.5 shrink-0 text-primary" />
							<span className="shrink-0 font-medium tabular-nums text-primary">
								{live.count > 0
									? t("tab.live.diagram.calls", { count: live.count })
									: t("tab.live.diagram.reached")}
							</span>
							{live.tools[0] ? (
								<code className="min-w-0 truncate font-mono text-muted-foreground" title={live.tools[0]}>
									{live.tools[0]}
								</code>
							) : null}
						</>
					)}
				</div>
			) : null}
		</div>
	);
}
