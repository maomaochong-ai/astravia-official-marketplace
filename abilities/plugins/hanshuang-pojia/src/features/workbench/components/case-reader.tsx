import { useTranslation } from "@astravia-org/plugin-sdk";
import type { CaseRecord } from "../../../domain/case/library";
import type { CaseDocsModel } from "../hooks/use-case-docs";
import { DocTabs } from "./shell/doc-tabs";
import { Icon } from "./shell/icon";
import { Markdown } from "./shell/markdown";
import { Spinner } from "./shell/spinner";
import { Tag } from "./shell/tag";

export interface CaseReaderProps {
	record: CaseRecord;
	docs: CaseDocsModel;
}

/**
 * 一个本地案例的阅读视图：先给「这门能不能开」，再把案例自己的 Markdown 摊开。
 *
 * 只读。案例的声明、事件与证据都由智能体写，这里读出来只是为了让操作者不必离开面板。
 */
export function CaseReader({ record, docs }: CaseReaderProps) {
	const { t } = useTranslation();
	const done = record.workItems.filter(item => item.status === "done").length;

	return (
		<>
			<div className="flex min-w-0 flex-wrap items-center gap-1.5 px-3.5 pt-2.5">
				<span className="min-w-0 truncate font-mono text-[10.5px] text-text-4" title={record.path}>
					{record.path}
				</span>
				<Tag tone={record.ready ? "low" : "neutral"}>{record.ready ? t("cases.ready.yes") : t("cases.ready.no")}</Tag>
				<Tag tone={record.authStatus === "granted" ? "low" : "medium"}>{record.authStatus ?? "pending"}</Tag>
				{record.preset ? <Tag tone="neutral">{record.preset}</Tag> : null}
				{record.networkProfile ? <Tag tone="neutral">{record.networkProfile}</Tag> : null}
				<Tag tone={record.notes.implemented > 0 ? "purple" : "neutral"}>{t("cases.detail.notes", { kept: record.notes.implemented, dropped: record.notes.rejected })}</Tag>
				<Tag tone="neutral">{t("cases.detail.items", { done, total: record.workItems.length })}</Tag>
				<Tag tone="neutral">{t("cases.detail.evidence", { count: record.evidenceCount })}</Tag>
			</div>

			{record.blockers.length > 0 ? (
				<div className="mt-2.5 px-3.5">
					<p className="text-[10px] font-medium uppercase tracking-wider text-text-4">{t("cases.detail.blockers")}</p>
					<ul className="mt-1 space-y-1">
						{record.blockers.map(blocker => (
							<li key={blocker} className="flex items-start gap-1.5">
								<Icon name="ban" className="mt-0.5 size-3 shrink-0 text-risk-medium" />
								<span className="text-[10.5px] leading-relaxed text-text-3">{blocker}</span>
							</li>
						))}
					</ul>
				</div>
			) : null}

			<div className="mt-2.5 grid gap-2.5 px-3.5 pb-2.5 @min-[560px]:grid-cols-2">
				<List title={t("cases.detail.inScope")} items={record.inScope} />
				<List title={t("cases.detail.deliverables")} items={record.deliverables} />
			</div>

			<DocTabs items={docs.files.map(file => ({ id: file.id, label: file.label, hint: file.id }))} value={docs.active} onChange={docs.select} testId="case-doc-tabs" />

			{docs.files.length === 0 ? (
				<div className="px-3.5 py-6 text-center text-[11.5px] text-text-4">{t("cases.reader.nofiles")}</div>
			) : docs.error ? (
				<div className="px-3.5 py-6 text-center text-[11.5px] text-text-4">{t(docs.error)}</div>
			) : docs.loading && docs.body === null ? (
				<div className="flex items-center justify-center gap-2 px-3.5 py-10 text-[11.5px] text-text-4">
					<Spinner className="size-3" />
					{t("cases.reader.loading")}
				</div>
			) : docs.body !== null ? (
				<div className="fb-scroll max-h-[560px] overflow-y-auto px-3.5 py-3">
					<Markdown source={docs.body} />
				</div>
			) : null}
		</>
	);
}

function List({ title, items }: { title: string; items: readonly string[] }) {
	const { t } = useTranslation();
	return (
		<div className="min-w-0">
			<p className="text-[10px] font-medium uppercase tracking-wider text-text-4">{title}</p>
			{items.length === 0 ? (
				<p className="mt-1 text-[10.5px] text-text-4">{t("cases.detail.empty")}</p>
			) : (
				<ul className="mt-1 space-y-0.5">
					{items.map(item => (
						<li key={item} className="truncate font-mono text-[10.5px] text-text-3" title={item}>
							{item}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
