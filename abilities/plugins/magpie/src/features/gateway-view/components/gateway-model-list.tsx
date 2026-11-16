import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { MagpieState } from "../../../controller";
import { formatContextWindow } from "../../../model-catalog";
import { PanelSection } from "./ui";

interface ModelListProps {
	state: MagpieState;
	limit: number;
}

/**
 * 模型目录。只展示前 `limit` 行，标题上写清「显示多少 / 一共多少」。
 *
 * 表头固定在滚动区里（`sticky`）：一个 200 行的表滚到一半时，用户得知道这三列是什么。
 * 表格自带圆角与边框，是这一节里的**嵌套容器**。
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
		<PanelSection
			title={t("models.title")}
			aside={<span className="mp-num">{t("models.showing", { shown: shown.length, total: matched.length })}</span>}
		>
			<input
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				placeholder={t("models.filter")}
				spellCheck={false}
				className="mp-field"
				style={{ fontFamily: "var(--font-sans)" }}
			/>

			{state.rows.length === 0 ? (
				<p className="mp-meta mp-faint mt-2">{t("models.empty")}</p>
			) : (
				<div
					className="mt-2 max-h-[26rem] overflow-auto rounded-lg border"
					style={{ borderColor: "var(--mp-rule)" }}
				>
					<table className="mp-table">
						<thead>
							<tr>
								<th>{t("models.name")}</th>
								<th>{t("models.provider")}</th>
								<th>{t("models.context")}</th>
							</tr>
						</thead>
						<tbody>
							{shown.map((row) => (
								<tr key={row.id}>
									<td className="max-w-0">
										<div className="mp-body truncate font-medium" title={row.name}>
											{row.name}
										</div>
										<div className="mp-mono mt-0.5 truncate" style={{ color: "var(--mp-dim)" }} title={row.id}>
											{row.id}
										</div>
									</td>
									<td className="truncate" style={{ color: "var(--mp-dim)" }}>
										{row.provider || "—"}
									</td>
									<td className="whitespace-nowrap">
										<span className="mp-mono mp-num">{formatContextWindow(row.contextWindow) ?? "—"}</span>
										{row.images ? <span className="mp-meta mp-faint ml-2">{t("models.badgeImages")}</span> : null}
										{row.reasoning ? <span className="mp-meta mp-faint ml-2">{t("models.badgeReasoning")}</span> : null}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{matched.length > shown.length ? (
				<p className="mp-meta mp-faint mt-2">{t("models.truncated", { shown: shown.length, total: matched.length })}</p>
			) : null}
		</PanelSection>
	);
}
