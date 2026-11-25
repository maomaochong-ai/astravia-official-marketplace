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
	/** 重新扫一遍工作区（用户刚在对话里生成了一份）。 */
	onRefresh?: () => void;
}

/**
 * 设计包切换器。
 *
 * 每个 `<slug>.logocreator-design/` 就是一份设计包，画布读它的 `design.astravia-log`。
 * 之前有两点让它在实际使用中「展不开」：
 *
 *   1. `docs.length <= 1` 时整块不渲染 —— 只有一份包时下拉根本不存在；
 *   2. 传了 `directory` 写出来的目录没有后缀，列表按后缀筛，于是那些包永远不出现。
 *
 * 现在：只要扫描到包就渲染（单份也显示，用于确认「画布读的就是磁盘上这一份」），
 * 路径带一层目录时显示成 `brands/acme`，用户能分清同名不同目录的包。
 */
export function DesignSwitcher({ docs, current, onSelect, loading = false, onRefresh }: DesignSwitcherProps): JSX.Element | null {
	const { t } = useTranslation();
	if (!loading && docs.length === 0) return null;

	const label = (doc: DesignDocumentRef): string => {
		const parts = doc.folder.split("/").filter(Boolean);
		// 末段是 `<slug>.logocreator-design`，它本身就是「acme」；有外层目录时带上。
		return parts.length > 1 ? parts.slice(-2).join("/").replace(/\.logocreator-design$/u, "") : doc.slug;
	};

	return (
		<label className="flex min-w-0 items-center gap-1 rounded-md bg-popover/95 px-1.5 py-0.5 text-[11px] shadow-sm ring-1 ring-border/60">
			<IconVector className="size-3 shrink-0 text-muted-foreground" />
			<span className="sr-only">{t("design.switcher")}</span>
			{loading && docs.length === 0 ? (
				<span className="text-muted-foreground">{t("design.switcherLoading")}</span>
			) : (
				<select
					value={current ?? ""}
					onChange={(event) => {
						const next = docs.find((doc) => doc.folder === event.target.value);
						if (next) onSelect(next);
					}}
					data-testid="design-switcher"
					title={current ?? t("design.switcherHint", { count: docs.length })}
					className="min-w-0 max-w-[11rem] cursor-pointer appearance-none bg-transparent pr-1 font-medium text-foreground outline-none"
				>
					{/* 当前稿不在列表里（刚生成、还没扫到）时给一个占位项，避免 select 显示成第一项。 */}
					{current && !docs.some((doc) => doc.folder === current) ? <option value={current}>{t("design.switcherCurrent")}</option> : null}
					{docs.map((doc) => (
						<option key={doc.folder} value={doc.folder} title={doc.path}>
							{label(doc)}
						</option>
					))}
				</select>
			)}
			{onRefresh ? (
				<button
					type="button"
					onClick={onRefresh}
					title={t("design.switcherRefresh")}
					aria-label={t("design.switcherRefresh")}
					className="shrink-0 rounded px-0.5 text-muted-foreground transition-colors hover:text-foreground"
				>
					<span aria-hidden className="icon-[lucide--refresh-cw] size-3" />
				</button>
			) : null}
		</label>
	);
}
