import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import { templateEntries, loadTemplateBody } from "../../services/templates";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import type { NotifyVariant } from "../../bridge";

export interface TemplateLibraryProps {
	/** 已有条目的正文，用于判断某个模板是否已经导入过。 */
	existing: readonly { content: string }[];
	/** 导入成一条可编辑的提示词；正文由这里现读，调用方不碰模板文件。 */
	onImport(data: { name: string; description: string; content: string }): void;
	notify(message: string, variant?: NotifyVariant): void;
}

/**
 * 预置模板库：随包分发的现成词表，**只读**，一键导入提示词库后就是用户自己的条目。
 *
 * 为什么是「导入」而不是「直接激活」：模板属于工具分发内容，直接激活会让用户
 * 在别处改不动它；导入之后成为库里的普通提示词，可编辑、可备份、可回滚 ——
 * 这正好覆盖「选择性注入 + 支持修改」两件事。
 *
 * 「已导入」的判定按正文比对，不按名字：用户可能改过标题，改过标题不代表没导入过。
 */
export function TemplateLibrary({ existing, onImport, notify }: TemplateLibraryProps) {
	const { t } = useTranslation();
	const [busy, setBusy] = useState<string | null>(null);
	const entries = templateEntries();

	const has = (body: string) => existing.some(item => item.content.trim() === body.trim());

	const importOne = async (id: string, title: string, description: string) => {
		setBusy(id);
		try {
			const content = await loadTemplateBody(id);
			if (has(content)) {
				notify(t("template.alreadyImported", { name: title }), "info");
				return;
			}
			onImport({ name: title, description, content });
			notify(t("template.imported", { name: title }), "success");
		} catch (error) {
			notify(error instanceof Error ? error.message : String(error), "error");
		} finally {
			setBusy(null);
		}
	};

	return (
		<Card
			title={t("template.title")}
			actions={<span className="font-mono text-[10px] text-text-4">{entries.length}</span>}
			bodyClassName="p-0"
		>
			<p className="border-b border-line-subtle px-3.5 py-2 text-[10.5px] leading-relaxed text-text-3">{t("template.lead")}</p>
			<div className="fb-scroll max-h-[260px] divide-y divide-line-subtle overflow-y-auto">
				{entries.map(entry => (
					<div key={entry.id} className="flex items-start gap-2 px-3.5 py-2">
						<Icon name="file" className="mt-0.5 size-3 shrink-0 text-text-4" />
						<div className="min-w-0 flex-1">
							<div className="truncate text-[11.5px] text-text" title={entry.id}>
								{entry.title}
							</div>
							<div className="line-clamp-2 text-[10px] leading-relaxed text-text-4">{entry.summary}</div>
							<div className="mt-0.5 font-mono text-[9.5px] text-text-4">{entry.chars} chars</div>
						</div>
						<button
							type="button"
							disabled={busy !== null}
							onClick={() => void importOne(entry.id, entry.title, entry.summary)}
							className="shrink-0 rounded-md border border-line-subtle px-2 py-1 text-[10.5px] text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
						>
							{busy === entry.id ? t("template.importing") : t("template.import")}
						</button>
					</div>
				))}
			</div>
		</Card>
	);
}
