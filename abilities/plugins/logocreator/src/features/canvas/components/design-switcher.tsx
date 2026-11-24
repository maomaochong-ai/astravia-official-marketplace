import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { DesignDocumentRef } from "../../../domain/design-library";
import { IconVector } from "../../../shared/components/icons";

export interface DesignSwitcherProps {
	docs: readonly DesignDocumentRef[];
	/** 当前打开的那份（按目录比较）。 */
	current: string | null;
	onSelect(doc: DesignDocumentRef): void;
	/** 首次扫描还没回来。 */
	loading?: boolean;
}

/**
 * 设计稿切换器。
 *
 * 设计稿是磁盘上的 `.astravia-log` 文件：一份文件一份稿，就像宿主设计插件的 `.astravia-design`。
 * 换稿不该靠「再生成一次」，所以这里把它们列出来直接切 —— 面板打开时看到的就是工作区里真实存在的那些。
 *
 * 只有一份时不渲染：一个只有唯一选项的下拉是纯噪音。
 */
export function DesignSwitcher({ docs, current, onSelect, loading = false }: DesignSwitcherProps): JSX.Element | null {
	const { t } = useTranslation();
	if (!loading && docs.length <= 1) return null;

	return (
		<label className="flex min-w-0 items-center gap-1 rounded-md bg-popover/95 px-1.5 py-0.5 text-[11px] shadow-sm">
			<IconVector className="size-3 shrink-0 text-muted-foreground" />
			<span className="sr-only">{t("design.switcher")}</span>
			{loading && docs.length === 0 ? (
				<span className="text-muted-foreground">{t("design.switcherLoading")}</span>
			) : (
				<select
					value={current ?? ""}
					onChange={(event) => {
						const next = docs.find(doc => doc.folder === event.target.value);
						if (next) onSelect(next);
					}}
					data-testid="design-switcher"
					className="min-w-0 max-w-[11rem] cursor-pointer appearance-none bg-transparent pr-1 font-medium text-foreground outline-none"
				>
					{docs.map(doc => (
						<option key={doc.folder} value={doc.folder} title={doc.path}>
							{doc.slug}
						</option>
					))}
				</select>
			)}
		</label>
	);
}
