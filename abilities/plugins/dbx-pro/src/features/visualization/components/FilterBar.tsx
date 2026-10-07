/**
 * FilterBar — 前端 categorical 列筛选器（v0.0.103 从 canvas/ 移到独立位置）
 *
 * ⚠️ 当前为孤儿组件：Canvas.tsx（唯一消费者）已在 v0.0.103 删除。
 * 保留理由：它是"二次编辑编辑器"的核心组件——未来将接进 dbx_chart_collection 输出的 HTML 页面，
 * 让用户在 iframe 里直接筛选数据（row.filter）。
 *
 * 仅处理 categorical 列（通过 inferSchema 检测 role === "categorical"）。
 * 每列一个 multi-select dropdown，返回过滤后的 rows。
 * 不做 date-range / SQL 重跑（那需要引擎层）。
 */

import { useMemo, useState, type JSX } from "react";
import { inferSchema } from "../../../shared/services/infer-schema";

export interface CategoricalCol {
	name: string;
	values: unknown[]; // 去重后的原始值（可能含 null）
}

interface FilterBarProps {
	/** 所有数据源（用于检测 categorical 列 + 取值域） */
	dataSources: Array<{ id: string; columns: string[]; rows: Record<string, unknown>[] }>;
	/** 当前已激活的 filters：列名 → 选中值集合（空集合 = 不过滤该列） */
	filters: Record<string, Set<unknown>>;
	onFiltersChange: (next: Record<string, Set<unknown>>) => void;
}

export function FilterBar({ dataSources, filters, onFiltersChange }: FilterBarProps): JSX.Element | null {
	// 收集所有 dataSource 里的 categorical 列 + 去重值域
	const categoricalCols: CategoricalCol[] = useMemo(() => {
		const colMap = new Map<string, Set<unknown>>();
		for (const src of dataSources) {
			// 列头可能跨 source 重复（比如多个 preset 都有 status 列），合并值域
			const schema = inferSchema(src.columns, src.rows);
			for (const m of schema) {
				if (m.role === "categorical" && m.cardinality !== undefined && m.cardinality <= 15) {
					let bucket = colMap.get(m.name);
					if (!bucket) { bucket = new Set(); colMap.set(m.name, bucket); }
					for (const row of src.rows) {
						const v = row[m.name];
						if (v !== null && v !== undefined) bucket.add(v);
					}
				}
			}
		}
		return Array.from(colMap.entries())
			.map(([name, values]) => ({ name, values: Array.from(values) }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [dataSources]);

	if (categoricalCols.length === 0) return null;

	return (
		<div className="viz-filterbar">
			<span className="viz-filterbar__icon icon-[lucide--filter] h-3.5 w-3.5" />
			<span className="viz-filterbar__label">筛选</span>
			{categoricalCols.map((col) => (
				<CategoricalFilter
					key={col.name}
					col={col}
					selected={filters[col.name] ?? new Set()}
					onChange={(next) => {
						const copy = { ...filters };
						if (next.size === 0) delete copy[col.name];
						else copy[col.name] = next;
						onFiltersChange(copy);
					}}
				/>
			))}
			{Object.keys(filters).length > 0 && (
				<button
					type="button"
					className="viz-filterbar__clear"
					onClick={() => onFiltersChange({})}
					title="清除所有筛选"
				>
					<span className="icon-[lucide--x-circle] h-3 w-3" />
					清除
				</button>
			)}
		</div>
	);
}

/** 单列 multi-select dropdown（受控） */
function CategoricalFilter({
	col, selected, onChange,
}: {
	col: CategoricalCol;
	selected: Set<unknown>;
	onChange: (next: Set<unknown>) => void;
}): JSX.Element {
	const [open, setOpen] = useState(false);

	const toggle = (v: unknown) => {
		const next = new Set(selected);
		if (next.has(v)) next.delete(v); else next.add(v);
		onChange(next);
	};
	const allSelected = selected.size === 0 || selected.size === col.values.length;

	return (
		<div className="viz-filter" style={{ position: "relative" }}>
			<button
				type="button"
				className={`viz-filter__btn ${allSelected ? "" : "viz-filter__btn--active"}`}
				onClick={() => setOpen((v) => !v)}
			>
				<span className="viz-filter__col">{col.name}</span>
				{!allSelected && <span className="viz-filter__count">{selected.size}</span>}
				<span className="viz-filter__caret icon-[lucide--chevron-down] h-3 w-3" />
			</button>
			{open && (
				<>
					<div className="viz-filter__backdrop" onClick={() => setOpen(false)} />
					<div className="viz-filter__panel">
						<button
							type="button"
							className="viz-filter__item viz-filter__item--select"
							onClick={() => { onChange(new Set()); setOpen(false); }}
						>
							{allSelected ? "✓ 全部" : "全选"}
						</button>
						{col.values.map((v, i) => {
							const checked = selected.has(v);
							return (
								<button
									key={i}
									type="button"
									className={`viz-filter__item ${checked ? "viz-filter__item--checked" : ""}`}
									onClick={() => toggle(v)}
								>
									<span className="viz-filter__check">{checked ? "✓" : ""}</span>
									<span className="viz-filter__val">{String(v)}</span>
								</button>
							);
						})}
					</div>
				</>
			)}
		</div>
	);
}
