/**
 * 表属性 · DDL 页签 — 根据 describe 列结构生成 CREATE TABLE。
 *
 * 引擎无 SHOW CREATE 端点，此处是按列元数据生成的语句（不含索引/表选项），
 * 头部如实标注，提供复制按钮。
 */

import { useMemo, useState, type JSX } from "react";
import type { EngineColumn } from "../state/workbench-types";
import { buildCreateTableSql } from "../services/table-ddl";

export function TableInfoDdl({
	qualifiedName,
	columns,
}: {
	qualifiedName: string;
	columns: EngineColumn[];
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
			<div className="flex shrink-0 items-center justify-between">
				<span className="text-[10px] text-muted-foreground">根据列结构生成（不含索引 / 表选项）</span>
				<button
					type="button"
					onClick={handleCopy}
					className="dbx-iconbtn"
					style={{ height: 20, minWidth: 20, padding: "0 4px" }}
					title={copied ? "已复制" : "复制 DDL"}
				>
					<span className={`h-3 w-3 ${copied ? "icon-[lucide--check] text-emerald-400" : "icon-[lucide--copy]"}`} />
				</button>
			</div>
			<pre className="dbx-ddl-code min-h-0 flex-1 overflow-auto">
				<code>{ddl}</code>
			</pre>
		</div>
	);
}
