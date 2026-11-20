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

/**
 * 分组语气色。与 `style.css` 的 `.fb-step[data-tone]` 同一套语义：
 * 工作流是主路径（accent）、分析是判断（violet）、静态是证据（warn）、系统是维护（idle）。
 * 用色而不是用图标区分分组，是因为图标在 12px 下几乎认不出，颜色一眼就能定位。
 */
const GROUP_TONE: Record<string, { bar: string; text: string }> = {
	workflow: { bar: "bg-accent", text: "text-accent" },
	analysis: { bar: "bg-purple", text: "text-purple" },
	forensics: { bar: "bg-risk-medium", text: "text-risk-medium" },
	system: { bar: "bg-text-4", text: "text-text-3" },
};

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
 * 侧栏：分组导航 + 实时区。
 *
 * 视觉参照上游工作流示意图（`seep-kit/docs/images/render_workflow.html`）：
 * 每个分组一条强调色竖线、每个导航项一条 2px 的左强调条（选中时亮、未选中时透明），
 * 实时区用步骤盒（`.fb-step`）而不是「一行标签 + 一行值」——同一个语义在两种面板里长得一致。
 *
 * 宽度只有两个值，由 `rail` 决定：用户按了收起就得收起来。
 * 图标轨里每个入口都是同一个 32×32 方块、水平居中，图标才会落在同一条竖线上。
 */
export function Sidebar({ page, onNavigate, lab, status, timeline, rail, collapsed, onToggle, width, counts }: SidebarProps) {
	const { t } = useTranslation();
	const recent = timeline.spans.slice(0, rail ? 0 : 3);

	return (
		<aside
			data-testid="workbench-sidebar"
			data-rail={rail ? "true" : "false"}
			style={{ width: rail ? 48 : width }}
			className="flex shrink-0 flex-col overflow-hidden border-r border-line-subtle bg-surface-2 transition-[width] duration-150"
		>
			<div className={`flex items-center ${rail ? "flex-col gap-1.5 px-2 pb-2 pt-3" : "gap-2.5 px-4 pb-3 pt-4"}`}>
				<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-4 text-text-2">
					<Icon name="shield" className="size-4" />
				</div>
				{rail ? null : (
					<div className="min-w-0 flex-1 leading-tight">
						<div className="truncate text-[13px] font-semibold text-text">{t("plugin.name")}</div>
						<div className="truncate text-[10.5px] text-text-4">{t("panel.tagline")}</div>
					</div>
				)}
				<button
					type="button"
					onClick={onToggle}
					title={collapsed || rail ? t("sidebar.expand") : t("sidebar.collapse")}
					aria-label={collapsed || rail ? t("sidebar.expand") : t("sidebar.collapse")}
					aria-expanded={!rail}
					data-testid="sidebar-toggle"
					className={`flex size-6 shrink-0 items-center justify-center rounded-md text-text-4 transition-colors hover:bg-surface-hover hover:text-text ${
						rail ? "" : "ml-auto"
					}`}
				>
					<Icon name="chevron" className={`size-3.5 ${rail ? "" : "rotate-180"}`} />
				</button>
			</div>

			<nav className={`fb-scroll min-h-0 flex-1 overflow-y-auto py-2 ${rail ? "px-2" : "space-y-3 px-2"}`}>
				{NAV.map((group, groupIndex) => {
					const tone = GROUP_TONE[group.id] ?? GROUP_TONE.system;
					return (
						<div key={group.id}>
							{rail ? (
								groupIndex > 0 ? <div aria-hidden className="mx-auto my-1.5 h-px w-5 bg-line-subtle" /> : null
							) : (
								<div className="flex items-center gap-1.5 px-2 pb-1">
									<span aria-hidden className={`h-2.5 w-[2px] rounded-full ${tone.bar}`} />
									<span className="text-[9.5px] font-medium uppercase tracking-wider text-text-4">{t(`nav.group.${group.id}`)}</span>
								</div>
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
															active ? "bg-surface-active text-text" : "text-text-2 hover:bg-surface-hover hover:text-text"
														}`
													: `relative flex w-full items-center gap-2.5 rounded-md py-1.5 pl-2.5 pr-2 text-left text-[12.5px] transition-colors ${
															active ? "bg-surface-active text-text" : "text-text-2 hover:bg-surface-hover hover:text-text"
														}`
											}
										>
											{/* 左侧强调条：选中时亮成该组的语气色，未选中时只留一条极淡的底，避免行与行之间「漂」。 */}
											<span
												aria-hidden
												className={`absolute inset-y-1 left-0 w-[2px] rounded-full transition-colors ${active ? tone.bar : "bg-transparent"}`}
											/>
											<Icon name={item.icon} className={`size-4 shrink-0 ${active ? tone.text : "text-text-3"}`} />
											{rail ? null : <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
											{rail ? null : typeof count === "number" && count > 0 ? (
												<span className="fb-chip shrink-0">
													<b>{count}</b>
												</span>
											) : null}
											{dot ? (
												<span
													aria-hidden
													className={`absolute end-1 top-1 size-1.5 rounded-full ${DOT_TONE[dot]} ${dot === "live" ? "fb-pulse" : ""}`}
												/>
											) : null}
										</button>
									);
								})}
							</div>
						</div>
					);
				})}
			</nav>

			{recent.length > 0 ? (
				<div className="border-t border-line-subtle px-2 pb-2 pt-2" data-testid="sidebar-timeline">
					<div className="px-2 pb-1 text-[9.5px] font-medium uppercase tracking-wider text-text-4">{t("status.timeline")}</div>
					<div className="space-y-1">
						{recent.map(item => (
							<button key={item.id} type="button" onClick={() => onNavigate("activity")} className="w-full text-left" title={`${item.toolName} · ${formatDuration(item.ms)} · ${t(`status.span.${item.status}`)}`}>
								<span
									className="fb-step !py-1 !pl-2"
									data-tone={item.status === "error" ? "alert" : item.status === "running" ? "warn" : "ok"}
								>
									<span className="flex w-full items-center gap-1.5">
										<span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-text-2">{item.toolName}</span>
										<span className="fb-chip shrink-0 !px-1.5 !py-0">{formatDuration(item.ms)}</span>
									</span>
								</span>
							</button>
						))}
					</div>
				</div>
			) : null}

			<SidebarStatus status={status} rail={rail} />

			<div className={`border-t border-line-subtle ${rail ? "px-2 py-2" : "p-3"}`}>
				<div
					title={lab.enabled ? t("lab.onHint") : t("panel.offline.body")}
					data-tone={lab.enabled ? "ok" : "idle"}
					className={`fb-step ${rail ? "mx-auto !p-0 h-8 w-8 items-center justify-center" : ""}`}
				>
					{rail ? (
						<span className={`size-2 rounded-full ${lab.enabled ? "bg-risk-low fb-pulse" : "bg-text-4"}`} />
					) : (
						<>
							<span className="flex items-center gap-1.5">
								<span className={`size-2 shrink-0 rounded-full ${lab.enabled ? "bg-risk-low fb-pulse" : "bg-text-4"}`} />
								<span className="truncate text-[11.5px] text-text">{lab.enabled ? t("lab.on") : t("panel.offline.title")}</span>
							</span>
							<span className="truncate text-[10px] text-text-4">{lab.enabled ? t("lab.onHint") : t("panel.offline.body")}</span>
						</>
					)}
				</div>
			</div>
		</aside>
	);
}
