import { useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ShippedPrecedent } from "../../../domain/case/precedents";
import { AiButton } from "./shell/ai-button";
import { DocTabs } from "./shell/doc-tabs";
import { Icon } from "./shell/icon";
import { Markdown } from "./shell/markdown";
import { Tag } from "./shell/tag";

export interface PrecedentReaderProps {
	precedent: ShippedPrecedent;
	/** 打开随包的完整战例研究（文档库里那几篇）。 */
	onOpenStudy(id: string): void;
	/** 让智能体按这份先例开一个真案例。 */
	onScaffold(): void;
	busy?: boolean;
}

/**
 * 一份随包先例的阅读视图。
 *
 * 正文在编译期已内联进 `precedents.generated.ts`，所以这里点开即读、不需要 IO；
 * 它的 scope 恒为 `pending`，页面上不提供任何「可开工」的暗示，只给「复制成你的案例」一个动作。
 */
export function PrecedentReader({ precedent, onOpenStudy, onScaffold, busy }: PrecedentReaderProps) {
	const { t } = useTranslation();
	const [active, setActive] = useState(precedent.docs[0]?.id ?? null);
	const doc = precedent.docs.find(entry => entry.id === active) ?? precedent.docs[0];
	const packagePath = `cases/${precedent.slug}/`;

	return (
		<>
			<div className="flex min-w-0 flex-wrap items-center gap-1.5 px-3.5 pt-2.5">
				<span className="min-w-0 truncate font-mono text-[10.5px] text-text-4" title={packagePath}>
					{packagePath}
				</span>
				<Tag tone="neutral">{precedent.preset}</Tag>
				<Tag tone="medium">{t("cases.precedent.pending")}</Tag>
				<Tag tone="neutral">{t("cases.precedent.docs", { count: precedent.docs.length })}</Tag>
				<Tag tone="neutral">{t("cases.precedent.runnable", { count: precedent.tools.tools.length, runtime: precedent.tools.runtime })}</Tag>
			</div>

			<p className="mt-2 px-3.5 text-[11px] leading-relaxed text-text-3">{precedent.summary}</p>

			<div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 px-3.5">
				<span className="text-[10px] font-medium uppercase tracking-wider text-text-4">{t("cases.precedent.col.signals")}</span>
				{precedent.signals.map(signal => (
					<Tag key={signal} tone="neutral" className="font-mono">
						{signal}
					</Tag>
				))}
			</div>

			<div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5 px-3.5 pb-2.5">
				<AiButton label={t("cases.precedent.open")} onClick={onScaffold} busy={busy} />
				{precedent.caseDocs.map(id => (
					<button
						key={id}
						type="button"
						onClick={() => onOpenStudy(id)}
						title={id}
						className="inline-flex min-w-0 items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						<Icon name="book" className="size-3 shrink-0" />
						<span className="truncate">{t("cases.precedent.study")}</span>
					</button>
				))}
			</div>

			{precedent.fieldNotes.length > 0 ? (
				<p className="px-3.5 pb-2 text-[10px] leading-relaxed text-text-4">{t("cases.precedent.notes", { notes: precedent.fieldNotes.join(", ") })}</p>
			) : null}

			<DocTabs items={precedent.docs.map(entry => ({ id: entry.id, label: entry.id }))} value={doc?.id ?? null} onChange={setActive} testId="precedent-doc-tabs" />

			{doc ? (
				<div className="fb-scroll max-h-[560px] overflow-y-auto px-3.5 py-3">
					<Markdown source={doc.text} />
				</div>
			) : (
				<div className="px-3.5 py-6 text-center text-[11.5px] text-text-4">{t("cases.reader.nofiles")}</div>
			)}
		</>
	);
}
