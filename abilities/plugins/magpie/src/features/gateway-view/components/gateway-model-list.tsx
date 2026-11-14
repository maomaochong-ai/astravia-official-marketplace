import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { MagpieState } from "../../../controller";
import { formatContextWindow } from "../../../model-catalog";
import { Card } from "./ui";

interface ModelListProps {
	state: MagpieState;
	limit: number;
}

/**
 * 模型目录。只展示前 `limit` 行，标题上写清「显示多少 / 一共多少」。
 *
 * 表头固定在滚动区里（`sticky`）：一个 200 行的表滚到一半时，用户得知道这三列是什么。
 */
export function GatewayModelList({ state, limit }: ModelListProps) {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const needle = query.trim().toLowerCase();
	const matched = needle
		? state.rows.filter(
				(row) =>
					row.id.toLowerCase().includes(needle) ||
					row.name.toLowerCase().includes(needle) ||
					row.provider.toLowerCase().includes(needle),
			)
		: state.rows;
	const shown = matched.slice(0, limit);

	return (
		<Card
			title={t("models.title")}
			aside={
				<span className="text-[11px] text-muted-foreground">
					{t("models.showing", { shown: shown.length, total: matched.length })}
				</span>
			}
		>
			<input
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				placeholder={t("models.filter")}
				className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-foreground/40"
			/>

			{state.rows.length === 0 ? (
				<p className="mt-3 text-xs text-muted-foreground">{t("models.empty")}</p>
			) : (
				<div className="mt-3 max-h-[26rem] overflow-auto rounded-lg border border-border/60">
					<table className="w-full text-left text-xs">
						<thead className="sticky top-0 z-10 bg-card text-[11px] text-muted-foreground">
							<tr className="[&>th]:border-b [&>th]:border-border [&>th]:py-2 [&>th]:pr-3 [&>th]:font-normal [&>th]:last:pr-2">
								<th className="pl-2">{t("models.name")}</th>
								<th>{t("models.provider")}</th>
								<th>{t("models.context")}</th>
							</tr>
						</thead>
						<tbody>
							{shown.map((row) => (
								<tr key={row.id} className="border-b border-border/40 align-top last:border-0">
									<td className="max-w-0 py-2 pl-2 pr-3">
										<div className="truncate font-medium text-foreground" title={row.name}>
											{row.name}
										</div>
										<div className="truncate font-mono text-[11px] text-muted-foreground" title={row.id}>
											{row.id}
										</div>
									</td>
									<td className="py-2 pr-3 text-muted-foreground">{row.provider || "—"}</td>
									<td className="whitespace-nowrap py-2 pr-3 font-mono">
										{formatContextWindow(row.contextWindow) ?? "—"}
										{row.images ? <span className="ml-2 text-muted-foreground">{t("models.badgeImages")}</span> : null}
										{row.reasoning ? <span className="ml-2 text-muted-foreground">{t("models.badgeReasoning")}</span> : null}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{matched.length > shown.length ? (
				<p className="mt-2 text-[11px] text-muted-foreground">
					{t("models.truncated", { shown: shown.length, total: matched.length })}
				</p>
			) : null}
		</Card>
	);
}
