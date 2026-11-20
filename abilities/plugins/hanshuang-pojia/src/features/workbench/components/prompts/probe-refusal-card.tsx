import { useTranslation } from "@astravia-org/plugin-sdk";
import { adviceFor, type ProbeRecord } from "../../../../domain/refusal-probe";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";

export interface ProbeRefusalCardProps {
	record: ProbeRecord | null;
	/** 让 Agent 跑一次探测（面板不自己发请求：它没有模型凭据）。 */
	onRun(): void;
	/** 把当前对照表交给对话，继续分析。 */
	onDiscuss(): void;
	refresh(): void;
}

const VERDICT_TONE: Record<string, string> = {
	answered: "text-risk-low",
	refused: "text-risk-high",
	empty: "text-risk-medium",
};

const VERDICT_KEY: Record<string, string> = {
	answered: "probe.verdict.answered",
	refused: "probe.verdict.refused",
	empty: "probe.verdict.empty",
};

/**
 * 拒答梯度对照表。
 *
 * 数据来自 `probe_refusal` 落盘的记录（工具写、面板读），面板不自己发请求：
 * 它没有模型凭据，也不该把密钥搬进渲染进程。两个按钮分别对应「再测一次」与
 * 「把这张表交给对话继续分析」——后者把表格行与改写建议一起带过去，避免只丢一个结论。
 */
export function ProbeRefusalCard({ record, onRun, onDiscuss, refresh }: ProbeRefusalCardProps) {
	const { t } = useTranslation();
	const advice = record ? adviceFor(record.rows) : [];
	const actionable = advice.filter(item => item.tiers.length > 0);

	return (
		<Card
			title={t("probe.title")}
			actions={
				<>
					<button
						type="button"
						onClick={refresh}
						title={t("probe.refreshHint")}
						className="rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						<Icon name="refresh" className="size-3" />
					</button>
					<button
						type="button"
						onClick={onRun}
						className="rounded-md border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						{t("probe.run")}
					</button>
				</>
			}
			bodyClassName="p-0"
		>
			{record === null ? (
				<div className="px-3.5 py-3">
					<p className="text-[11px] leading-relaxed text-text-3">{t("probe.empty")}</p>
					<p className="mt-1 font-mono text-[10px] text-text-4">{t("probe.emptyHint")}</p>
				</div>
			) : (
				<>
					<div className="flex flex-wrap items-center gap-2 border-b border-line-subtle px-3.5 py-2 text-[10.5px]">
						<span className="font-mono text-text-2">{record.model}</span>
						<span className="text-text-4">·</span>
						<span className="truncate font-mono text-text-4">{record.host}</span>
						<span className="text-text-4">·</span>
						<span className="text-text-4">{record.at.slice(0, 19).replace("T", " ")}</span>
						<span className="ml-auto min-w-0 truncate text-text-2">{record.summary.headline}</span>
					</div>

					<div className="fb-scroll m-2 overflow-x-auto rounded-lg ring-1 ring-line-subtle">
						<table className="w-full border-collapse text-left text-[11px]">
							<thead className="bg-surface-3">
								<tr>
									<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.level")}</th>
									<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.probe")}</th>
									<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.verdict")}</th>
									<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.kind")}</th>
									<th className="border-b border-line-subtle px-2.5 py-1 font-semibold text-text">{t("probe.col.advice")}</th>
								</tr>
							</thead>
							<tbody>
								{advice.map(item => (
									<tr key={item.level} className="even:bg-surface-2">
										<td className="border-b border-line-subtle px-2.5 py-1 font-mono tabular-nums text-text-2">{item.level}</td>
										<td className="border-b border-line-subtle px-2.5 py-1 text-text-2">{t(`probe.level.${item.level}`)}</td>
										<td className={`border-b border-line-subtle px-2.5 py-1 font-medium ${VERDICT_TONE[item.verdict]}`}>
											{t(VERDICT_KEY[item.verdict])}
										</td>
										<td className="border-b border-line-subtle px-2.5 py-1 font-mono text-[10px] text-text-3">{item.kind ?? "—"}</td>
										<td className="border-b border-line-subtle px-2.5 py-1 text-[10.5px] leading-relaxed text-text-3">
											{item.tiers.length > 0 ? (
												<span className="flex flex-wrap gap-1">
													{item.tiers.map(tier => (
														<span key={tier} className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[9.5px] text-text-2">
													{t(`probe.reshape.${tier}`)}
														</span>
													))}
												</span>
											) : (
												item.note
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="flex flex-wrap items-center gap-2 border-t border-line-subtle px-3.5 py-2">
						<span className="text-[10.5px] text-text-4">{t("probe.advice.count", { count: actionable.length })}</span>
						<button
							type="button"
							onClick={onDiscuss}
							className="ml-auto inline-flex items-center gap-1 rounded-md bg-text px-2 py-1 text-[10.5px] font-medium text-surface"
						>
							<Icon name="send" className="size-3" />
							{t("probe.discuss")}
						</button>
					</div>
				</>
			)}
		</Card>
	);
}