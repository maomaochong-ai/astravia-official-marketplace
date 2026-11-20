import { useTranslation } from "@astravia-org/plugin-sdk";
import type { LabState } from "../../../../domain/lab-mode";
import type { LiveStatus } from "../../live-status";
import { NAV, type PageId } from "../../state";
import { formatDuration, type Timeline } from "../../timeline";
import { Icon } from "./icon";
import { SidebarStatus } from "./sidebar-status";

export interface SidebarProps {
	page: PageId;
	onNavigate(page: PageId): void;
	lab: LabState;
	status: LiveStatus;
	timeline: Timeline;
	/** 收成图标轨：用户点了收起。 */
	rail: boolean;
	/** 用户的显式选择，只用于按钮的方向与提示。 */
	collapsed: boolean;
	onToggle(): void;
	/** 展开时的宽度（像素），由拖拽把手给出。 */
	width: number;
	/** 导航项右侧的计数：有多少东西可读。缺省不显示。 */
	counts?: Partial<Record<PageId, number>>;
}

/** 导航项的小圆点：只在「有东西在动」或「有东西要看」时出现。 */
function navDot(id: PageId, status: LiveStatus): "live" | "alert" | null {
	if (id === "activity") {
		if (status.run.tone === "alert") return "alert";
		if (status.session.streaming || status.run.active) return "live";
		return null;
	}
	if (id === "samples" && status.sample?.tone === "alert") return "alert";
	return null;
}

const DOT_TONE: Record<"live" | "alert", string> = {
	live: "bg-risk-low",
	alert: "bg-risk-high",
};

/**
 * 侧栏：分组导航 + 可折叠的实时区。
 *
 * 三条约束，都是上一版被指出来的问题：
 *
 *  1. **不画装饰竖线**。分组标题旁那条彩条、状态行左边那条 3px 边、底部方块左边那条边，
 *     三处颜色各不相同，看起来像三套设计。现在分组只用小号灰字，选中态用底色 + 强调色文字。
 *  2. **状态不常驻**。会话 / 本轮 / 输出 / 样本 / 注入五项 + 时间线默认折叠成一行摘要，
 *     点开才占高度 —— 面板矮的时候它们会把导航挤没。
 *  3. **lab 只在顶栏**。底部那块重复的方块整块删掉；顶栏是唯一的开关位置。
 *
 * 配色只剩两级：中性（surface / text 阶）与一个强调色（accent）+ 风险三色（只用于圆点）。
 */
export function Sidebar({ page, onNavigate, status, timeline, rail, collapsed, onToggle, width, counts }: SidebarProps) {
	const { t } = useTranslation();
	const recent = timeline.spans.slice(0, rail ? 0 : 3);
	const liveCount = [status.session, status.run, status.output, status.sample, status.inject].filter(item => item?.tone !== "idle").length;

	return (
		<aside
			data-testid="workbench-sidebar"
			data-rail={rail ? "true" : "false"}
			style={{ width: rail ? 48 : width }}
			className="flex shrink-0 flex-col overflow-hidden border-r border-line-subtle bg-surface-2 transition-[width] duration-150"
		>
			<div className={`flex items-center ${rail ? "flex-col gap-1.5 px-2 pb-2 pt-3" : "gap-2.5 px-3 pb-2.5 pt-3"}`}>
				<div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-4 text-text-2">
					<Icon name="shield" className="size-4" />
				</div>
				{rail ? null : (
					<div className="min-w-0 flex-1 leading-tight">
						<div className="truncate text-[12.5px] font-semibold text-text">{t("plugin.name")}</div>
						<div className="truncate text-[10px] text-text-4">{t("panel.tagline")}</div>
					</div>
				)}
				<button
					type="button"
					onClick={onToggle}
					title={collapsed || rail ? t("sidebar.expand") : t("sidebar.collapse")}
					aria-label={collapsed || rail ? t("sidebar.expand") : t("sidebar.collapse")}
					aria-expanded={!rail}
					data-testid="sidebar-toggle"
					className={`flex size-6 shrink-0 items-center justify-center rounded-md text-text-4 transition-colors hover:bg-surface-hover hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
						rail ? "" : "ml-auto"
					}`}
				>
					<Icon name="chevron" className={`size-3.5 ${rail ? "" : "rotate-180"}`} />
				</button>
			</div>

			<nav className={`fb-scroll min-h-0 flex-1 overflow-y-auto py-1.5 ${rail ? "px-2" : "space-y-2.5 px-2"}`}>
				{NAV.map((group, groupIndex) => (
					<div key={group.id}>
						{rail ? (
							groupIndex > 0 ? <div aria-hidden className="mx-auto my-1.5 h-px w-5 bg-line-subtle" /> : null
						) : (
							<div className="px-2 pb-1 text-[9.5px] font-medium uppercase tracking-wider text-text-4">{t(`nav.group.${group.id}`)}</div>
						)}
						<div className={rail ? "space-y-1" : "space-y-0.5"}>
							{group.items.map(item => {
								const active = item.id === page;
								const label = t(`nav.${item.id}`);
								const dot = navDot(item.id, status);
								const count = counts?.[item.id];
								return (
									<button
										key={item.id}
										type="button"
										onClick={() => onNavigate(item.id)}
										title={label}
										aria-label={dot ? `${label} · ${t(`nav.dot.${dot}`)}` : label}
										aria-current={active ? "page" : undefined}
										data-dot={dot ?? undefined}
										data-nav-id={item.id}
										className={
											rail
												? `relative mx-auto flex size-8 items-center justify-center rounded-md transition-colors ${
														active ? "bg-surface-4 text-text" : "text-text-2 hover:bg-surface-hover hover:text-text"
													}`
												: `relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
														active ? "bg-surface-4 font-medium text-text" : "text-text-2 hover:bg-surface-hover hover:text-text"
													}`
										}
									>
										<Icon name={item.icon} className={`size-4 shrink-0 ${active ? "text-accent" : "text-text-3"}`} />
										{rail ? null : <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
										{rail ? null : typeof count === "number" && count > 0 ? (
											<span className="shrink-0 font-mono text-[9.5px] tabular-nums text-text-4">{count}</span>
										) : null}
										{dot ? (
											<span
												aria-hidden
											className={`absolute end-1 top-1/2 size-1.5 -translate-y-1/2 rounded-full ${DOT_TONE[dot]} ${dot === "live" ? "fb-pulse" : ""}`}
											/>
										) : null}
									</button>
								);
							})}
						</div>
					</div>
				))}
			</nav>
			{rail ? (
				<div className="border-t border-line-subtle px-2 py-2">
					<SidebarStatus status={status} rail />
				</div>
			) : (
				<div className="shrink-0 border-t border-line-subtle">
					{/* 实时区折叠成一行摘要：默认收起，面板矮的时候导航才有空间。 */}
					<details className="fb-collapse" data-testid="sidebar-status">
						<summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[10.5px] text-text-3 transition-colors hover:bg-surface-hover hover:text-text">
							<Icon name="chevron" className="size-3 shrink-0 text-text-4" />
							<span className="min-w-0 flex-1 truncate">{t("status.title")}</span>
							{liveCount > 0 ? <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-accent">{liveCount}</span> : null}
						</summary>
						<div className="px-2 pb-1.5">
							<SidebarStatus status={status} rail={false} />
						</div>
					</details>

					{recent.length > 0 ? (
						<details className="fb-collapse border-t border-line-subtle">
							<summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[10.5px] text-text-3 transition-colors hover:bg-surface-hover hover:text-text">
								<Icon name="chevron" className="size-3 shrink-0 text-text-4" />
								<span className="min-w-0 flex-1 truncate">{t("status.timeline")}</span>
								<span className="shrink-0 font-mono text-[9.5px] tabular-nums text-text-4">{recent.length}</span>
							</summary>
							<ul className="px-1.5 pb-1.5">
								{recent.map(item => (
									<li key={item.id}>
										<button
											type="button"
											onClick={() => onNavigate("activity")}
											title={`${item.toolName} · ${formatDuration(item.ms)} · ${t(`status.span.${item.status}`)}`}
											className="fb-row w-full text-left"
										>
											<span
												aria-hidden
												className={`size-1.5 shrink-0 rounded-full ${
													item.status === "error" ? "bg-risk-high" : item.status === "running" ? "bg-risk-medium" : "bg-risk-low"
												}`}
											/>
											<span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-text-2">{item.toolName}</span>
											<span className="shrink-0 font-mono text-[9.5px] tabular-nums text-text-4">{formatDuration(item.ms)}</span>
										</button>
									</li>
								))}
							</ul>
						</details>
					) : null}
				</div>
			)}
		</aside>
	);
}
