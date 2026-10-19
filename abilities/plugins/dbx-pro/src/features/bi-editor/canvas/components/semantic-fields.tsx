/**
 * semantic-fields.tsx — 图表语义字段控件（维度 / 度量 / 筛选）。
 *
 * 这三个字段的值都以 JSON 存在 NodePos.values 里，由 chart-spec.ts 解析。
 * 控件本身只做增删改，不做聚合计算；选择项直接复用 chart-spec 的选项常量，
 * 避免面板与解析层各维护一套枚举导致漂移。
 *
 * 字段来源：上游/自身结果集的 columns。没有列时给出明确提示，不塞假字段。
 */

import type { JSX } from "react";
import {
	AGG_OPTIONS,
	FILTER_OP_OPTIONS,
	GRAIN_OPTIONS,
	parseDimensions,
	parseFilters,
	parseMeasures,
	type DimensionSpec,
	type FilterSpec,
	type MeasureSpec,
} from "../lib/chart-spec";

const SELECT_CLASS =
	"h-7 min-w-0 flex-1 rounded-control border border-border bg-surface px-1 text-[11px] text-surface-foreground";
const ICON_BUTTON =
	"flex size-6 shrink-0 items-center justify-center rounded-control border border-border text-[11px] text-muted transition hover:border-danger hover:text-danger disabled:opacity-40";
const ADD_BUTTON =
	"flex h-7 w-full items-center justify-center gap-1 rounded-control border border-dashed border-border text-[11px] text-muted transition hover:border-accent hover:text-accent";

function Empty({ text }: { text: string }): JSX.Element {
	return <p className="rounded-control border border-dashed border-border px-2 py-1.5 text-[10px] leading-relaxed text-faint">{text}</p>;
}

function FieldSelect({
	value,
	columns,
	onChange,
	placeholder = "— 选择字段 —",
}: {
	value: string;
	columns: string[];
	onChange: (next: string) => void;
	placeholder?: string;
}): JSX.Element {
	return (
		<select className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
			<option value="">{placeholder}</option>
			{columns.map((c) => (
				<option key={c} value={c}>{c}</option>
			))}
		</select>
	);
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }): JSX.Element {
	return (
		<button type="button" className={ICON_BUTTON} onClick={onClick} aria-label={label} title={label}>
			×
		</button>
	);
}

/** 维度：决定分组顺序；同一字段可按时间粒度折叠。 */
export function DimensionsField({
	raw,
	columns,
	onChange,
}: {
	raw: unknown;
	columns: string[];
	onChange: (next: string) => void;
}): JSX.Element {
	const items = parseDimensions(raw);
	const commit = (next: DimensionSpec[]) => onChange(JSON.stringify(next));

	const update = (index: number, patch: Partial<DimensionSpec>) => {
		commit(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
	};

	return (
		<div className="flex flex-col gap-1">
			{items.length === 0 ? <Empty text="未配置维度：整表汇总为一个值。" /> : null}
			{items.map((item, index) => (
				<div key={`${item.field}-${index}`} className="flex items-center gap-1">
					<FieldSelect value={item.field} columns={columns} onChange={(field) => update(index, { field })} />
					<select
						className="h-7 w-[68px] shrink-0 rounded-control border border-border bg-surface px-1 text-[11px] text-surface-foreground"
						value={item.grain ?? "none"}
						onChange={(e) => update(index, { grain: e.target.value as DimensionSpec["grain"] })}
						title="时间粒度"
					>
						{GRAIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
					</select>
					<RemoveButton label={`删除维度 ${item.field}`} onClick={() => commit(items.filter((_, i) => i !== index))} />
				</div>
			))}
			{columns.length === 0 ? (
				<Empty text="还没有结果列：先连接数据源节点并运行。" />
			) : (
				<button
					type="button"
					className={ADD_BUTTON}
					onClick={() => commit([...items, { field: columns[0] ?? "", grain: "none" }])}
				>
					+ 添加维度
				</button>
			)}
		</div>
	);
}

/** 度量：决定聚合口径与数值格式；每个度量一条系列。 */
export function MeasuresField({
	raw,
	columns,
	onChange,
}: {
	raw: unknown;
	columns: string[];
	onChange: (next: string) => void;
}): JSX.Element {
	const items = parseMeasures(raw);
	const commit = (next: MeasureSpec[]) => onChange(JSON.stringify(next));

	const update = (index: number, patch: Partial<MeasureSpec>) => {
		commit(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
	};

	return (
		<div className="flex flex-col gap-1">
			{items.length === 0 ? <Empty text="未配置度量：图表不渲染，先添加一个度量。" /> : null}
			{items.map((item, index) => (
				<div key={`${item.field}-${index}`} className="flex items-center gap-1">
					<FieldSelect value={item.field} columns={columns} onChange={(field) => update(index, { field })} />
					<select
						className="h-7 w-[68px] shrink-0 rounded-control border border-border bg-surface px-1 text-[11px] text-surface-foreground"
						value={item.agg}
						onChange={(e) => update(index, { agg: e.target.value as MeasureSpec["agg"] })}
						title="聚合方式"
					>
						{AGG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
					</select>
					<RemoveButton label={`删除度量 ${item.field}`} onClick={() => commit(items.filter((_, i) => i !== index))} />
				</div>
			))}
			{columns.length === 0 ? null : (
				<button
					type="button"
					className={ADD_BUTTON}
					onClick={() => commit([...items, { field: columns[0] ?? "", agg: "sum", format: "auto" }])}
				>
					+ 添加度量
				</button>
			)}
		</div>
	);
}

/** 筛选：在分组之前生效；空值视为不过滤。 */
export function FiltersField({
	raw,
	columns,
	onChange,
}: {
	raw: unknown;
	columns: string[];
	onChange: (next: string) => void;
}): JSX.Element {
	const items = parseFilters(raw);
	const commit = (next: FilterSpec[]) => onChange(JSON.stringify(next));

	const update = (index: number, patch: Partial<FilterSpec>) => {
		commit(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
	};

	return (
		<div className="flex flex-col gap-1">
			{items.length === 0 ? <Empty text="未设置筛选：使用全部数据。" /> : null}
			{items.map((item, index) => {
				const needsValue = item.op !== "isNull" && item.op !== "notNull";
				return (
					<div key={`${item.field}-${index}`} className="flex flex-col gap-1 rounded-control border border-border p-1">
						<div className="flex items-center gap-1">
							<FieldSelect value={item.field} columns={columns} onChange={(field) => update(index, { field })} />
							<RemoveButton label={`删除筛选 ${item.field}`} onClick={() => commit(items.filter((_, i) => i !== index))} />
						</div>
						<div className="flex items-center gap-1">
							<select
								className="h-7 w-[78px] shrink-0 rounded-control border border-border bg-surface px-1 text-[11px] text-surface-foreground"
								value={item.op}
								onChange={(e) => update(index, { op: e.target.value as FilterSpec["op"] })}
							>
								{FILTER_OP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
							</select>
							<input
								type="text"
								className="h-7 min-w-0 flex-1 rounded-control border border-border bg-surface px-1.5 text-[11px] text-surface-foreground disabled:opacity-40"
								value={item.value ?? ""}
								disabled={!needsValue}
								placeholder={needsValue ? "值" : "无需值"}
								onChange={(e) => update(index, { value: e.target.value })}
							/>
						</div>
					</div>
				);
			})}
			{columns.length === 0 ? null : (
				<button
					type="button"
					className={ADD_BUTTON}
					onClick={() => commit([...items, { field: columns[0] ?? "", op: "eq", value: "" }])}
				>
					+ 添加筛选
				</button>
			)}
		</div>
	);
}
