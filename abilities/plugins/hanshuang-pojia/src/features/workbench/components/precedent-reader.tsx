import { useEffect, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { readPrecedentDoc, type ShippedPrecedent } from "../../../domain/case/precedents";
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
 * 索引在分块里，正文按需读取（`assets/cases/<slug>/`）：点开哪一篇读哪一篇，
 * 切换标签不重复抓包。它的 scope 恒为 `pending`，页面上不提供任何「可开工」的暗示，
 * 只给「复制成你的案例」一个动作。
 */
export function PrecedentReader({ precedent, onOpenStudy, onScaffold, busy }: PrecedentReaderProps) {
	const { t } = useTranslation();
	const [active, setActive] = useState(precedent.docs[0]?.id ?? null);
	const doc = precedent.docs.find(entry => entry.id === active) ?? precedent.docs[0];
	const docId = doc?.id ?? null;
	const [body, setBody] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const packagePath = `cases/${precedent.slug}/`;

	useEffect(() => {
		let cancelled = false;
		setBody(null);
		setFailed(false);
		if (!docId) return;
		readPrecedentDoc(precedent, docId).then(
			text => {
				if (!cancelled) setBody(text ?? null);
			},
			() => {
				if (!cancelled) setFailed(true);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [precedent, docId]);

	return (
		<>
			{/* 头部与 tabs 固定高度，正文吃剩余：不加 shrink-0 时正文会把 tabs 挤出去。 */}
			<div className="flex shrink-0 min-w-0 flex-wrap items-center gap-1.5 px-3.5 pt-2.5">
				<span className="min-w-0 fb-wrap font-mono text-[10.5px] text-text-4" title={packagePath}>
					{packagePath}
				</span>
				<Tag tone="neutral">{precedent.preset}</Tag>
				<Tag tone="medium">{t("cases.precedent.pending")}</Tag>
				<Tag tone="neutral">{t("cases.precedent.docs", { count: precedent.docs.length })}</Tag>
				<Tag tone="neutral">{t("cases.precedent.runnable", { count: precedent.tools.tools.length, runtime: precedent.tools.runtime })}</Tag>
			</div>

			<p className="mt-2 shrink-0 px-3.5 text-[11.5px] leading-relaxed text-text-3">{precedent.summary}</p>

			<div className="mt-2 flex shrink-0 min-w-0 flex-wrap items-center gap-1.5 px-3.5">
				<span className="text-[10.5px] font-medium uppercase tracking-wider text-text-4">{t("cases.precedent.col.signals")}</span>
				{precedent.signals.map(signal => (
					<Tag key={signal} tone="neutral" className="font-mono">
						{signal}
					</Tag>
				))}
			</div>

			<div className="mt-2.5 flex shrink-0 min-w-0 flex-wrap items-center gap-1.5 px-3.5 pb-2.5">
				<AiButton label={t("cases.precedent.open")} onClick={onScaffold} busy={busy} />
				{/* 多个 caseDocs 只出一个入口：同名的按钮叠在一起看着像冗余项。 */}
				{precedent.caseDocs.length > 0 ? (
					<button
						type="button"
						onClick={() => onOpenStudy(precedent.caseDocs[0])}
						title={precedent.caseDocs.join(", ")}
						className="inline-flex min-w-0 items-center gap-1 rounded border border-line-subtle px-1.5 py-0.5 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
					>
						<Icon name="book" className="size-3 shrink-0" />
						<span className="fb-wrap">{t("cases.precedent.study")}</span>
						{precedent.caseDocs.length > 1 ? (
							<span className="shrink-0 font-mono text-[9.5px] text-text-4">{precedent.caseDocs.length}</span>
						) : null}
					</button>
				) : null}
			</div>

			{precedent.fieldNotes.length > 0 ? (
				<p className="px-3.5 pb-2 text-[10.5px] leading-relaxed text-text-4">{t("cases.precedent.notes", { notes: precedent.fieldNotes.join(", ") })}</p>
			) : null}

			<div className="shrink-0">
				<DocTabs items={precedent.docs.map(entry => ({ id: entry.id, label: entry.id }))} value={doc?.id ?? null} onChange={setActive} testId="precedent-doc-tabs" />
			</div>

			{doc ? (
				<div className="fb-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
					{body !== null ? (
						<Markdown source={body} />
					) : (
						<p className="text-[11.5px] text-text-4">{failed ? t("cases.reader.unreadable") : t("cases.reader.loading")}</p>
					)}
				</div>
			) : (
				<div className="px-3.5 py-6 text-center text-[11.5px] text-text-4">{t("cases.reader.nofiles")}</div>
			)}
		</>
	);
}
