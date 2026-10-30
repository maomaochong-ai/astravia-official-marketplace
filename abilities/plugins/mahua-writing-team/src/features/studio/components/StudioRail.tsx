import { useTranslation } from "@astravia-org/plugin-sdk";
import type { NovelBook } from "../../../domain/novel-types.js";
import { BookCover } from "../../library/components/BookCover.js";
import { progressPercent } from "../../library/bookshelf-model.js";

export interface StudioRailItem {
	/** 稳定标识：路由层用它决定高亮，不用文案。 */
	key: string;
	label: string;
	/** iconify class，例如 `icon-[solar--library-linear]`。 */
	icon: string;
	active: boolean;
	onSelect(): void;
	/** 分组标题（写作 / 整理）：只在展开态出现，图标态不占行。 */
	group?: string;
}

interface StudioRailProps {
	items: StudioRailItem[];
	book: NovelBook | null;
	credentialActive: boolean;
}

const ROW =
	"flex h-9 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-[13px] transition-colors lg:px-2.5 justify-center lg:justify-start";

/**
 * 左侧导航栏（设计稿 `StudioRail`，ADR 0027 §2）。
 *
 * 设计稿是 208px 的固定栏，标签页实宽只有 400–1000px：400px 里切掉 208 只剩 192px 正文，
 * 所以窄面板降级成 44px 的图标栏（每格带 `title`，仍可点），`lg` 以上才展开成 188px 的文字栏。
 * 「在写的这本」卡片只在展开态出现——它是要读的，不是要点的。
 *
 * 设计稿底部那块「写作者 正在写 · 2m 14s」不复刻：插件拿不到团队的计时，
 * 写上去就是假数；这里只留凭证状态，它是能校验的真事实。
 */
export function StudioRail({ items, book, credentialActive }: StudioRailProps) {
	const { t } = useTranslation();
	const percent = book ? progressPercent({ committedCount: book.progress.committedCount, targetChapters: book.targetChapters }) : 0;

	return (
		<aside className="hidden w-11 shrink-0 flex-col gap-1 pb-1 sm:flex lg:w-[188px]">
			{book ? (
				<div className="hidden flex-col gap-2 rounded-[13px] bg-card p-2 shadow-xs lg:flex">
					<div className="flex items-center gap-2.5">
						<BookCover seed={book.id} title={book.title} size="mini" />
						<span className="flex min-w-0 flex-col gap-0.5">
							<span className="truncate text-[13px] font-semibold text-foreground">{book.title}</span>
							<span className="truncate text-[10px] text-muted-foreground">
								{t("rail.now", { chapter: book.progress.currentChapter })}
							</span>
						</span>
					</div>
					<span className="block h-[3px] w-full overflow-hidden rounded-full bg-muted">
						<span className="block h-full rounded-full bg-foreground/70" style={{ width: `${percent}%` }} />
					</span>
				</div>
			) : null}

			<nav className="flex flex-col gap-1 pt-1">
				{items.map((item, position) => {
					const head = item.group && item.group !== items[position - 1]?.group ? item.group : null;
					return (
						<div key={item.key} className="flex flex-col">
							{head ? (
								<span className="hidden px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 lg:block">
									{head}
								</span>
							) : null}
							<button
								type="button"
								title={item.label}
								aria-current={item.active ? "page" : undefined}
								onClick={item.onSelect}
								className={`${ROW} ${
									item.active
										? "bg-card font-semibold text-foreground shadow-xs"
										: "text-muted-foreground hover:bg-card/70 hover:text-foreground"
								}`}
							>
								<span
									aria-hidden="true"
									className={`${item.icon} size-3.5 shrink-0 ${item.active ? "text-primary" : "text-muted-foreground/70"}`}
								/>
								<span className="hidden min-w-0 truncate lg:inline">{item.label}</span>
							</button>
						</div>
					);
				})}
			</nav>

			<div className="mt-auto hidden items-center gap-1.5 px-1 text-[10px] text-muted-foreground lg:flex">
				<span
					aria-hidden="true"
					className={`size-1 shrink-0 rounded-full ${credentialActive ? "bg-primary" : "bg-muted-foreground/40"}`}
				/>
				<span className="truncate">{credentialActive ? t("rail.credential") : t("roster.credentialInactive")}</span>
			</div>
		</aside>
	);
}
