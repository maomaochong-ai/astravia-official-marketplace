import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo, useState } from "react";
import { STRING_KINDS, type StringKind } from "../../../../domain/string-kinds";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { DataTable, type DataTableRow } from "../shell/data-table";
import { EmptyState } from "../shell/empty-state";
import { FilterChips } from "../shell/filter-chips";
import { NumberField } from "../shell/number-field";
import { PageHeader } from "../shell/page-header";
import { StatTile } from "../shell/stat-tile";
import type { PageProps } from "./overview";

type Filter = StringKind | "all";

const MAX_ROWS = 400;

/** 字符串页：按类型分组的可打印串，全部在渲染进程里本机算出。 */
export function StringsPage({ model }: PageProps) {
	const { t } = useTranslation();
	const [filter, setFilter] = useState<Filter>("all");
	const busy = model.chat.sending;
	const hits = model.strings;

	const counts = useMemo(() => {
		const map = new Map<StringKind, number>();
		for (const hit of hits ?? []) map.set(hit.kind, (map.get(hit.kind) ?? 0) + 1);
		return map;
	}, [hits]);

	const visible = useMemo(() => (hits ?? []).filter(hit => filter === "all" || hit.kind === filter), [filter, hits]);

	const rows: DataTableRow[] = visible.slice(0, MAX_ROWS).map(hit => ({
		key: `${hit.offset}-${hit.value}`,
		cells: [`0x${hit.offset.toString(16)}`, t(`stringKind.${hit.kind}`), hit.value],
	}));

	const chips = [
		{ id: "all" as Filter, label: t("strings.filter.all"), count: hits?.length ?? 0 },
		...STRING_KINDS.map(kind => ({ id: kind as Filter, label: t(`stringKind.${kind}`), count: counts.get(kind) ?? 0 })),
	];

	return (
		<>
			<PageHeader
				title={t("page.strings.title")}
				description={t("page.strings.lead")}
				actions={<AiButton label={t("ai.strings")} onClick={() => model.ask("strings")} busy={busy} disabled={!model.report} />}
			/>
			<div className="space-y-3 p-4">
				{hits === null ? (
					<EmptyState icon="type" title={t("strings.null.title")} body={t("strings.null.body")} />
				) : (
					<>
						<div className="grid grid-cols-2 gap-2 @min-[720px]:grid-cols-4">
							<StatTile label={t("strings.stat.total")} value={hits.length} />
							<StatTile label={t("stringKind.url")} value={counts.get("url") ?? 0} />
							<StatTile label={t("stringKind.path")} value={counts.get("path") ?? 0} />
							<StatTile label={t("stringKind.identifier")} value={counts.get("identifier") ?? 0} />
						</div>

						<Card title={t("strings.controls")} bodyClassName="divide-y divide-line-subtle">
							<NumberField
								label={t("strings.minLength")}
								hint={t("strings.minLength.hint")}
								value={model.settings.stringsMinLength}
								min={4}
								max={24}
								onChange={value => model.updateSettings({ stringsMinLength: value })}
							/>
							<NumberField
								label={t("strings.limit")}
								hint={t("strings.limit.hint")}
								value={model.settings.stringsLimit}
								min={50}
								max={2000}
								step={50}
								onChange={value => model.updateSettings({ stringsLimit: value })}
							/>
						</Card>

						<Card
							title={t("page.strings.list")}
							actions={<FilterChips items={chips} value={filter} onChange={value => setFilter(value as Filter)} />}
							bodyClassName="px-1 pb-1"
						>
							<DataTable
								columns={[t("strings.col.offset"), t("strings.col.kind"), t("strings.col.value")]}
								rows={rows}
								mono={[true, false, true]}
								empty={t("strings.empty")}
							/>
							{visible.length > MAX_ROWS ? (
								<p className="px-3.5 py-2 text-[10px] text-text-4">{t("strings.truncated", { shown: MAX_ROWS, total: visible.length })}</p>
							) : null}
						</Card>
					</>
				)}
			</div>
		</>
	);
}
