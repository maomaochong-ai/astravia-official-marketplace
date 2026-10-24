import { useTranslation } from "@astravia-org/plugin-sdk";
import type { LabState } from "../../../../domain/lab-mode";
import type { LiveStatus } from "../../live-status";
import { NAV, type PageId } from "../../state";
import { Icon } from "./icon";
import { SidebarStatus } from "./sidebar-status";

export interface SidebarProps {
	page: PageId;
	onNavigate(page: PageId): void;
	lab: LabState;
	status: LiveStatus;
}

/**
 * 设计稿的 4 分组导航。
 *
 * 面板挂在宿主活动栏里，宽度由用户拖拽决定：默认收成 48px 图标轨，
 * 容器宽度过 720px 才展开成 224px 的文字侧栏。
 */

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
export function Sidebar({ page, onNavigate, lab, status }: SidebarProps) {
	const { t } = useTranslation();
	return (
		<aside className="flex w-12 shrink-0 flex-col border-r border-line bg-surface-2 @min-[720px]:w-56">
			<div className="flex items-center gap-2.5 px-2 pb-2 pt-3 @min-[720px]:px-4 @min-[720px]:pb-3 @min-[720px]:pt-4">
				<div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-4 text-text-2">
					<Icon name="shield" className="size-4" />
				</div>
				<div className="hidden min-w-0 leading-tight @min-[720px]:block">
					<div className="truncate text-[13px] font-semibold text-text">{t("plugin.name")}</div>
					<div className="truncate text-[10.5px] text-text-4">{t("panel.tagline")}</div>
				</div>
			</div>

			<nav className="fb-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-1.5 py-2 @min-[720px]:px-2">
				{NAV.map(group => (
					<div key={group.id}>
						<div className="hidden px-2 pb-1 text-[9.5px] font-medium uppercase tracking-wider text-text-4 @min-[720px]:block">{t(`nav.group.${group.id}`)}</div>
						<div className="space-y-0.5">
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
										aria-label={dot ? `${label} · ${t(`nav.dot.${dot}`)}` : undefined}
										aria-current={active ? "page" : undefined}
										data-dot={dot ?? undefined}
										className={`relative flex w-full items-center justify-center gap-2.5 rounded-md px-0 py-1.5 text-[12.5px] transition-colors @min-[720px]:justify-start @min-[720px]:px-2 ${
											active ? "bg-surface-active text-text" : "text-text-2 hover:bg-surface-hover hover:text-text"
										}`}
									>
										<Icon name={item.icon} className={`size-4 shrink-0 ${active ? "text-text" : "text-text-3"}`} />
										<span className="hidden min-w-0 truncate text-left @min-[720px]:block">{label}</span>
										{dot ? (
											<span aria-hidden className={`absolute end-1 top-1 size-1.5 rounded-full ${DOT_TONE[dot]} ${dot === "live" ? "fb-pulse" : ""}`} />
										) : null}
									</button>
								);
							})}
						</div>
					</div>
				))}
			</nav>

			<SidebarStatus status={status} />

			<div className="border-t border-line-subtle p-1.5 @min-[720px]:p-3">
				<div className={`flex items-center justify-center gap-2 rounded-md px-0 py-2 @min-[720px]:justify-start @min-[720px]:px-2.5 ${lab.enabled ? "bg-risk-low/10" : "bg-surface-3"}`}>
					<span className={`size-2 shrink-0 rounded-full ${lab.enabled ? "bg-risk-low fb-pulse" : "bg-text-4"}`} />
					<div className="hidden min-w-0 leading-tight @min-[720px]:block">
						<div className="truncate text-[11.5px] text-text">{lab.enabled ? t("lab.on") : t("panel.offline.title")}</div>
						<div className="truncate text-[10px] text-text-4">{lab.enabled ? t("lab.onHint") : t("panel.offline.body")}</div>
					</div>
				</div>
			</div>
		</aside>
	);
}
