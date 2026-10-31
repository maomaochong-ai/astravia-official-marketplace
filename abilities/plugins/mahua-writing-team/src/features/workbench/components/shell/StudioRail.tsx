import { useTranslator } from "../../hooks/use-translator";
import type { CoverSeed } from "../../workbench-model";
import { RAIL_CRAFT, RAIL_WORKS, type WorkbenchPage } from "../../workbench-pages";
import { Cover } from "./Cover";

export interface StudioRailProps {
	active?: WorkbenchPage;
	bookTitle: string;
	cover: CoverSeed;
	/** 「第三弧 · 第 26 章起草中」那行：由书页算出来，不在窄栏里拼。 */
	stage: string;
	percent: number;
	/** 侧栏团队当前在写哪一章；没人在写就传 null，整张卡不出现。 */
	writing: { writer: string; elapsed: string; line: string } | null;
	/** 运行台有没有还没读的事件，用来点那个小红点。 */
	live: boolean;
	credential: { ok: boolean; label: string };
	/** 用户手动收成了图标列；与容器变窄是两件事，视觉走同一套。 */
	collapsed: boolean;
	onToggleCollapsed(): void;
	onNavigate(page: WorkbenchPage): void;
	onRevealTeam(): void;
}

/**
 * 窄栏：从上到下把「在写的这本 → 导航 → 侧栏团队」排到底。
 *
 * 三段的分工是刻意的。书卡钉在最上面——它是这一页的主题，不该和导航抢中段；
 * 导航随后固定展开；`mt-auto` 那一组压在底边（写作者状态、跳侧栏的门、凭证），
 * 因为它们回答的是「现在有没有人在写」「我还能不能改」，扫视时应该落在同一个角落。
 *
 * 中段可滚、底部不可滚：内容多到放不下时收缩的是导航，不是那扇门与凭证行——
 * 一条 208px 的竖栏滚起来，用户最先丢的就是最下面的入口。
 *
 * 收成图标列有两条路：容器窄到 640px 以下自动收（`@max-[640px]`），或者用户自己按底部的
 * 折叠键。两条路必须长得一样，所以文字的隐藏交给父级的 `data-collapsed`（见 style.css），
 * 宽度也由它接管；`@max-[640px]` 只管自动那一路。丢的只有文字与书卡，图标一个不丢。
 *
 * 凭证那一行是可点的：它不只是「当前有没有激活」的读数，也是进激活页的入口。
 * 收起时它只剩那颗圆点，但仍然是同一枚按钮——否则窄栏里就再也走不到那一页。
 */
export function StudioRail({
	active,
	bookTitle,
	cover,
	stage,
	percent,
	writing,
	live,
	credential,
	collapsed,
	onToggleCollapsed,
	onNavigate,
	onRevealTeam,
}: StudioRailProps) {
	const t = useTranslator();

	const item = (page: WorkbenchPage, label: string, icon: string, dot = false) => {
		const isActive = page === active;
		return (
			<button
				key={page}
				type="button"
				onClick={() => onNavigate(page)}
				aria-current={isActive ? "page" : undefined}
				title={label}
				className={`mahua-rail-item relative flex h-9 w-full shrink-0 items-center gap-2.5 rounded-control px-2.5 text-left text-body-sm @max-[640px]:justify-center @max-[640px]:gap-0 @max-[640px]:px-0 ${
					isActive ? "bg-raised font-semibold text-ink shadow-raise" : "text-ink-soft hover:bg-raised/70"
				}`}
			>
				<span className={`${icon} size-3.5 shrink-0 ${isActive ? "text-cinnabar" : "text-ink-faint"}`} />
				<span className="mahua-rail-label truncate @max-[640px]:hidden">{label}</span>
				{dot && live ? (
					<span className="ml-auto size-1.5 shrink-0 rounded-pill bg-cinnabar" />
				) : null}
			</button>
		);
	};

	return (
		<aside
			className="mahua-rail flex w-[208px] shrink-0 flex-col overflow-hidden pb-1 pr-1 @max-[640px]:w-11 @max-[640px]:pr-0"
			data-collapsed={collapsed ? "true" : "false"}
		>
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
				<span className="mahua-rail-block px-2 text-micro-up @max-[640px]:hidden font-semibold uppercase tracking-[0.08em] text-ink-faint">
					{t("rail.current")}
				</span>

				<button
					type="button"
					onClick={() => onNavigate("book")}
					title={bookTitle}
					className="mahua-rail-block mt-2 flex w-full shrink-0 items-center gap-2.5 rounded-panel bg-raised p-2 text-left shadow-raise @max-[640px]:hidden"
				>
					<Cover mark={cover.mark} motif={cover.motif} layer={cover.layer} art={cover.art} size="mini" />
					<div className="min-w-0 flex-1">
						<div className="truncate font-display text-body-sm font-semibold text-ink">{bookTitle}</div>
						<div className="mt-0.5 truncate text-[10px] text-ink-soft">{stage}</div>
						<div className="mt-1.5 h-[3px] overflow-hidden rounded-pill bg-inset">
							<div className="h-full rounded-pill bg-ink/70" style={{ width: `${percent}%` }} />
						</div>
					</div>
				</button>

				<nav className="mt-4 space-y-1">
					{RAIL_WORKS.map((entry) => item(entry.page, t(entry.labelKey), entry.icon))}
				</nav>

				<span className="mahua-rail-block mt-4 px-2.5 text-micro-up @max-[640px]:hidden font-semibold uppercase tracking-[0.08em] text-ink-faint">
					{t("rail.craft")}
				</span>
				<nav className="mt-2 space-y-1">
					{RAIL_CRAFT.map((entry) => item(entry.page, t(entry.labelKey), entry.icon, entry.page === "console"))}
				</nav>
			</div>

			<div className="mt-3 shrink-0 space-y-2">
				{writing ? (
					<button
						type="button"
						onClick={() => onNavigate("console")}
						className="mahua-rail-block block w-full rounded-panel bg-raised p-2.5 text-left shadow-raise @max-[640px]:hidden"
					>
						<div className="flex items-center gap-1.5">
							<span className="size-1.5 rounded-pill bg-cinnabar" />
							<span className="truncate text-micro-up font-semibold tracking-[0.08em] text-cinnabar-ink">
								{t("rail.writing", { writer: writing.writer })}
							</span>
							<span className="ml-auto shrink-0 font-mono text-[10px] text-ink-faint">{writing.elapsed}</span>
						</div>
						<p className="mt-1 truncate text-[11px] leading-4 text-ink">{writing.line}</p>
						<p className="mt-0.5 text-[10px] leading-4 text-ink-faint">{t("rail.readonlyHint")}</p>
					</button>
				) : null}

				<button
					type="button"
					onClick={onRevealTeam}
					title={t("rail.revealTeam")}
					className="mahua-rail-item flex h-8 w-full shrink-0 items-center justify-center gap-1.5 rounded-control border border-line-strong text-[10px] font-medium text-ink transition-colors hover:bg-raised @max-[640px]:px-0"
				>
					<span className="icon-[lucide--panel-right-open] size-3 shrink-0" />
					<span className="mahua-rail-label truncate @max-[640px]:hidden">{t("rail.revealTeam")}</span>
				</button>

				<button
					type="button"
					onClick={() => onNavigate("activation")}
					title={`${credential.label} · ${t("rail.credentialOpen")}`}
					aria-label={`${credential.label} · ${t("rail.credentialOpen")}`}
					className="mahua-rail-item flex h-7 w-full shrink-0 items-center gap-2 rounded-control px-1 text-[10px] text-ink-faint transition-colors hover:bg-raised hover:text-ink @max-[640px]:justify-center @max-[640px]:px-0"
				>
					<span className={`size-1 shrink-0 rounded-pill ${credential.ok ? "bg-pass" : "bg-fail"}`} />
					<span className="mahua-rail-label truncate @max-[640px]:hidden">{credential.label}</span>
					<span className="mahua-rail-label icon-[lucide--chevron-right] ml-auto size-3 shrink-0 @max-[640px]:hidden" />
				</button>

				<button
					type="button"
					onClick={onToggleCollapsed}
					title={collapsed ? t("rail.expandRail") : t("rail.collapseRail")}
					aria-label={collapsed ? t("rail.expandRail") : t("rail.collapseRail")}
					aria-expanded={!collapsed}
					className="mahua-rail-item flex h-7 w-full shrink-0 items-center gap-2 rounded-control px-1 text-[10px] text-ink-faint transition-colors hover:bg-raised hover:text-ink @max-[640px]:justify-center @max-[640px]:px-0"
				>
					<span
						className={`${
							collapsed ? "icon-[lucide--panel-left-open]" : "icon-[lucide--panel-left-close]"
						} size-3 shrink-0`}
					/>
					<span className="mahua-rail-label truncate @max-[640px]:hidden">{t("rail.collapseRail")}</span>
				</button>
			</div>
		</aside>
	);
}
