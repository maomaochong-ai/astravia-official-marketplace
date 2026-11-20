import { useTranslation } from "@astravia-org/plugin-sdk";
import type { LiveStatus, LiveTone } from "../../live-status";

export interface SidebarStatusProps {
	status: LiveStatus;
	/** 图标轨里只留语气点，文字全走 title。 */
	rail: boolean;
}

/** 语气到步骤盒强调条：与侧栏导航的分组色同一套语义。 */
const TONE: Record<LiveTone, "ok" | "warn" | "alert" | "idle"> = {
	live: "ok",
	alert: "alert",
	idle: "idle",
};

const DOT: Record<LiveTone, string> = {
	live: "bg-risk-low",
	alert: "bg-risk-high",
	idle: "bg-text-4",
};

/**
 * 侧栏实时区：会话 / 本轮 / 最近输出 / 当前样本 / 注入五个点。
 *
 * 用步骤盒而不是「标签 + 值」两行：这五个点回答的是「刚才发生了什么」，
 * 一行状态 + 一行细节的结构跟上游工作流里的步骤盒同形，扫一眼就能定位哪一步不对。
 * 规模量（条数 / 段数 / 格式）从工具载荷里挑，不铺开整个对象——侧栏只有一行的宽度。
 */
export function SidebarStatus({ status, rail }: SidebarStatusProps) {
	const { t } = useTranslation();
	const { session, run, sample, inject, output } = status;

	const rows: { id: string; tone: LiveTone; label: string; value: string; detail: string | null }[] = [
		{
			id: "session",
			tone: session.tone,
			label: t("status.session"),
			value: session.disconnected ? t("status.session.offline") : session.streaming ? t("status.session.streaming") : t("status.session.idle"),
			detail: session.tool,
		},
		{
			id: "run",
			tone: run.tone,
			label: t("status.run"),
			value: run.failed
				? t("status.run.failed")
				: run.active
					? t("status.run.active", { count: run.tools })
					: run.tools > 0
						? t("status.run.done", { count: run.tools })
						: t("status.run.idle"),
			detail: run.lastTool,
		},
		{
			id: "output",
			tone: output.tone,
			label: t("status.output"),
			value: output.toolId ?? t("status.output.none"),
			detail: output.summary ? [output.summary, ...output.hints].join(" · ") : null,
		},
		{
			id: "sample",
			tone: sample?.tone ?? "idle",
			label: t("status.sample"),
			value: sample ? sample.name : t("status.sample.none"),
			detail: sample ? t("status.sample.risk", { score: sample.score, grade: sample.grade }) : null,
		},
		{
			id: "inject",
			tone: inject.tone,
			label: t("status.inject"),
			value: inject.name ?? t("status.inject.none"),
			detail: null,
		},
	];

	return (
		<div className={`shrink-0 border-t border-line-subtle ${rail ? "px-2 pb-2 pt-2" : "px-2 pb-1.5 pt-2"}`} data-testid="sidebar-status">
			{rail ? null : <div className="px-1 pb-1 text-[9.5px] font-medium uppercase tracking-wider text-text-4">{t("status.title")}</div>}
			<div className={rail ? "space-y-1.5" : "space-y-1"}>
				{rows.map(row => (
					<div
						key={row.id}
						title={`${row.label} · ${row.value}${row.detail ? ` · ${row.detail}` : ""}`}
						data-tone={TONE[row.tone]}
						data-row={row.id}
						className={rail ? "mx-auto flex size-4 items-center justify-center" : "fb-step !gap-0.5 !py-1 !pl-2.5"}
					>
						{rail ? (
							<span className={`size-1.5 rounded-full ${DOT[row.tone]}`} />
						) : (
							<>
								<span className="flex items-center gap-1.5">
									<span className={`size-1.5 shrink-0 rounded-full ${DOT[row.tone]}`} />
									<span className="truncate text-[10px] text-text-3">{row.label}</span>
								</span>
								<span className="truncate text-[11px] text-text">{row.value}</span>
								{row.detail ? <span className="truncate text-[9.5px] text-text-4">{row.detail}</span> : null}
							</>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
