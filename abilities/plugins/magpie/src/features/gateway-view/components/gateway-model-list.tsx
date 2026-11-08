import { useTranslation } from "@astravia-org/plugin-sdk";
import type { MagpieState } from "../../../controller";
import { formatContextWindow } from "../../../model-catalog";

interface ModelListProps {
	state: MagpieState;
	query: string;
	limit: number;
	onQueryChange: (value: string) => void;
}

/** 目录表格。只展示前 `limit` 行，并在标题上写清「显示多少 / 一共多少」。 */
export function GatewayModelList({ state, query, limit, onQueryChange }: ModelListProps) {
	const { t } = useTranslation();
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
		<section className="rounded-xl border border-border/70 bg-card/60 p-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-sm font-medium">{t("models.title")}</h2>
				<span className="text-xs text-muted-foreground">
					{t("models.showing", { shown: shown.length, total: matched.length })}
				</span>
			</div>

			<input
				value={query}
				onChange={(event) => onQueryChange(event.target.value)}
				placeholder={t("models.filter")}
				className="mt-3 h-8 w-full rounded-md border border-border/70 bg-background px-2 text-xs outline-none focus:border-foreground/40"
			/>

			{state.rows.length === 0 ? (
				<p className="mt-3 text-xs text-muted-foreground">{t("models.empty")}</p>
			) : (
				<div className="mt-3 max-h-96 overflow-auto">
					<table className="w-full text-left text-xs">
						<thead className="sticky top-0 bg-card/95 text-muted-foreground">
							<tr>
								<th className="py-1.5 pr-3 font-normal">{t("models.title")}</th>
								<th className="py-1.5 pr-3 font-normal">{t("models.provider")}</th>
								<th className="py-1.5 pr-3 font-normal">{t("models.context")}</th>
							</tr>
						</thead>
						<tbody>
							{shown.map((row) => (
								<tr key={row.id} className="border-t border-border/40 align-top">
									<td className="py-1.5 pr-3">
										<div className="truncate font-medium">{row.name}</div>
										<div className="truncate font-mono text-[11px] text-muted-foreground">{row.id}</div>
									</td>
									<td className="py-1.5 pr-3 text-muted-foreground">{row.provider || "—"}</td>
									<td className="py-1.5 pr-3 font-mono">
										{formatContextWindow(row.contextWindow) ?? "—"}
										{row.images ? <span className="ml-2 text-muted-foreground">img</span> : null}
										{row.reasoning ? <span className="ml-2 text-muted-foreground">think</span> : null}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}
