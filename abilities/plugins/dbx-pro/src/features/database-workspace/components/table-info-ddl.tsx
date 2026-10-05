/**
 * 表属性 · DDL 页签 — 根据 describe 列结构生成 CREATE TABLE。
 *
 * 引擎无 SHOW CREATE 端点，此处按列元数据生成语句（不含索引 / 表选项），头部如实标注。
 * 提供「复制」和「在查询中打开」：后者把 DDL 送到新查询 tab 并绑定连接，可直接执行。
 */

import { useMemo, useState, type JSX } from "react";
import type { EngineColumn } from "../state/workbench-types";
import { buildCreateTableSql } from "../services/table-ddl";

export function TableInfoDdl({
	qualifiedName,
	columns,
	onOpenInQuery,
}: {
	qualifiedName: string;
	columns: EngineColumn[];
	onOpenInQuery: (ddl: string) => void;
}): JSX.Element {
	const [copied, setCopied] = useState(false);

	const ddl = useMemo(() => buildCreateTableSql(qualifiedName, columns), [qualifiedName, columns]);

	function handleCopy(): void {
		void navigator.clipboard.writeText(ddl).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}).catch(() => {});
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-2">
			<div className="flex shrink-0 items-center justify-between gap-2">
				<span className="truncate text-[10px] text-muted-foreground">根据列结构生成（不含索引 / 表选项）</span>
				<span className="flex shrink-0 items-center gap-1">
					<button type="button" onClick={handleCopy} className="dbx-iconbtn" style={{ height: 22, padding: "0 6px" }} title="复制 DDL">
						<span className={`h-3 w-3 ${copied ? "icon-[lucide--check] text-emerald-500" : "icon-[lucide--copy]"}`} />
						<span className="text-[10.5px]">{copied ? "已复制" : "复制"}</span>
					</button>
					<button
						type="button"
						onClick={() => onOpenInQuery(ddl)}
						className="dbx-iconbtn"
						style={{ height: 22, padding: "0 6px" }}
						title="在新查询标签中打开 DDL，可直接执行"
					>
						<span className="icon-[lucide--external-link] h-3 w-3" />
						<span className="text-[10.5px]">在查询中打开</span>
					</button>
				</span>
			</div>
			<pre className="dbx-ddl-code min-h-0 flex-1 overflow-auto">
				<code>{ddl}</code>
			</pre>
		</div>
	);
}
