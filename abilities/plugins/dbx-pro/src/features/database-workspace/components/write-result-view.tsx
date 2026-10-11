/**
 * 写 / DDL 结果视图 —— 写路径没有结果集，用一块明确的成功态确认语句真的执行了。
 *
 * 背景：引擎对 CREATE/DROP/ALTER 这类 DDL 返回 affected_rows: null、columns: []、rows: []，
 * 结果区原本会落到「执行查询后显示结果」空态，与执行前完全一样，用户会以为语句没执行。
 * 这里把引擎给的 kind / command / affected_rows 直接讲清楚。
 */

import type { JSX } from "react";

/** 引擎判定的语句类别：ddl 改结构，write 改行。 */
export type WriteResultKind = string | undefined;

export interface WriteResultViewProps {
	kind?: WriteResultKind;
	/** 命令名（CREATE / DROP / INSERT…）；引擎未给出时不渲染该标记。 */
	command?: string | null;
	/** 影响行数；DDL 与未知情况为 null。 */
	affectedRows?: number | null;
	/** 本次执行耗时（ms）。 */
	elapsedMs?: number;
	connectionName?: string;
	/** 引擎附带的提示（多语句、截断等）。 */
	note?: string;
}

export function WriteResultView({
	kind,
	command,
	affectedRows,
	elapsedMs,
	connectionName,
	note,
}: WriteResultViewProps): JSX.Element {
	const isDdl = kind === "ddl";
	const rows = typeof affectedRows === "number" ? affectedRows : null;
	return (
		<div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
			<span className="icon-[lucide--check-circle-2] h-8 w-8 text-success" />
			<p className="text-[12px] font-medium text-success">执行成功</p>
			<div className="flex flex-wrap items-center justify-center gap-1.5">
				{command ? (
					<span className="rounded-chip border border-border bg-neutral-muted px-2 py-0.5 font-mono text-[12px] whitespace-nowrap text-surface-foreground">
						{command}
					</span>
				) : null}
				{rows !== null ? (
					<span className="rounded-chip border border-border bg-neutral-muted px-2 py-0.5 text-[12px] tabular-nums whitespace-nowrap text-muted">
						影响 {rows.toLocaleString()} 行
					</span>
				) : null}
				{typeof elapsedMs === "number" ? (
					<span className="rounded-chip border border-border bg-neutral-muted px-2 py-0.5 text-[12px] tabular-nums whitespace-nowrap text-muted">
						用时 {elapsedMs} ms
					</span>
				) : null}
			</div>
			<p className="max-w-[420px] text-[12px] leading-snug text-muted">
				{isDdl ? "结构变更已提交" : "写入已提交"}
				{connectionName ? ` · ${connectionName}` : ""}
			</p>
			{note ? <p className="max-w-[420px] text-[12px] leading-snug text-faint">{note}</p> : null}
		</div>
	);
}
