/**
 * 表属性 · 字段页签 — 对齐 dbx 桌面壳的列表格。
 *
 * sticky 表头五列：# / 列名（主键图标 + 注释）/ 类型 / 可空 / 默认值；
 * 顶部搜索框按列名 / 类型 / 注释过滤。
 */

import { useMemo, useState, type JSX } from "react";
import type { EngineColumn } from "../state/workbench-types";

export function TableInfoColumns({ columns }: { columns: EngineColumn[] }): JSX.Element {
	const [query, setQuery] = useState("");

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return columns;
		return columns.filter((c) =>
			c.name.toLowerCase().includes(needle) ||
			c.type.toLowerCase().includes(needle) ||
			(c.comment ?? "").toLowerCase().includes(needle),
		);
	}, [columns, query]);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="dbx-table-info-filter shrink-0">
				<span className="icon-[lucide--search] h-3 w-3 shrink-0 text-muted-foreground" />
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="筛选字段..."
					className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/70"
				/>
				{query && (
					<button
						type="button"
						onClick={() => setQuery("")}
						className="shrink-0 text-muted-foreground hover:text-foreground"
						title="清除筛选"
					>
						<span className="icon-[lucide--x] h-3 w-3" />
					</button>
				)}
			</div>

			<div className="dbx-table-info-scroller min-h-0 flex-1 overflow-auto">
				{columns.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center text-muted-foreground">
						<span className="icon-[lucide--columns-3] h-8 w-8 opacity-30" />
						<span className="mt-2 text-[11px]">无列信息</span>
					</div>
				) : filtered.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center text-muted-foreground">
						<span className="icon-[lucide--search-x] h-6 w-6 opacity-40" />
						<span className="mt-2 text-[11px]">无匹配字段</span>
					</div>
				) : (
					<table className="dbx-columns-table w-full text-[12px]">
						<thead>
							<tr>
								<th className="w-8">#</th>
								<th>列名</th>
								<th>类型</th>
								<th className="w-14">可空</th>
								<th>默认值</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((col, index) => (
								<tr key={col.name} title={col.name}>
									<td className="text-muted-foreground">{index + 1}</td>
									<td className="font-medium">
										<span className="inline-flex items-center gap-1.5">
											{col.isPrimaryKey && <span className="icon-[lucide--key-round] h-3 w-3 shrink-0 text-amber-500" />}
											<span className="truncate">{col.name}</span>
										</span>
										{col.comment && (
											<div className="mt-0.5 truncate text-[10px] text-muted-foreground">{col.comment}</div>
										)}
									</td>
									<td className="font-mono text-[11px] text-muted-foreground">{col.type}</td>
									<td>{col.nullable ? "YES" : "NO"}</td>
									<td
										className="max-w-[14rem] font-mono text-[11px]"
										title={col.hasDefault ? col.defaultValue : undefined}
									>
										{col.hasDefault && col.defaultValue ? (
											<span className="block truncate">{col.defaultValue}</span>
										) : (
											<span className="text-muted-foreground/50">—</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
