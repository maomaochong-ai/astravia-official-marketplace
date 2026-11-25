import { useMemo, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { DesignRecord } from "../../../domain/history-store";
import { cachedRender } from "../preview-cache";
import { useRasterUrl } from "../hooks/use-raster-url";

export interface BatchRailProps {
	/** 本批记录，按生成顺序；第一项是主图。已过滤掉存储里查不到的 id。 */
	records: readonly DesignRecord[];
	selectedId: string | null;
	onSelect: (record: DesignRecord) => void;
	onDismiss: () => void;
}

/**
 * 一批稿的缩略图轨。
 *
 * 一次工具调用可以出 2–8 张，但画布只画一张 —— 另外几张只能去历史面板里翻，用户不知道
 * 「对话里出了三张」这件事在面板里是什么样。这条轨把它们并排铺在画布底部之上：
 *
 *   - 点击某张 → 切换成主图（表单与备注跟着走）；
 *   - 只有 1 张时不渲染，避免给单张稿加噪音；
 *   - 最多显示 8 张，超出的用「+N」说明，不横向溢出。
 *
 * 缩略图沿用与主图相同的来源：矢量用 `cachedRender`（同步、同一份缓存，不会重算），
 * 位图用 blob URL（`useRasterUrl` 逐张解析，失败就退化成序号块）。
 */
export function BatchRail({ records, selectedId, onSelect, onDismiss }: BatchRailProps): JSX.Element | null {
	const { t } = useTranslation();
	if (records.length < 2) return null;
	const shown = records.slice(0, 8);
	const overflow = records.length - shown.length;

	return (
		<div className="pointer-events-auto absolute inset-x-3 bottom-14 z-30 flex items-center gap-1.5 rounded-xl border border-border/80 bg-popover/95 px-2 py-1.5 shadow-sm">
			<span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
				{t("batch.title", { count: records.length })}
			</span>
			<div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{shown.map((record, index) => (
					<BatchThumb
						key={record.id}
						record={record}
						index={index}
						active={record.id === selectedId}
						onSelect={() => onSelect(record)}
					/>
				))}
				{overflow > 0 ? (
					<span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted/60 text-[10px] tabular-nums text-muted-foreground">
						+{overflow}
					</span>
				) : null}
			</div>
			<button
				type="button"
				onClick={onDismiss}
				aria-label={t("batch.dismiss")}
				title={t("batch.dismiss")}
				className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			>
				<span aria-hidden className="icon-[lucide--x] size-3.5" />
			</button>
		</div>
	);
}

interface ThumbProps {
	record: DesignRecord;
	index: number;
	active: boolean;
	onSelect: () => void;
}

function BatchThumb({ record, index, active, onSelect }: ThumbProps): JSX.Element {
	const { t } = useTranslation();
	const rasterUrl = useRasterUrl(record);
	// 位图记录没有可渲染的 spec，只有 blob；矢量记录直接用同一份预览缓存。
	const vectorUrl = useMemo(
		() => (record.engine === "ai" ? null : cachedRender(record.spec).url),
		[record],
	);
	const url = record.engine === "ai" ? rasterUrl : vectorUrl;

	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={active}
			title={t("batch.item", { index: index + 1 })}
			className={`relative size-10 shrink-0 overflow-hidden rounded-md border transition-colors ${
				active ? "border-primary ring-1 ring-primary/40" : "border-border hover:border-foreground/30"
			}`}
			style={{ background: record.spec.surface === "dark" ? "#121210" : "#ffffff" }}
		>
			{url ? (
				<img src={url} alt="" className="size-full object-contain p-0.5" draggable={false} />
			) : (
				<span className="flex size-full items-center justify-center text-[9px] text-muted-foreground">{index + 1}</span>
			)}
		</button>
	);
}
