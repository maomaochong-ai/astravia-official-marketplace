import { useTranslation } from "@astravia-org/plugin-sdk";
import type { LiveStatus, LiveTone } from "../../live-status";

export interface SidebarStatusProps {
	status: LiveStatus;
}

const DOT: Record<LiveTone, string> = {
	live: "bg-risk-low",
	alert: "bg-risk-high",
	idle: "bg-text-4",
};

/**
 * 侧栏实时区：会话 / 本轮工具 / 当前样本 / 注入状态四个点。
 *
 * 收起成 48px 图标轨时只留语气点（靠 title 说明），展开后才显示标签与值——
 * 面板宽度由用户拖拽，状态不能只在一种宽度下存在。
 */
export function SidebarStatus({ status }: SidebarStatusProps) {
	const { t } = useTranslation();
	const { session, run, sample, inject } = status;

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
		<div className="border-t border-line-subtle px-1.5 pb-1 pt-2 @min-[720px]:px-2" data-testid="sidebar-status">
			<div className="hidden px-2 pb-1 text-[9.5px] font-medium uppercase tracking-wider text-text-4 @min-[720px]:block">{t("status.title")}</div>
			<div className="space-y-1">
				{rows.map(row => (
					<div
						key={row.id}
						title={`${row.label} · ${row.value}${row.detail ? ` · ${row.detail}` : ""}`}
						data-tone={row.tone}
						data-row={row.id}
						className="flex items-center justify-center gap-2 rounded-md px-0 py-1 @min-[720px]:justify-start @min-[720px]:px-2"
					>
						<span className={`size-1.5 shrink-0 rounded-full ${DOT[row.tone]}`} />
						<div className="hidden min-w-0 flex-1 leading-tight @min-[720px]:block">
							<div className="truncate text-[10.5px] text-text-3">{row.label}</div>
							<div className="truncate text-[11px] text-text">{row.value}</div>
							{row.detail ? <div className="truncate text-[10px] text-text-4">{row.detail}</div> : null}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
