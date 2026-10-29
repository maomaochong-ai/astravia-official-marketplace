import { useTranslation } from "@astravia-org/plugin-sdk";

interface LibraryFilterRowProps {
	/** 已翻译的行标题：题材 / 状态 / 篇幅。 */
	label: string;
	options: { value: string; label: string }[];
	value: string;
	onSelect: (value: string) => void;
}

/**
 * 筛选区的一行：标题 + 一排 chips（对应番茄书库的「分类：全部 主题 角色 …」）。
 * 只负责展示与回调，选中哪一项由页面状态决定，因此可以直接渲染任意一组选项。
 */
export function LibraryFilterRow({ label, options, value, onSelect }: LibraryFilterRowProps) {
	const { t } = useTranslation();
	return (
		<div className="flex items-start gap-2">
			<span className="mt-0.5 w-8 shrink-0 text-xs text-muted-foreground">{label}</span>
			<div className="flex min-w-0 flex-wrap gap-1">
				{options.map((option) => {
					const selected = option.value === value;
					return (
						<button
							key={option.value}
							type="button"
							aria-pressed={selected}
							onClick={() => onSelect(option.value)}
							className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
								selected
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
							}`}
						>
							{option.value === "all" ? t("library.all") : option.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
