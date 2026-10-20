import { useTranslation } from "@astravia-org/plugin-sdk";
import { formatBytes } from "../../../../domain/report/report";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { EmptyState } from "../shell/empty-state";
import { NumberField } from "../shell/number-field";
import { PageHeader } from "../shell/page-header";
import { DataTable, type DataTableRow } from "../shell/data-table";
import { StatTile } from "../shell/stat-tile";
import { sectionRows } from "../../sections";
import type { PageProps } from "./overview";

const PACKED = 7.2;
const SEMI = 5.5;

function barClass(value: number): string {
	if (value >= PACKED) return "bg-risk-high";
	if (value >= SEMI) return "bg-risk-medium";
	return "bg-risk-low";
}

/** 熵分布：整份样本切桶算香农熵，用来判断哪一段被压缩或加密。 */
export function EntropyPage({ model }: PageProps) {
	const { t } = useTranslation();
	const busy = model.chat.sending;
	const buckets = model.entropy;
	const nativeSections = sectionRows(model.report, "native-sections");

	if (buckets === null) {
		return (
			<>
				<PageHeader title={t("page.entropy.title")} description={t("page.entropy.lead")} />
				<EmptyState icon="activity" title={t("entropy.null.title")} body={t("entropy.null.body")} />
			</>
		);
	}

	const peak = buckets.reduce((max, bucket) => Math.max(max, bucket.entropy), 0);
	const packed = buckets.filter(bucket => bucket.entropy >= PACKED).length;
	const average = buckets.length > 0 ? buckets.reduce((sum, bucket) => sum + bucket.entropy, 0) / buckets.length : 0;

	const rows: DataTableRow[] = buckets.map(bucket => ({
		key: String(bucket.offset),
		cells: [`0x${bucket.offset.toString(16)}`, formatBytes(bucket.length), bucket.entropy.toFixed(2)],
	}));

	return (
		<>
			<PageHeader
				title={t("page.entropy.title")}
				description={t("page.entropy.lead")}
				actions={<AiButton label={t("ai.entropy")} onClick={() => model.ask("entropy")} busy={busy} disabled={!model.report} />}
			/>
			<div className="space-y-3 p-4">
				<div className="grid grid-cols-3 gap-2">
					<StatTile label={t("entropy.average")} value={average.toFixed(2)} tone={average >= SEMI ? "medium" : "low"} />
					<StatTile label={t("entropy.peak")} value={peak.toFixed(2)} tone={peak >= PACKED ? "high" : "default"} />
					<StatTile label={t("entropy.packed")} value={packed} hint={t("entropy.packedHint", { buckets: buckets.length })} tone={packed > 0 ? "high" : "low"} />
				</div>

				<Card title={t("entropy.chart")} bodyClassName="px-3.5 py-3">
					<div className="flex h-24 items-end gap-px">
						{buckets.map(bucket => (
							<div
								key={bucket.offset}
								className={`min-w-px flex-1 rounded-sm ${barClass(bucket.entropy)}`}
								style={{ height: `${Math.max(4, (bucket.entropy / 8) * 100)}%` }}
								title={`0x${bucket.offset.toString(16)} · ${bucket.entropy.toFixed(2)}`}
							/>
						))}
					</div>
					<div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-text-4">
						<span>0x0</span>
						<span>{t("entropy.scale")}</span>
					</div>
					<p className="mt-2 text-[10.5px] leading-relaxed text-text-4">{t("entropy.note")}</p>
				</Card>

				<Card title={t("entropy.buckets")} bodyClassName="px-1 py-1">
					<DataTable columns={[t("entropy.col.offset"), t("entropy.col.size"), t("entropy.col.entropy")]} rows={rows} mono={[true, true, true]} />
				</Card>

				{nativeSections.length > 0 ? (
					<Card title={t("entropy.sections")} bodyClassName="px-1 py-1">
						<DataTable
							columns={[t("entropy.col.section"), t("entropy.col.sizeEntropy")]}
							rows={nativeSections.map(row => ({ key: row.label, cells: [row.label, row.value] }))}
							mono={[true, false]}
						/>
					</Card>
				) : null}

				<Card title={t("entropy.controls")} bodyClassName="divide-y divide-line-subtle">
					<NumberField
						label={t("entropy.bucketCount")}
						hint={t("entropy.bucketCount.hint")}
						value={model.settings.entropyBuckets}
						min={8}
						max={60}
						onChange={value => model.updateSettings({ entropyBuckets: value })}
					/>
				</Card>
			</div>
		</>
	);
}
