/**
 * 侧栏实时区：会话 / 本轮 / 最近输出 / 当前样本 / 注入五个点。
 *
 * 只画一颗圆点 + 三行文字，**不画左边那条强调竖线**：五个点的颜色本来就不同，
 * 再给每行一条竖线就成了五种配色，和导航的选中态冲突。
 * 语气只用圆点表达：live = 强调色，alert = 风险红，idle = 灰。
 *
 * 两条被这一版改过的地方：
 *
 *   1. **value 与 detail 不再单行截断。** 侧栏只有 200 多像素，`truncate` 之后
 *      「刚才跑出了什么」这一行只剩两三个字 —— 而那一行正是这个区域存在的理由。
 *      现在 value 换行、detail 最多两行，宁可让区域高一点。
 *   2. **行可点。** 这五行里有三行天然对应一个页面（输出→活动、样本→样本页、
 *      注入→提示词）。只显示不给入口时，用户看完还得自己去导航里找。
 */

import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PageId } from "../../state";
import type { LiveStatus, LiveTone } from "../../live-status";

export interface SidebarStatusProps {
	status: LiveStatus;
	/** 图标轨里只留语气点，文字全走 title。 */
	rail: boolean;
	/** 点一行去哪里；不给就只是只读信息。 */
	onNavigate?(page: PageId): void;
}

const DOT: Record<LiveTone, string> = {
	live: "bg-accent",
	alert: "bg-risk-high",
	idle: "bg-text-4",
};

export function SidebarStatus({ status, rail, onNavigate }: SidebarStatusProps) {
	const { t } = useTranslation();
	const { session, run, sample, inject, output } = status;

	const rows: {
		id: string;
		tone: LiveTone;
		label: string;
		value: string;
		detail: string | null;
		/** 这一行讲的东西在哪一页。 */
		page?: PageId;
	}[] = [
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
			page: "activity",
		},
		{
			id: "output",
			tone: output.tone,
			label: t("status.output"),
			value: output.toolId ?? t("status.output.none"),
			detail: output.summary ? [output.summary, ...output.hints].join(" · ") : null,
			page: "activity",
		},
		{
			id: "sample",
			tone: sample?.tone ?? "idle",
			label: t("status.sample"),
			value: sample ? sample.name : t("status.sample.none"),
			detail: sample ? t("status.sample.risk", { score: sample.score, grade: sample.grade }) : null,
			page: sample ? "samples" : undefined,
		},
		{
			id: "inject",
			tone: inject.tone,
			label: t("status.inject"),
			value: inject.name ?? t("status.inject.none"),
			detail: null,
			page: "prompts",
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
		<div className="space-y-0.5" data-testid="sidebar-status-rows">
			{rows.map(row => {
				const body = (
					<>
						<span aria-hidden className={`mt-1 size-1.5 shrink-0 rounded-full ${DOT[row.tone]}`} />
						<div className="min-w-0 flex-1 leading-tight">
							<span className="text-[10.5px] text-text-4">{row.label}</span>
							{/* value 换行：样本名、提示词名、工具名都可能是长串。 */}
							<span className="fb-wrap block text-[11.5px] text-text">{row.value}</span>
							{/* detail 两行封顶，全文留在 title 里：侧栏太窄，硬撑会把下一行挤没。 */}
							{row.detail ? (
								<span className="fb-wrap line-clamp-2 block text-[9.5px] leading-snug text-text-4" title={row.detail}>
									{row.detail}
								</span>
							) : null}
						</div>
						{/* 可跳的行给一枚指示，否则用户不知道这里能点。 */}
						{row.page && onNavigate ? <span className="mt-0.5 shrink-0 text-[9.5px] text-text-4">›</span> : null}
					</>
				);

				return row.page && onNavigate ? (
					<button
						key={row.id}
						type="button"
						data-row={row.id}
						data-tone={row.tone}
						onClick={() => onNavigate(row.page as PageId)}
						title={t("status.jump", { page: t(`nav.${row.page}`) })}
						className="fb-row w-full text-left"
					>
						{body}
					</button>
				) : (
					<div key={row.id} data-row={row.id} data-tone={row.tone} className="fb-row">
						{body}
					</div>
				);
			})}
		</div>
	);
}
