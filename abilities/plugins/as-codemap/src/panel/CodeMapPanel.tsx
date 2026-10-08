/**
 * 右侧「代码图谱」面板：构建入口 + 符号/引用总览。
 * Tailwind className（宿主规范：禁手写业务 CSS）。
 */

import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { CodeMapStore } from "../store/codemap-store";

export function CodeMapPanel({ store }: { store: CodeMapStore }): JSX.Element {
	const [, force] = useState(0);
	useEffect(() => store.subscribe(() => force((n) => n + 1)), [store]);

	const index = store.getIndex();

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b border-border px-3 py-2">
				<span className="text-sm font-medium">代码图谱</span>
				{index ? (
					<span className="text-xs text-muted-foreground">
						{index.fileCount} 文件 · {index.symbolCount} 符号
					</span>
				) : (
					<span className="text-xs text-muted-foreground">尚未构建</span>
				)}
			</div>
			<div className="flex-1 overflow-y-auto px-3 py-2">
				{index === null ? (
					<div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
						<span className="icon-[mdi--graph-outline] h-8 w-8 opacity-50" />
						<p className="text-sm">构建码谱后可查询符号与引用</p>
						<p className="max-w-64 text-xs leading-5">
							在对话里说「构建码谱」，agent 会扫描当前工作区；之后可用 code_graph_query 查询符号定位与调用关系。
						</p>
					</div>
				) : (
					<div className="text-xs leading-6">
						{index.graph.symbols.slice(0, 200).map((symbol) => (
							<div key={symbol.id} className="flex items-baseline gap-2">
								<span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">{symbol.kind}</span>
								<span className="font-mono">{symbol.name}</span>
								<span className="truncate text-muted-foreground/70">
									{symbol.file}:{symbol.line}
								</span>
							</div>
						))}
						{index.graph.symbols.length > 200 ? (
							<div className="mt-2 text-muted-foreground/70">
								…另有 {index.graph.symbols.length - 200} 个符号，用 code_graph_query 精确查询。
							</div>
						) : null}
					</div>
				)}
			</div>
		</div>
	);
}
