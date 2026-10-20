import { useTranslation } from "@astravia-org/plugin-sdk";
import { NAV, type PageId } from "../../state";
import { Icon } from "./icon";

export interface SidebarProps {
	page: PageId;
	onNavigate(page: PageId): void;
}

/**
 * 设计稿的 4 分组导航。
 *
 * 面板挂在宿主活动栏里，宽度由用户拖拽决定：默认收成 48px 图标轨，
 * 容器宽度过 720px 才展开成 224px 的文字侧栏。
 */
export function Sidebar({ page, onNavigate }: SidebarProps) {
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
								return (
									<button
										key={item.id}
										type="button"
										onClick={() => onNavigate(item.id)}
										title={label}
										aria-current={active ? "page" : undefined}
										className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] transition-colors ${
											active ? "bg-surface-active text-text" : "text-text-2 hover:bg-surface-hover hover:text-text"
										}`}
									>
										<Icon name={item.icon} className={`size-4 shrink-0 ${active ? "text-text" : "text-text-3"}`} />
										<span className="hidden min-w-0 truncate text-left @min-[720px]:block">{label}</span>
									</button>
								);
							})}
						</div>
					</div>
				))}
			</nav>

			<div className="border-t border-line-subtle p-1.5 @min-[720px]:p-3">
				<div className="flex items-center gap-2 rounded-md bg-surface-3 px-1.5 py-2 @min-[720px]:px-2.5">
					<span className="size-2 shrink-0 rounded-full bg-risk-low" />
					<div className="hidden min-w-0 leading-tight @min-[720px]:block">
						<div className="truncate text-[11.5px] text-text">{t("panel.offline.title")}</div>
						<div className="truncate text-[10px] text-text-4">{t("panel.offline.body")}</div>
					</div>
				</div>
			</div>
		</aside>
	);
}
