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
 * 容器窄到 640px 以下时**仍然竖着**，只是收成 44px 的图标栏。曾经试过折成顶上一条
 * 横向导航，结果是六个条目在窄行里换行、书卡与团队卡全被压扁——竖栏是这条界面的
 * 骨架，换个方向就不是它了。收窄时丢的是文字与书卡，留下的图标仍然一一点得到。
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
				className={`relative flex h-9 w-full shrink-0 items-center gap-2.5 rounded-control px-2.5 text-left text-body-sm @max-[640px]:justify-center @max-[640px]:gap-0 @max-[640px]:px-0 ${
					isActive ? "bg-raised font-semibold text-ink shadow-raise" : "text-ink-soft hover:bg-raised/70"
				}`}
			>
				<span className={`${icon} size-3.5 shrink-0 ${isActive ? "text-cinnabar" : "text-ink-faint"}`} />
				<span className="truncate @max-[640px]:hidden">{label}</span>
				{dot && live ? (
					<span className="ml-auto size-1.5 shrink-0 rounded-pill bg-cinnabar @max-[640px]:absolute @max-[640px]:right-1 @max-[640px]:top-1.5 @max-[640px]:ml-0" />
				) : null}
			</button>
		);
	};

	return (
		<aside className="flex w-[208px] shrink-0 flex-col overflow-hidden pb-1 pr-1 @max-[640px]:w-11 @max-[640px]:pr-0">
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
				<span className="px-2 text-micro-up font-semibold uppercase tracking-[0.08em] text-ink-faint @max-[640px]:hidden">
					{t("rail.current")}
				</span>

				<button
					type="button"
					onClick={() => onNavigate("book")}
					title={bookTitle}
					className="mt-2 flex w-full shrink-0 items-center gap-2.5 rounded-panel bg-raised p-2 text-left shadow-raise @max-[640px]:hidden"
				>
					<Cover mark={cover.mark} motif={cover.motif} layer={cover.layer} size="mini" />
					<div className="min-w-0 flex-1">
						<div className="truncate font-display text-body-sm font-semibold text-ink">{bookTitle}</div>
						<div className="mt-0.5 truncate text-[10px] text-ink-soft">{stage}</div>
						<div className="mt-1.5 h-[3px] overflow-hidden rounded-pill bg-inset">
							<div className="h-full rounded-pill bg-ink/70" style={{ width: `${percent}%` }} />
						</div>
					</div>
				</button>

				<nav className="mt-4 space-y-1 @max-[640px]:mt-2">
					{RAIL_WORKS.map((entry) => item(entry.page, t(entry.labelKey), entry.icon))}
				</nav>

				<span className="mt-4 px-2.5 text-micro-up font-semibold uppercase tracking-[0.08em] text-ink-faint @max-[640px]:hidden">
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
						className="block w-full rounded-panel bg-raised p-2.5 text-left shadow-raise @max-[640px]:hidden"
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
					className="flex h-8 w-full shrink-0 items-center justify-center gap-1.5 rounded-control border border-line-strong text-[10px] font-medium text-ink transition-colors hover:bg-raised @max-[640px]:px-0"
				>
					<span className="icon-[lucide--panel-right-open] size-3 shrink-0" />
					<span className="truncate @max-[640px]:hidden">{t("rail.revealTeam")}</span>
				</button>

				<div className="flex items-center gap-2 px-1 text-[10px] text-ink-faint @max-[640px]:hidden">
					<span className={`size-1 shrink-0 rounded-pill ${credential.ok ? "bg-pass" : "bg-fail"}`} />
					<span className="truncate">{credential.label}</span>
				</div>
			</div>
		</aside>
	);
}
