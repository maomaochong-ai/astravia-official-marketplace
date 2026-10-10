/**
 * DatasetSummaryList — 详情抽屉里的数据集摘要。
 *
 * 用户要能自己回答「这张图的数据到底从哪来、跑了什么 SQL、有多少行」，
 * 所以 SQL、列、行数、连接与表都摆出来（ADR-0009 §10 验收 ①）。
 * 行数与实际载入行数分开说：SQL 返回 5 万行但只载入 2000 行时，
 * 把两者混成一个数字会让用户基于错误口径做判断。
 */

import type { JSX } from "react";
import type { DatasetSpec } from "../../../domain/chart-contract";

interface Props {
	datasets: DatasetSpec[];
}

export function DatasetSummaryList({ datasets }: Props): JSX.Element {
	return (
		<div className="viz-section">
			<div className="viz-section-head">
				<h3 className="viz-section-title">数据集</h3>
				<span className="viz-section-note">{datasets.length} 个</span>
			</div>
			{datasets.map((dataset) => (
				<div className="viz-dataset" key={dataset.id}>
					<span className="viz-field-label">{dataset.title}</span>
					<span className="viz-dataset-meta">
						{[dataset.connection, dataset.table].filter(Boolean).join(" → ") || "未记录来源"} · {dataset.rowCount} 行 ·{" "}
						{dataset.columns.length} 列
					</span>
					<span className="viz-dataset-meta">已载入 {dataset.rows.length} 行</span>
					{dataset.rows.length === 0 && dataset.rowCount > 0 ? (
						<span className="viz-section-note">数据已裁剪（体积超限），需要重新取数后才能筛选。</span>
					) : null}
					{dataset.sql ? (
						<details>
							<summary className="viz-dataset-meta">取数 SQL</summary>
							<pre className="viz-sql">{dataset.sql}</pre>
						</details>
					) : (
						<span className="viz-section-note">该数据集没有记录 SQL，无法重新取数。</span>
					)}
				</div>
			))}
		</div>
	);
}
