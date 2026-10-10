/**
 * DatasetFilterPanel — 按数据集列出的筛选控件。
 *
 * 筛选只改前端取行，不重跑 SQL、不改聚合口径（ADR-0009 §6 第 2 条）。
 * 控件形态由列角色决定：
 *   - 度量 / 时间 → 区间（两个输入框，闭区间）
 *   - 分类 / 维度 / 标识 → 多选枚举（取值太多时明确说明不支持，而不是给个会卡死的列表）
 *
 * 每次改动立即生效（没有「应用」按钮）：改完这一行就能在图上看到结果，
 * 交互成本越低用户越敢试，而重算是纯前端毫秒级的。
 */

import type { JSX } from "react";
import type { ChartFilter, DatasetSpec } from "../../../domain/chart-contract";
import { isFilterActive } from "../../../domain/dataset-filter";
import { inferSchema, type ColumnMeta, type ColumnRole } from "../../../shared/services/infer-schema";

/** 枚举控件最多列出多少个不同取值；超过就说明「取值过多」并只支持筛选其它列。 */
const CHOICE_LIMIT = 40;

const ROLE_LABEL: Record<ColumnRole, string> = {
	time: "时间",
	measure: "度量",
	categorical: "分类",
	dimension: "维度",
	id: "标识",
};

interface Props {
	datasets: DatasetSpec[];
	filters: ChartFilter[];
	onChange: (filters: ChartFilter[]) => void;
}

export function DatasetFilterPanel({ datasets, filters, onChange }: Props): JSX.Element {
	const activeCount = filters.filter(isFilterActive).length;

	function clearAll(): void {
		onChange([]);
	}

	return (
		<div className="viz-section">
			<div className="viz-section-head">
				<h3 className="viz-section-title">
					筛选
					{activeCount > 0 ? <span className="viz-field-role">{activeCount} 个条件</span> : null}
				</h3>
				{activeCount > 0 ? (
					<button type="button" className="viz-action-btn" onClick={clearAll}>
						清除筛选
					</button>
				) : null}
			</div>
			{datasets.map((dataset) => (
				<DatasetFields key={dataset.id} dataset={dataset} filters={filters} onChange={onChange} />
			))}
		</div>
	);
}

function DatasetFields({
	dataset,
	filters,
	onChange,
}: {
	dataset: DatasetSpec;
	filters: ChartFilter[];
	onChange: (filters: ChartFilter[]) => void;
}): JSX.Element {
	// 2000 行 × 若干列的角色推断是毫秒级；这里刻意不引入 memo
	const metas = inferSchema(dataset.columns, dataset.rows);

	if (dataset.rows.length === 0) {
		return (
			<div className="viz-field">
				<span className="viz-field-label">数据集「{dataset.title}」</span>
				<p className="viz-section-note">该数据集只保留了取数 SQL，需要重新取数后才能筛选。</p>
			</div>
		);
	}

	return (
		<div className="viz-field">
			<span className="viz-field-label">
				数据集「{dataset.title}」
				<span className="viz-field-role">{dataset.rows.length} 行</span>
			</span>
			{metas.map((meta) => (
				<Field key={meta.name} dataset={dataset} meta={meta} filters={filters} onChange={onChange} />
			))}
		</div>
	);
}

function Field({
	dataset,
	meta,
	filters,
	onChange,
}: {
	dataset: DatasetSpec;
	meta: ColumnMeta;
	filters: ChartFilter[];
	onChange: (filters: ChartFilter[]) => void;
}): JSX.Element {
	const current = filters.find((filter) => filter.datasetId === dataset.id && filter.column === meta.name);
	const isRange = meta.role === "measure" || meta.role === "time";

	return (
		<div className="viz-field">
			<span className="viz-field-label">
				{meta.name}
				<span className="viz-field-role">
					{ROLE_LABEL[meta.role]}
					{typeof meta.cardinality === "number" ? ` · ${meta.cardinality}` : ""}
				</span>
				{current && isFilterActive(current) ? (
					<button
						type="button"
						className="viz-action-btn"
						onClick={() => onChange(dropFilter(filters, dataset.id, meta.name))}
					>
						清除
					</button>
				) : null}
			</span>
			{isRange ? (
				<RangeInputs datasetId={dataset.id} column={meta.name} current={current} filters={filters} onChange={onChange} />
			) : (
				<ValueChoices dataset={dataset} meta={meta} filters={filters} onChange={onChange} />
			)}
		</div>
	);
}

function RangeInputs({
	datasetId,
	column,
	current,
	filters,
	onChange,
}: {
	datasetId: string;
	column: string;
	current: ChartFilter | undefined;
	filters: ChartFilter[];
	onChange: (filters: ChartFilter[]) => void;
}): JSX.Element {
	function update(bound: "min" | "max", raw: string): void {
		const next: ChartFilter = { datasetId, column, min: current?.min, max: current?.max };
		next[bound] = raw.trim() === "" ? undefined : asBound(raw);
		onChange(putFilter(filters, next));
	}

	return (
		<div className="viz-range">
			<input
				type="text"
				className="viz-input"
				placeholder="最小值"
				value={current?.min === undefined ? "" : String(current.min)}
				onChange={(event) => update("min", event.target.value)}
			/>
			<span className="viz-section-note">至</span>
			<input
				type="text"
				className="viz-input"
				placeholder="最大值"
				value={current?.max === undefined ? "" : String(current.max)}
				onChange={(event) => update("max", event.target.value)}
			/>
		</div>
	);
}

function ValueChoices({
	dataset,
	meta,
	filters,
	onChange,
}: {
	dataset: DatasetSpec;
	meta: ColumnMeta;
	filters: ChartFilter[];
	onChange: (filters: ChartFilter[]) => void;
}): JSX.Element {
	const choices = distinctValues(dataset.rows, meta.name);

	if (choices === null) {
		return (
			<p className="viz-section-note">
				「{meta.name}」有 {meta.cardinality ?? "很多"} 个不同取值，超出界面枚举上限（{CHOICE_LIMIT} 个），暂不支持在此筛选。
			</p>
		);
	}

	const current = filters.find((filter) => filter.datasetId === dataset.id && filter.column === meta.name);
	const selected = new Set((current?.values ?? []).map(String));

	function toggle(value: string, checked: boolean): void {
		const next = new Set(selected);
		if (checked) next.add(value);
		else next.delete(value);
		onChange(putFilter(filters, { datasetId: dataset.id, column: meta.name, values: [...next] }));
	}

	return (
		<div className="viz-field-values">
			{choices.map((value) => (
				<label className="viz-check" key={value}>
					<input type="checkbox" checked={selected.has(value)} onChange={(event) => toggle(value, event.target.checked)} />
					{value}
				</label>
			))}
		</div>
	);
}

/** 一枚筛选条件的替换语义：同 (datasetId, column) 只保留一条，空条件等于删除。 */
function putFilter(filters: ChartFilter[], next: ChartFilter): ChartFilter[] {
	const rest = filters.filter((filter) => !(filter.datasetId === next.datasetId && filter.column === next.column));
	return isFilterActive(next) ? [...rest, next] : rest;
}

function dropFilter(filters: ChartFilter[], datasetId: string, column: string): ChartFilter[] {
	return filters.filter((filter) => !(filter.datasetId === datasetId && filter.column === column));
}

/** 不同取值；超过上限返回 null（调用方据此给出「不支持」的说明）。 */
function distinctValues(rows: readonly Record<string, unknown>[], column: string): string[] | null {
	const seen = new Set<string>();
	for (const row of rows) {
		const value = row[column];
		if (value === null || value === undefined) continue;
		seen.add(String(value));
		if (seen.size > CHOICE_LIMIT) return null;
	}
	return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** 用户输入当数字用就用数字：数值列比较走数值，否则按字符串（日期、编码）比较。 */
function asBound(raw: string): number | string {
	const trimmed = raw.trim();
	const numeric = Number(trimmed);
	return trimmed !== "" && Number.isFinite(numeric) ? numeric : trimmed;
}
