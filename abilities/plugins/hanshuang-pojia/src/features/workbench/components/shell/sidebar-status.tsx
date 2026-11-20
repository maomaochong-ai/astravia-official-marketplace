import { useTranslation } from "@astravia-org/plugin-sdk";
import type { LiveStatus, LiveTone } from "../../live-status";

export interface SidebarStatusProps {
	status: LiveStatus;
	/** 图标轨里只留语气点，文字全走 title。 */
	rail: boolean;
}

const DOT: Record<LiveTone, string> = {
	live: "bg-risk-low",
	alert: "bg-risk-high",
	idle: "bg-text-4",
};

/**
 * 侧栏实时区：会话 / 本轮 / 最近输出 / 当前样本 / 注入五个点。
 *
 * 比上一版多的是「最近输出」：跑过多少次调用是过程，最近这次跑出了什么才是结果。
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
		<div className={`border-t border-line-subtle ${rail ? "px-2 pb-2 pt-2" : "px-2 pb-1 pt-2"}`} data-testid="sidebar-status">
			{rail ? null : <div className="px-2 pb-1 text-[9.5px] font-medium uppercase tracking-wider text-text-4">{t("status.title")}</div>}
			<div className={rail ? "space-y-1.5" : "space-y-1"}>
				{rows.map(row => (
					<div
						key={row.id}
						title={`${row.label} · ${row.value}${row.detail ? ` · ${row.detail}` : ""}`}
						data-tone={row.tone}
						data-row={row.id}
						className={
							rail
								? "mx-auto flex size-4 items-center justify-center"
								: "flex items-center gap-2 rounded-md px-2 py-1"
						}
					>
						<span className={`size-1.5 shrink-0 rounded-full ${DOT[row.tone]}`} />
						{rail ? null : (
							<div className="min-w-0 flex-1 leading-tight">
								<div className="truncate text-[10.5px] text-text-3">{row.label}</div>
								<div className="truncate text-[11px] text-text">{row.value}</div>
								{row.detail ? <div className="truncate text-[10px] text-text-4">{row.detail}</div> : null}
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
