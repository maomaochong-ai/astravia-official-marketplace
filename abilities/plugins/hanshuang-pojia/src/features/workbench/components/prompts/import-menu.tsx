import { useTranslation } from "@astravia-org/plugin-sdk";
import { useRef, useState } from "react";
import { loadTemplateBody, templateEntries } from "../../services/templates";
import { Icon } from "../shell/icon";
import type { NotifyVariant } from "../../bridge";

export interface ImportMenuProps {
	/** 已有条目的正文，用于判断某个模板是否已经导入过。 */
	existing: readonly { content: string }[];
	/** 打开本地文件选择器（调用方持有 input）。 */
	onLocal(): void;
	/** 导入成一条可编辑的提示词。 */
	onTemplate(data: { name: string; description: string; content: string }): void;
	notify(message: string, variant?: NotifyVariant): void;
	/** 一键加入系统契约（SYSTEM.md 原文）。 */
	onSystemContract?(): void;
	/** 库里已经有系统契约时该条目禁用 —— 重复点只会多一条同正文的提示词。 */
	systemPresent?: boolean;
}

/**
 * 「导入」按钮 = 下拉菜单：本地文件 + 随包预制模板 + 系统契约。
 *
 * 三者做的是同一件事（往库里加一条只读条目），所以合并成一个入口。此前「系统契约」是
 * 页头单独一个按钮：它和「导入」并排却属于同一类动作，页头因此有四个控件，
 * 窄面板下会换行成两三行（而页头已经没有可见标题，那一行只剩按钮）。
 *
 * 模板本身只读；导入后就是库里的普通条目，可编辑、可备份、可激活。
 * 「已导入」按正文比对而不是按名字 —— 用户可能改过标题。
 */
export function ImportMenu({ existing, onLocal, onTemplate, notify, onSystemContract, systemPresent = false }: ImportMenuProps) {
	const { t } = useTranslation();
	const [busy, setBusy] = useState<string | null>(null);
	const details = useRef<HTMLDetailsElement | null>(null);
	const templates = templateEntries();

	const has = (body: string) => existing.some(item => item.content.trim() === body.trim());
	const close = () => {
		if (details.current) details.current.open = false;
	};

	const importOne = async (id: string, title: string, description: string) => {
		setBusy(id);
		try {
			const content = await loadTemplateBody(id);
			if (has(content)) {
				notify(t("template.alreadyImported", { name: title }), "info");
				return;
			}
			onTemplate({ name: title, description, content });
			notify(t("template.imported", { name: title }), "success");
		} catch (error) {
			notify(error instanceof Error ? error.message : String(error), "error");
		} finally {
			setBusy(null);
			close();
		}
	};

	return (
		<details ref={details} className="relative" data-testid="import-menu">
			<summary
				title={t("prompt.import.hint")}
				className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-line-subtle px-2.5 py-1.5 text-[11.5px] font-medium text-text-2 transition-colors hover:bg-surface-hover hover:text-text"
			>
				<Icon name="file" className="size-3.5" />
				{t("prompt.import.button")}
				<Icon name="chevron" className="size-3 rotate-90 opacity-60" />
			</summary>

			<div className="absolute end-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-lg bg-surface-2 py-1 shadow-lg ring-1 ring-line-strong">
				<button
					type="button"
					onClick={() => {
						close();
						onLocal();
					}}
					className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] text-text-2 transition-colors hover:bg-accent-soft hover:text-accent"
				>
					<Icon name="file" className="size-3 shrink-0 text-text-4" />
					{t("template.menu.local")}
				</button>

				<div className="mt-1 border-t border-line-subtle px-3 pb-1 pt-1.5 text-[9.5px] font-medium uppercase tracking-wider text-text-4">
					{t("template.menu.presets")}
				</div>
				<div className="fb-scroll max-h-[var(--fb-h-sm)] overflow-y-auto">
					{templates.map(entry => (
						<button
							key={entry.id}
							type="button"
							disabled={busy !== null}
							title={entry.summary}
							onClick={() => void importOne(entry.id, entry.title, entry.summary)}
							className="flex w-full flex-col gap-0.5 px-3 py-1.5 text-left transition-colors hover:bg-accent-soft disabled:opacity-40"
						>
							<span className="fb-wrap text-[11.5px] text-text">{entry.title}</span>
							<span className="truncate font-mono text-[9.5px] text-text-4">
								{busy === entry.id ? t("template.importing") : t("template.chars", { count: entry.chars })}
							</span>
						</button>
					))}
				</div>

				{onSystemContract ? (
					<>
						<div className="mt-1 border-t border-line-subtle px-3 pb-1 pt-1.5 text-[9.5px] font-medium uppercase tracking-wider text-text-4">
							{t("template.menu.systemGroup")}
						</div>
						<button
							type="button"
							disabled={systemPresent}
							// 禁用态必须有可见原因：只写在 title 里，触屏与读屏都拿不到。
							onClick={() => {
								close();
								onSystemContract();
							}}
							className="flex w-full flex-col gap-0.5 px-3 py-1.5 text-left transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
						>
							<span className="flex items-center gap-1.5 text-[11.5px] text-text">
								<Icon name="shield" className="size-3 shrink-0 text-text-4" />
								{t("prompt.template.button")}
							</span>
							<span className="fb-wrap text-[9.5px] leading-snug text-text-4">
								{systemPresent ? t("prompt.template.present") : t("template.menu.systemHint")}
							</span>
						</button>
					</>
				) : null}
			</div>
		</details>
	);
}
