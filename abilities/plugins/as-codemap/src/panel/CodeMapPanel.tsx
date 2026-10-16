/**
 * 右侧「代码图谱」面板：构建入口 + 符号/引用总览。
 * Tailwind className（宿主规范：禁手写业务 CSS）。
 */
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { CodeMapStore } from "../store/codemap-store";

export function CodeMapPanel({ store }: { store: CodeMapStore }): JSX.Element {
	const { t } = useTranslation();
	const [, force] = useState(0);
	useEffect(() => store.subscribe(() => force((n) => n + 1)), [store]);

	const index = store.getIndex();

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b border-border px-3 py-2">
				<span className="text-sm font-medium">{t("view.map")}</span>
				{index ? (
					<span className="text-xs text-muted-foreground">
						{t("map.summary.built", { fileCount: index.fileCount, symbolCount: index.symbolCount })}
					</span>
				) : (
					<span className="text-xs text-muted-foreground">{t("map.summary.empty")}</span>
				)}
			</div>
			<div className="flex-1 overflow-y-auto px-3 py-2">
				{index === null ? (
					<div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
						<span className="icon-[mdi--graph-outline] h-8 w-8 opacity-50" />
						<p className="text-sm">{t("map.empty.title")}</p>
						<p className="max-w-64 text-xs leading-5">{t("map.empty.hint")}</p>
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
								{t("map.overflow", { count: index.graph.symbols.length - 200 })}
							</div>
						) : null}
					</div>
				)}
			</div>
		</div>
	);
}
