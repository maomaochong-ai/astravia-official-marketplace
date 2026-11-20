import { useTranslation } from "@astravia-org/plugin-sdk";
import type { LiveStatus, LiveTone } from "../../live-status";

export interface SidebarStatusProps {
	status: LiveStatus;
	/** 图标轨里只留语气点，文字全走 title。 */
	rail: boolean;
}

const DOT: Record<LiveTone, string> = {
	live: "bg-accent",
	alert: "bg-risk-high",
	idle: "bg-text-4",
};

/**
 * 侧栏实时区：会话 / 本轮 / 最近输出 / 当前样本 / 注入五个点。
 *
 * 只画一颗圆点 + 三行文字，**不画左边那条强调竖线**：五个点的颜色本来就不同，
 * 再给每行一条竖边就成了五种配色，和导航的选中态冲突。
 * 语气只用圆点表达：live = 强调色，alert = 风险红，idle = 灰。
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

	if (rail) {
		return (
			<div className="flex flex-col items-center gap-1.5">
				{rows.map(row => (
					<span
						key={row.id}
						title={`${row.label} · ${row.value}${row.detail ? ` · ${row.detail}` : ""}`}
						data-row={row.id}
						data-tone={row.tone}
						className={`size-1.5 rounded-full ${DOT[row.tone]}`}
					/>
				))}
			</div>
		);
	}

	return (
		<div className="space-y-0.5">
			{rows.map(row => (
				<div
					key={row.id}
					title={`${row.label} · ${row.value}${row.detail ? ` · ${row.detail}` : ""}`}
					data-row={row.id}
					data-tone={row.tone}
					className="fb-row"
				>
					<span aria-hidden className={`mt-1 size-1.5 shrink-0 rounded-full ${DOT[row.tone]}`} />
					<div className="min-w-0 flex-1 leading-tight">
						<span className="truncate text-[10px] text-text-4">{row.label}</span>
						<span className="block truncate text-[11px] text-text" title={row.value}>{row.value}</span>
						{row.detail ? <span className="block truncate text-[9.5px] text-text-4" title={row.detail}>{row.detail}</span> : null}
					</div>
				</div>
			))}
		</div>
	);
}
