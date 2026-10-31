import { Cover } from "./Cover";
import { RAIL_CRAFT, RAIL_WORKS, type WorkbenchPage } from "../../workbench-pages";
import type { CoverSeed } from "../../workbench-model";
import { useTranslator } from "../../hooks/use-translator";

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
 * 窄栏：作品导航 + 一条「侧栏里谁在写」。
 * 不做派活、不做门禁；侧栏对话是团队的地盘，这里只放一个跳过去的门。
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
				className={`flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-body-sm ${
					isActive ? "bg-raised font-semibold text-ink shadow-raise" : "text-ink-soft hover:bg-raised/70"
				}`}
			>
				<span className={`${icon} size-3.5 ${isActive ? "text-cinnabar" : "text-ink-faint"}`} />
				{label}
				{dot && live ? <span className="ml-auto size-1.5 rounded-pill bg-cinnabar" /> : null}
			</button>
		);
	};

	return (
		<aside className="flex w-[208px] shrink-0 flex-col pb-1 pr-1">
			<span className="px-2 text-micro-up font-semibold uppercase tracking-[0.08em] text-ink-faint">
				{t("rail.current")}
			</span>
			<button
				type="button"
				onClick={() => onNavigate("book")}
				className="mt-2 flex items-center gap-2.5 rounded-panel bg-raised p-2 text-left shadow-raise"
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

			<nav className="mt-4 space-y-1">
				{RAIL_WORKS.map((entry) => item(entry.page, t(entry.labelKey), entry.icon))}
			</nav>

			<span className="mt-4 px-2.5 text-micro-up font-semibold uppercase tracking-[0.08em] text-ink-faint">
				{t("rail.craft")}
			</span>
			<nav className="mt-2 space-y-1">
				{RAIL_CRAFT.map((entry) => item(entry.page, t(entry.labelKey), entry.icon, entry.page === "console"))}
			</nav>

			<div className="mt-auto space-y-2">
				{writing && (
					<button
						type="button"
						onClick={() => onNavigate("console")}
						className="block w-full rounded-panel bg-raised p-2.5 text-left shadow-raise"
					>
						<div className="flex items-center gap-1.5">
							<span className="size-1.5 rounded-pill bg-cinnabar" />
							<span className="text-[10px] font-semibold tracking-[0.08em] text-cinnabar-ink">
								{t("rail.writing", { writer: writing.writer })}
							</span>
							<span className="ml-auto font-mono text-[10px] text-ink-faint">{writing.elapsed}</span>
						</div>
						<p className="mt-1 truncate text-[11px] leading-4 text-ink">{writing.line}</p>
						<p className="mt-0.5 text-[10px] leading-4 text-ink-faint">{t("rail.readonlyHint")}</p>
					</button>
				)}

				<button
					type="button"
					onClick={onRevealTeam}
					className="flex h-8 w-full items-center justify-center gap-1.5 rounded-control border border-line-strong text-[10px] font-medium text-ink transition-colors hover:bg-raised"
				>
					<span className="icon-[lucide--panel-right-open] size-3" />
					{t("rail.revealTeam")}
				</button>

				<div className="flex items-center gap-2 px-1 text-[10px] text-ink-faint">
					<span className={`size-1 rounded-pill ${credential.ok ? "bg-pass" : "bg-fail"}`} />
					{credential.label}
				</div>
			</div>
		</aside>
	);
}
