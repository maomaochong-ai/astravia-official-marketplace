/**
 * boxplot-figure — 箱形图。
 *
 * 数据来自 AI 直接给出的五数概括，**不走 source 绑定**（和 scatter/bubble 一样
 * 属于「AI 给什么画什么」）：`datasets[0].data[i]` 是第 i 个类别的分布。
 * 两种写法都收：
 *   - 数组 `[min, q1, median, q3, max]`
 *   - 对象 `{ min, q1, median, q3, max }`
 *
 * 只渲染第一条 series（多 series 分箱需要并列布局，超出 M2 范围）。
 * 用绝对定位的百分比布局而不是 SVG：viewBox 缩放下文字会随卡片宽度变形，
 * 而 figure 片段要在 UI 抽屉和导出页两种宽度下都可读。
 *
 * 离群点（outliers）不画 —— 五数概括里没有它们，见 ADR-0009 §9 M2。
 */

import type { ChartItem } from "../../../domain/chart-contract";
import type { FigureContext } from "./figure-context";
import { seriesColor, withAlpha } from "./figure-palette";
import { readFigureLabels, readFirstSeriesEntries } from "./figure-series";
import { escapeHtml, figureNoticeHtml, formatFigureNumber, toFiniteNumber } from "./figure-text";

interface Box {
	min: number;
	q1: number;
	median: number;
	q3: number;
	max: number;
}

const BOX_KEYS = ["min", "q1", "median", "q3", "max"] as const;

function toBox(entry: unknown): Box | null {
	if (Array.isArray(entry)) {
		if (entry.length < BOX_KEYS.length) return null;
		const nums = entry.slice(0, BOX_KEYS.length).map(toFiniteNumber);
		if (nums.some((n) => n === null)) return null;
		const [min, q1, median, q3, max] = nums as number[];
		return { min, q1, median, q3, max };
	}
	if (entry && typeof entry === "object") {
		const raw = entry as Record<string, unknown>;
		const nums = BOX_KEYS.map((key) => toFiniteNumber(raw[key]));
		if (nums.some((n) => n === null)) return null;
		const [min, q1, median, q3, max] = nums as number[];
		return { min, q1, median, q3, max };
	}
	return null;
}

export function renderBoxplotFigure(item: ChartItem, context: FigureContext): string {
	const { palette, options, height } = context;
	const entries = readFirstSeriesEntries(item);
	const labels = readFigureLabels(item, entries.length);

	if (labels.length === 0) {
		return figureNoticeHtml(palette, "箱形图没有可用数据", {
			detail: "需要 { labels: [...], datasets: [{ data: [[min,q1,median,q3,max], ...] }] }",
			height,
		});
	}

	const categories = labels.map((label, i) => ({ label, box: toBox(entries[i]) }));
	const boxes = categories.map((c) => c.box).filter((b): b is Box => b !== null);
	if (boxes.length === 0) {
		return figureNoticeHtml(palette, "箱形图没有可用的五数概括", {
			detail: "每一项需要 [min, q1, median, q3, max] 或同名字段的对象",
			height,
		});
	}

	let lo = Math.min(...boxes.map((b) => b.min));
	let hi = Math.max(...boxes.map((b) => b.max));
	if (options.min !== undefined && options.max !== undefined && options.max > options.min) {
		lo = options.min;
		hi = options.max;
	}
	const pad = (hi - lo) * 0.05 || Math.abs(hi) * 0.05 || 1;
	lo -= pad;
	hi += pad;
	const percent = (value: number) => ((hi - value) / (hi - lo)) * 100;
	const skipped = categories.length - boxes.length;

	const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
	const gridHtml = ticks
		.map(
			(_, i) =>
				`<span style="position:absolute;left:0;right:0;top:${((i * 100) / 4).toFixed(2)}%;height:0;border-top:1px solid ${palette.grid}"></span>`,
		)
		.join("");
	const tickHtml = ticks
		.map(
			(value, i) =>
				`<span style="position:absolute;right:6px;top:${((i * 100) / 4).toFixed(2)}%;transform:translateY(-50%);max-width:100%;font-size:10px;color:${palette.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">` +
				`${escapeHtml(formatFigureNumber(value, options.digits))}</span>`,
		)
		.join("");

	const color = seriesColor(palette, 0);
	const fill = withAlpha(color, 0.22);
	const columnHtml = categories
		.map(({ box }) => {
			if (!box) return `<span style="position:relative;flex:1 1 0;min-width:0"></span>`;
			const top = percent(box.max);
			const bottom = percent(box.min);
			const topBox = percent(box.q3);
			const bottomBox = percent(box.q1);
			const medianTop = percent(box.median);
			return (
				`<span style="position:relative;flex:1 1 0;min-width:0">` +
				`<span style="position:absolute;left:50%;top:${top.toFixed(2)}%;height:${Math.max(bottom - top, 0).toFixed(2)}%;width:1px;background:${palette.axis};transform:translateX(-50%)"></span>` +
				`<span style="position:absolute;left:50%;top:${top.toFixed(2)}%;width:30%;max-width:12px;height:1px;background:${palette.axis};transform:translateX(-50%)"></span>` +
				`<span style="position:absolute;left:50%;top:${bottom.toFixed(2)}%;width:30%;max-width:12px;height:1px;background:${palette.axis};transform:translateX(-50%)"></span>` +
				`<span style="position:absolute;left:50%;top:${topBox.toFixed(2)}%;height:${Math.max(bottomBox - topBox, 0).toFixed(2)}%;width:70%;max-width:28px;box-sizing:border-box;background:${fill};border:1px solid ${color};transform:translateX(-50%)"></span>` +
				`<span style="position:absolute;left:50%;top:${medianTop.toFixed(2)}%;width:70%;max-width:28px;height:2px;background:${color};transform:translateX(-50%)"></span>` +
				`</span>`
			);
		})
		.join("");

	const labelHtml = categories
		.map(
			({ label }) =>
				`<span title="${escapeHtml(label)}" style="flex:1 1 0;min-width:0;text-align:center;font-size:11px;color:${palette.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(label)}</span>`,
		)
		.join("");

	const warningHtml =
		skipped > 0
			? `<div style="margin-top:6px;font-size:10px;color:${palette.muted}">已跳过 ${skipped} 项无效数据（需要 [min,q1,median,q3,max] 或同名字段的对象）</div>`
			: "";

	return (
		`<div class="dbx-figure dbx-figure-boxplot" style="display:flex;flex-direction:column;height:${height}px;box-sizing:border-box">` +
		`<div style="display:flex;flex:1 1 auto;min-height:0">` +
		`<div style="position:relative;flex:0 0 56px;min-width:0">${tickHtml}</div>` +
		`<div style="position:relative;flex:1 1 auto;min-width:0;overflow:hidden">` +
		gridHtml +
		`<div style="position:relative;display:flex;height:100%">${columnHtml}</div>` +
		`</div>` +
		`</div>` +
		`<div style="display:flex;margin-top:6px"><span style="flex:0 0 56px"></span>${labelHtml}</div>` +
		warningHtml +
		`</div>`
	);
}
