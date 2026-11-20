import { useTranslation } from "@astravia-org/plugin-sdk";
import { useMemo, useState } from "react";
import { STRING_KINDS, countKinds, type StringKind } from "../../../../domain/string-kinds";
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

const MAX_ROWS = 200;

/** 字符串页：按类型分组的可打印串，全部在渲染进程里本机算出。 */
export function StringsPage({ model }: PageProps) {
	const { t } = useTranslation();
	const [filter, setFilter] = useState<Filter>("all");
	// 值搜索：字符串页最常见的动作是「找那条带域名的串」，只按类型筛不够。
	const [query, setQuery] = useState("");
	const busy = model.chat.sending;
	const hits = model.strings;

	// 命中项自带 kind，计数直接复用领域层函数，不再在页面里维护第二份循环。
	const counts = useMemo(() => countKinds((hits ?? []).map(hit => hit.kind)), [hits]);

	/**
	 * 统计卡只放「真的有命中的前两类」。
	 *
	 * 上一版写死 url / path / identifier：IPv4 与邮箱常是这类样本最值钱的两类，
	 * 却永远看不到；而没命中时那一格又恒为 0。按数量取前二，剩下的交给筛选 chips
	 * （chips 里六类都带计数）。
	 */
	const topKinds = useMemo(
		() =>
			STRING_KINDS.map(kind => ({ kind, count: counts[kind] }))
				.filter(item => item.count > 0)
				.sort((left, right) => right.count - left.count)
				.slice(0, 2),
		[counts],
	);

	const visible = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return (hits ?? []).filter(
			hit => (filter === "all" || hit.kind === filter) && (!needle || hit.value.toLowerCase().includes(needle)),
		);
	}, [filter, hits, query]);

	// 类型标签只查一次：400 行逐行 t() 等于每次筛选 400 次查表。
	const kindLabel = useMemo(() => {
		const map = new Map<string, string>();
		for (const kind of STRING_KINDS) map.set(kind, t(`stringKind.${kind}`));
		return map;
	}, [t]);

	const rows: DataTableRow[] = useMemo(
		() =>
			visible.slice(0, MAX_ROWS).map(hit => ({
				key: `${hit.offset}-${hit.value}`,
				// 补齐到 8 位：不补的话 0x1f 与 0x1f0000 混排，列宽跳动像不同量级。
				cells: [`0x${hit.offset.toString(16).padStart(8, "0")}`, kindLabel.get(hit.kind) ?? hit.kind, hit.value],
			})),
		[visible, kindLabel],
	);

	const chips = [
		{ id: "all" as Filter, label: t("strings.filter.all"), count: hits?.length ?? 0 },
		...STRING_KINDS.map(kind => ({ id: kind as Filter, label: t(`stringKind.${kind}`), count: counts[kind] })),
	];

	return (
		<>
			<PageHeader
				title={t("page.strings.title")}
				description={t("page.strings.lead")}
				actions={<AiButton label={t("ai.strings")} onClick={() => model.ask("strings")} busy={busy} disabled={!model.report} />}
			/>
			<div className="fb-page">
				{hits === null ? (
					<EmptyState icon="type" title={t("strings.null.title")} body={t("strings.null.body")} />
				) : (
					<>
						<div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
							<StatTile label={t("strings.stat.total")} value={hits.length} />
							{topKinds.map(item => (
								<StatTile key={item.kind} label={t(`stringKind.${item.kind}`)} value={item.count} />
							))}
						</div>

						<Card title={t("strings.controls")} bodyClassName="divide-y divide-line-subtle" actions={<span className="text-[10.5px] text-text-4">{t("strings.controls.hint")}</span>}>
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
							bodyClassName="p-0"
						>
							<div className="border-b border-line-subtle px-3.5 py-2">
								<input
									value={query}
									onChange={event => setQuery(event.target.value)}
									placeholder={t("strings.search.placeholder")}
									aria-label={t("strings.search.placeholder")}
									className="w-full rounded border border-line-subtle bg-surface px-2 py-1 font-mono text-[11.5px] text-text outline-none placeholder:font-sans placeholder:text-text-4 focus:border-accent"
								/>
							</div>
							<div className="px-1 pb-1">
							<DataTable
								columns={[t("strings.col.offset"), t("strings.col.kind"), t("strings.col.value")]}
								rows={rows}
								mono={[true, false, true]}
								empty={t("strings.empty")}
							/>
							{visible.length > MAX_ROWS ? (
								<p className="px-3.5 py-2 text-[10.5px] text-text-4">{t("strings.truncated", { shown: MAX_ROWS, total: visible.length })}</p>
							) : null}
							</div>
						</Card>
					</>
				)}
			</div>
		</>
	);
}
