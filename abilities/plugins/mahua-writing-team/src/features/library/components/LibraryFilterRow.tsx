import { useTranslation } from "@astravia-org/plugin-sdk";

interface LibraryFilterRowProps {
	/** 已翻译的行标题：题材 / 状态 / 篇幅 / 排序。 */
	label: string;
	options: { value: string; label: string }[];
	value: string;
	onSelect: (value: string) => void;
}

/**
 * 筛选区的一行（设计稿 `library` 帧左侧条件栏）。
 *
 * 设计稿的做法是「一个组名 + 一列竖排选项」，每格 26px 高、选中反白，不是一排彩色胶囊：
 * 竖排让组名只出现一次，选项长短不一也不会把行撑歪。`all` 用 `library.all` 兜底文案。
 */
export function LibraryFilterRow({ label, options, value, onSelect }: LibraryFilterRowProps) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-col gap-1">
			<span className="px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">{label}</span>
			<div className="flex flex-col">
				{options.map((option) => {
					const selected = option.value === value;
					return (
						<button
							key={option.value}
							type="button"
							aria-pressed={selected}
							onClick={() => onSelect(option.value)}
							className={`flex h-[26px] w-full items-center rounded-[9px] px-1.5 text-left text-[11px] transition-colors ${
								selected ? "bg-foreground font-medium text-background" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
							}`}
						>
							<span className="min-w-0 truncate">{option.value === "all" ? t("library.all") : option.label}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
