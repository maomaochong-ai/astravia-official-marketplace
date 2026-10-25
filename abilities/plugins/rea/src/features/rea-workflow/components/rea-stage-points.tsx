/**
 * 阶段「关键要点」：每条要点绑定一条真实信号，随会话进度点亮。
 *
 * 默认只显示已经点亮的（正在跑 / 已命中 / 命中过但报错），外加一条展开入口；
 * 展开后给出细节说明与命中过的工具名。没有任何信号可绑定的要点标为「说明」，
 * 不伪装成进度。
 */

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { StatusChip } from "../../../shared/components/status-chip";
import type { StagePoint } from "../data/stages";
import type { DoctorStatus } from "../hooks/use-doctor-report";
import { resolveNodeLive, type DiagramNodeLive } from "../live/diagram-live";
import type { ReaLiveCall } from "../live/session-store";

interface StagePointsProps {
	readonly points: readonly StagePoint[];
	readonly calls: readonly ReaLiveCall[];
	readonly running: readonly string[];
	readonly doctor: DoctorStatus;
}

type PointState = "active" | "hit" | "failed" | "idle" | "reference";

function resolvePoint(point: StagePoint, calls: readonly ReaLiveCall[], running: readonly string[], doctor: DoctorStatus): DiagramNodeLive | null {
	if (point.binding) return resolveNodeLive(point.binding, calls, running);
	if (point.doctorSignal) {
		if (doctor === "ready") return { state: "hit", count: 0, errors: 0, tools: ["rea doctor"], running: [] };
		if (doctor === "checking") return { state: "active", count: 0, errors: 0, tools: [], running: ["rea doctor"] };
	}
	return null;
}

function pointState(live: DiagramNodeLive | null): PointState {
	if (live === null) return "reference";
	return live.state;
}

export function ReaStagePoints({ points, calls, running, doctor }: StagePointsProps): JSX.Element {
	const { t } = useTranslation();
	const [expanded, setExpanded] = useState(false);
	const resolved = useMemo(
		() => points.map((point) => ({ point, live: resolvePoint(point, calls, running, doctor) })),
		[points, calls, running, doctor],
	);
	const lit = resolved.filter((entry) => entry.live !== null && entry.live.state !== "idle");
	const visible = expanded ? resolved : lit.length > 0 ? lit : resolved.slice(0, 2);
	const hidden = resolved.length - visible.length;

	return (
		<div className="flex flex-col gap-1">
			<ul className="flex flex-col gap-1">
				{visible.map(({ point, live }) => {
					const state = pointState(live);
					const count = live?.count ?? 0;
					const tools = live?.tools ?? [];
					return (
						<li
							key={point.i18nKey}
							className={`flex items-start gap-1.5 rounded-control px-1 py-0.5 ${
								state === "active" ? "bg-primary/5" : ""
							}`}
						>
							<span
								aria-hidden
								className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
									state === "active"
										? "bg-primary motion-safe:animate-pulse"
										: state === "hit"
											? "bg-sage-dark"
											: state === "failed"
												? "bg-danger"
												: "bg-stone"
								}`}
							/>
							<div className="flex min-w-0 flex-1 flex-col">
								<div className="flex min-w-0 items-start justify-between gap-2">
									<span
										className={`min-w-0 text-pretty text-[11.5px] leading-relaxed ${
											state === "reference" ? "text-foreground/70" : "text-foreground/90"
										} ${expanded ? "" : "line-clamp-2"}`}
										title={t(point.i18nKey)}
									>
										{t(point.i18nKey)}
									</span>
									<PointChip state={state} count={count} />
								</div>
								{expanded ? (
									<>
										<p className="mt-0.5 text-pretty text-[10.5px] leading-snug text-muted-foreground">
											{t(point.detailKey)}
										</p>
										{tools.length > 0 ? (
											<p
												className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/80"
												title={tools.join(" · ")}
											>
												{t("tab.detail.points.evidence", { tools: tools.join(" · ") })}
											</p>
										) : null}
									</>
								) : null}
							</div>
						</li>
					);
				})}
			</ul>
			{hidden > 0 || expanded ? (
				<button
					type="button"
					onClick={() => setExpanded((prev) => !prev)}
					className="inline-flex h-5 w-fit items-center gap-1 rounded text-[10.5px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
				>
					<span aria-hidden className={`icon-[lucide--chevron-down] size-3 ${expanded ? "rotate-180" : ""}`} />
					{expanded ? t("tab.detail.points.collapse") : t("tab.detail.points.expand", { count: hidden })}
				</button>
			) : lit.length === 0 ? (
				<span className="text-[10px] text-muted-foreground">{t("tab.detail.points.waiting")}</span>
			) : null}
		</div>
	);
}

function PointChip({ state, count }: { state: PointState; count: number }): JSX.Element | null {
	const { t } = useTranslation();
	if (state === "reference") return <StatusChip tone="neutral" className="shrink-0">{t("tab.detail.points.reference")}</StatusChip>;
	if (state === "active") return <StatusChip tone="progress" className="shrink-0">{t("tab.live.diagram.running")}</StatusChip>;
	if (state === "failed") {
		return (
			<StatusChip tone="danger" className="shrink-0">
				{t("tab.live.diagram.failed", { count })}
			</StatusChip>
		);
	}
	if (state === "hit") {
		return (
			<StatusChip tone="success" className="shrink-0">
				{count > 0 ? t("tab.live.diagram.calls", { count }) : t("tab.detail.points.checked")}
			</StatusChip>
		);
	}
	return null;
}
