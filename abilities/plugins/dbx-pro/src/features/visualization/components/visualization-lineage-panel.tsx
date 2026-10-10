/**
 * VisualizationLineagePanel — 详情抽屉里的「血缘」区。
 *
 * 纯 props 组件：数据由抽屉（store + domain/visualization-lineage）取好后传进来。
 * 这里不碰 store、不重新算血缘 —— 一条规则只在一个地方实现，面板只负责说清楚。
 *
 * 两块内容：
 *   1. 本产物引用了哪些来源（连接 / 表 / 取数 SQL / 行数 / 取数时间）；
 *   2. 反查引用了同一张表的其他产物，按 (连接, 表名) 成对匹配。
 *
 * 旧格式快照（只有连接与表）在这里如实显示「没有取数 SQL」，而不是给一个空面板
 * 让用户猜为什么不能重新取数。
 */

import type { JSX } from "react";
import {
	formatLineageTable,
	formatLineageTime,
	type LineageReferenceGroup,
	type LineageSource,
} from "../../../domain/visualization-lineage";

interface Props {
	sources: LineageSource[];
	/** 产物创建时间；缺失时不显示「生成时间」，不编一个时间出来 */
	createdAt?: number | null;
	references: LineageReferenceGroup[];
}

function typeLabel(type: "dashboard" | "screen"): string {
	return type === "screen" ? "大屏" : "看板";
}

/** 行数口径：只有一边有记录时只说那一边，两边都没有就整行不显示。 */
function rowSummary(source: LineageSource): string {
	const loaded = source.loadedCount;
	const total = source.rowCount;
	if (total === null && loaded === null) return "";
	if (total === null) return `已载入 ${loaded} 行`;
	if (loaded === null) return `SQL 共 ${total} 行`;
	return `SQL 共 ${total} 行 / 已载入 ${loaded} 行`;
}

export function VisualizationLineagePanel({ sources, createdAt, references }: Props): JSX.Element {
	const time = formatLineageTime(createdAt);

	return (
		<div className="viz-section viz-lineage">
			<div className="viz-section-head">
				<h3 className="viz-section-title">血缘</h3>
				{time ? <span className="viz-lineage-time">生成时间 {time}</span> : null}
			</div>

			{sources.length === 0 ? (
				<p className="viz-section-note">该产物没有记录数据来源。</p>
			) : (
				sources.map((source, index) => {
					const summary = rowSummary(source);
					return (
						<div className="viz-lineage-source" key={`${source.kind}-${source.title}-${index}`}>
							<span className="viz-lineage-source-title">{source.title || "未命名来源"}</span>
							<span className="viz-lineage-origin">
								{source.table ? formatLineageTable(source) : "未记录来源"}
							</span>
							{summary ? <span className="viz-lineage-rows">{summary}</span> : null}
							{source.kind === "snapshot" ? (
								<p className="viz-section-note">旧格式快照只有表信息，没有取数 SQL。</p>
							) : source.sql ? (
								<details>
									<summary className="viz-dataset-meta">取数 SQL</summary>
									<pre className="viz-sql">{source.sql}</pre>
								</details>
							) : (
								<p className="viz-section-note">该数据集没有记录 SQL，无法重新取数。</p>
							)}
						</div>
					);
				})
			)}

			{references.map((group) => (
				<div className="viz-lineage-group" key={formatLineageTable(group.table)}>
					<span className="viz-lineage-group-head">{formatLineageTable(group.table)}</span>
					<span className="viz-lineage-group-note">引用了同一张表的其他产物</span>
					{group.entries.length === 0 ? (
						<span className="viz-section-note">暂无其他产物引用这张表</span>
					) : (
						<ul className="viz-lineage-entries">
							{group.entries.map((entry) => {
								const entryTime = formatLineageTime(entry.createdAt);
								return (
									<li className="viz-lineage-entry" key={entry.id}>
										{entry.title || "未命名产物"}
										<span className="viz-lineage-entry-meta">
											{` · ${typeLabel(entry.type)}`}
											{entryTime ? ` · ${entryTime}` : ""}
										</span>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			))}
		</div>
	);
}
