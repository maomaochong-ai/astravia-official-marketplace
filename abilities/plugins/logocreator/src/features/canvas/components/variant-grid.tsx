import { useMemo, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { DesignRecord } from "../../../domain/history-store";
import { cachedRender } from "../preview-cache";
import { useRasterUrl } from "../hooks/use-raster-url";

export interface VariantGridProps {
	/** 本次要铺开的稿，按生成顺序。 */
	records: readonly DesignRecord[];
	selectedId: string | null;
	onSelect: (record: DesignRecord) => void;
	/** 放大到单张画布（备注、缩放都在那里）。 */
	onStage: (record: DesignRecord) => void;
	/** 本批还在跑的格子数（骨架）：画布侧生成时用。 */
	pending?: number;
}

/**
 * 画布上的变体网格。
 *
 * 上一版把「本次生成几张」做成 dock 上方一条缩略图轨 —— 它和 dock 抢同一块底部空间
 * （截图里两者直接叠在一起），而且画布主体仍然只画一张，另外几张只能看不能动。
 *
 * 现在把这一批直接铺在画布上：
 *   - 每张一个格子，点击即选中（表单、备注、导出都跟着它走）；
 *   - 选中格上给「放大」，进入单张画布做备注与缩放；
 *   - 只有一张时退回单张画布，网格不出现。
 *
 * 缩略图与主图同源：矢量走预览缓存（同步，不重算），位图走 blob URL。
 */
export function VariantGrid({ records, selectedId, onSelect, onStage, pending = 0 }: VariantGridProps): JSX.Element | null {
	const { t } = useTranslation();
	// 本批还在跑：有骨架就显示骨架；既无成品又无骨架时整个网格不出现。
	if (records.length < 2 && pending === 0) return null;

	return (
		<div className="absolute inset-0 overflow-y-auto overscroll-contain p-3 pb-24">
			{/*
			 * 居中式排布：网格容器自身居中、列宽自适应，
			 * 2–3 张时不再靠左留一大片空白（截图里的问题）。
			 */}
			<div className="mx-auto grid w-fit max-w-full grid-cols-[repeat(auto-fit,minmax(9.5rem,13rem))] justify-center gap-2">
				{records.map((record, index) => (
					<VariantTile
						key={record.id}
						record={record}
						index={index}
						active={record.id === selectedId}
						onSelect={() => onSelect(record)}
						onStage={() => onStage(record)}
						stageLabel={t("grid.stage")}
					/>
				))}
				{/* 正在生成的格子：数量由调用方给（= 本次设置要出几张）。 */}
				{Array.from({ length: pending }, (_, offset) => (
					<div
						key={`pending-${offset}`}
						className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 bg-muted/20"
					>
						<span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
						<span className="text-[9.5px] text-muted-foreground">{t("grid.pending")}</span>
					</div>
				))}
			</div>
		</div>
	);
}

interface TileProps {
	record: DesignRecord;
	index: number;
	active: boolean;
	onSelect: () => void;
	onStage: () => void;
	stageLabel: string;
}

function VariantTile({ record, index, active, onSelect, onStage, stageLabel }: TileProps): JSX.Element {
	const { t } = useTranslation();
	const rasterUrl = useRasterUrl(record);
	const vectorUrl = useMemo(() => (record.engine === "ai" ? null : cachedRender(record.spec).url), [record]);
	const url = record.engine === "ai" ? rasterUrl : vectorUrl;

	return (
		<div
			className={`group relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background transition-colors ${
				active ? "border-primary ring-1 ring-primary/40" : "border-border/70 hover:border-foreground/30"
			}`}
		>
			<button
				type="button"
				onClick={onSelect}
				aria-pressed={active}
				title={t("grid.select", { index: index + 1 })}
				className="relative block aspect-square w-full overflow-hidden"
				style={{ background: record.spec.surface === "dark" ? "#121210" : "#ffffff" }}
			>
				{url ? (
					<img src={url} alt="" className="size-full object-contain p-2" draggable={false} />
				) : (
					<span className="flex size-full items-center justify-center text-[11px] text-muted-foreground">{index + 1}</span>
				)}
				{/* 序号与引擎写在图内角落：网格很密，标签放外面会挤掉图形。 */}
				<span className="absolute left-1 top-1 rounded bg-black/45 px-1 text-[9px] font-medium tabular-nums text-white">
					{index + 1}
				</span>
			</button>
			<div className="flex items-center justify-between gap-1 border-t border-border-subtle px-1.5 py-1">
				<span className="min-w-0 truncate text-[9.5px] text-muted-foreground">
					{record.engine === "ai" ? t("grid.engine.ai") : t("grid.engine.local")}
				</span>
				<button
					type="button"
					onClick={onStage}
					title={stageLabel}
					aria-label={stageLabel}
					className="shrink-0 rounded px-1 text-[9.5px] text-text-2 transition-colors hover:bg-accent hover:text-foreground"
				>
					{t("grid.stageShort")}
				</button>
			</div>
		</div>
	);
}
