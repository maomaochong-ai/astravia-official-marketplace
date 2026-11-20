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
	/** 收成图标轨：用户点了收起，或面板本身窄到放不下文字。 */
	rail: boolean;
	/** 用户的显式选择，只用于按钮的方向与提示。 */
	collapsed: boolean;
	onToggle(): void;
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
 * 设计稿的 4 分组导航。
 *
 * 宽度只有两个值，由 `rail` 决定而不是由容器查询决定：用户按了收起就得收起来，
 * 面板窄到 400px 时也必须收起来——两件事都不能靠同一个断点表达。
 * 图标轨里每个入口都是同一个 32×32 的方块、水平居中：宽度一致、左内边距一致，
 * 图标才会落在同一条竖线上；以前各行 padding 不同（px-0 / px-2 / p-1.5），
 * 折叠后就是一眼可见的错位。
 */
export function Sidebar({ page, onNavigate, lab, status, timeline, rail, collapsed, onToggle }: SidebarProps) {
	const { t } = useTranslation();
	const recent = timeline.spans.slice(0, rail ? 0 : 3);

	return (
		<aside
			data-testid="workbench-sidebar"
			data-rail={rail ? "true" : "false"}
			className={`flex shrink-0 flex-col border-r border-line-subtle bg-surface-2 transition-[width] duration-150 ${rail ? "w-12" : "w-56"}`}
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

			<nav className={`fb-scroll min-h-0 flex-1 overflow-y-auto py-2 ${rail ? "px-2" : "space-y-4 px-2"}`}>
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
												: `relative flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors ${
														active ? "bg-surface-active text-text" : "text-text-2 hover:bg-surface-hover hover:text-text"
													}`
										}
									>
										<Icon name={item.icon} className={`size-4 shrink-0 ${active ? "text-text" : "text-text-3"}`} />
										{rail ? null : <span className="min-w-0 truncate text-left">{label}</span>}
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
				))}
			</nav>

			{recent.length > 0 ? (
				<div className="border-t border-line-subtle px-2 pb-2 pt-2" data-testid="sidebar-timeline">
					<div className="px-2 pb-1 text-[9.5px] font-medium uppercase tracking-wider text-text-4">{t("status.timeline")}</div>
					<div className="space-y-0.5">
						{recent.map(item => (
							<button
								key={item.id}
								type="button"
								onClick={() => onNavigate("activity")}
								title={`${item.toolName} · ${formatDuration(item.ms)} · ${t(`status.span.${item.status}`)}`}
								className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-surface-hover"
							>
								<span
									className={`size-1.5 shrink-0 rounded-full ${
										item.status === "error" ? "bg-risk-high" : item.status === "running" ? "bg-risk-medium fb-pulse" : "bg-risk-low"
									}`}
								/>
								<span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-text-2">{item.toolName}</span>
								<span className="shrink-0 font-mono text-[9.5px] text-text-4">{formatDuration(item.ms)}</span>
							</button>
						))}
					</div>
				</div>
			) : null}

			<SidebarStatus status={status} rail={rail} />

			<div className={`border-t border-line-subtle ${rail ? "px-2 py-2" : "p-3"}`}>
				<div
					title={lab.enabled ? t("lab.onHint") : t("panel.offline.body")}
					className={`flex items-center justify-center gap-2 rounded-md ${rail ? "h-8 w-8 mx-auto" : "px-2.5 py-2"} ${
						lab.enabled ? "bg-risk-low/10" : "bg-surface-3"
					}`}
				>
					<span className={`size-2 shrink-0 rounded-full ${lab.enabled ? "bg-risk-low fb-pulse" : "bg-text-4"}`} />
					{rail ? null : (
						<div className="min-w-0 leading-tight">
							<div className="truncate text-[11.5px] text-text">{lab.enabled ? t("lab.on") : t("panel.offline.title")}</div>
							<div className="truncate text-[10px] text-text-4">{lab.enabled ? t("lab.onHint") : t("panel.offline.body")}</div>
						</div>
					)}
				</div>
			</div>
		</aside>
	);
}
