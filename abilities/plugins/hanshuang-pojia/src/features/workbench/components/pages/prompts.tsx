import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { Card } from "../shell/card";
import { PageHeader } from "../shell/page-header";
import { SegmentedControl } from "../shell/segmented-control";
import { backupsForPrompt, createBackup } from "../../../../domain/prompt-backup";
import { searchPromptHits, sortPrompts } from "../../../../domain/prompt-library";
import type { PromptFormData } from "../prompts/prompt-editor-dialog";
import { PromptEditorDialog } from "../prompts/prompt-editor-dialog";
import { PromptCard } from "../prompts/prompt-card";
import { BackupRestoreDialog } from "../prompts/backup-restore-dialog";
import { PromptPreviewDialog } from "../prompts/prompt-preview-dialog";
import { findSimilar, parsePromptFile, PromptImportError } from "../../services/prompt-import";
import { Icon } from "../shell/icon";
import { InjectBlockCard } from "../prompts/inject-block-card";
import { hasSystemTemplate, SYSTEM_PROMPT_TEMPLATE } from "../../../../domain/prompt-template";
import type { PageProps } from "./overview";
import { InjectPage } from "./inject";
import { ProbeRefusalCard } from "../prompts/probe-refusal-card";
import { ImportMenu } from "../prompts/import-menu";
import { PACKS } from "../../../../domain/inject/packs";

/** 两个视图：库列表 / 注入。它们回答同一个问题——「注入出去的是哪份提示词」。 */
type View = "prompts" | "inject";

/**
 * 提示词页：提示词库与注入合成一页，分段切换。
 *
 * 等价于寒霜注入工具的 PromptWorkbench，但把「写什么」和「注到哪」放在一处：
 * 以前注入块与注入目标矩阵各自占用侧栏入口，而提示词库与注入点互不可见——
 * 改了提示词还要切到另一页才知道它会注入成什么。
 *
 * 注入视图上下两块：上面是最终写进 `AGENTS.md` 的块正文，下面是目标矩阵与安装脚本。
 * 修改前自动备份，可一键还原；导入与系统契约入口只在库视图出现。
 */
export function PromptsPage({ model }: PageProps) {
	const { t } = useTranslation();
	const [view, setView] = useState<View>("prompts");
	// 注入视图的提示词包：卡片与目标矩阵共用，避免「切了包但计划没变」。
	const [packId, setPackId] = useState<string>(PACKS[0]?.id ?? "");
	const [query, setQuery] = useState("");
	const [editorOpen, setEditorOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [backupPromptId, setBackupPromptId] = useState<string | null>(null);
	// 预览窗只看内容；要改再跳编辑器，两件事不挤在一个弹窗里。
	const [previewId, setPreviewId] = useState<string | null>(null);
	const importRef = useRef<HTMLInputElement>(null);
	// 删除是破坏性动作：点一次只武装那一张卡，5 秒后自动收回。
	// 原生 confirm() 会阻断渲染进程、样式也跟不了主题，而且和活动页/注入页的确认形态不一致。
	const [armedDelete, setArmedDelete] = useState<string | null>(null);

	useEffect(() => {
		if (!armedDelete) return;
		const timer = window.setTimeout(() => setArmedDelete(null), 5_000);
		return () => window.clearTimeout(timer);
	}, [armedDelete]);

	const library = model.promptLibrary;
	const backups = model.promptBackups;

	const editing = editingId ? library.items.find(p => p.id === editingId) ?? null : null;
	// 模板已经在库里就不再提示注入：重复点只会多出一条同正文的提示词。
	const templatePresent = hasSystemTemplate(library.items);

	// 过滤与排序都在 domain/prompt-library 里，页面只做编排。
	// 搜索同时匹配正文，卡片只展示名称与描述：只命中正文时要把那段上下文摊出来，
	// 否则用户看到一张没有关键词的卡，会以为搜索坏了。
	const hits = useMemo(() => {
		const order = new Map(sortPrompts(library.items).map((item, index) => [item.id, index]));
		return [...searchPromptHits(library, query)].sort(
			(left, right) => (order.get(left.prompt.id) ?? 0) - (order.get(right.prompt.id) ?? 0),
		);
	}, [library, query]);

	const promptBackups = useMemo(
		() => (backupPromptId ? backupsForPrompt(backups, backupPromptId) : []),
		[backups, backupPromptId],
	);

	function readFile(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onerror = () => reject(reader.error ?? new Error("read-failed"));
			reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
			reader.readAsText(file);
		});
	}

	async function handleImport(files: File[]): Promise<void> {
		const drafts: ReturnType<typeof parsePromptFile> = [];
		let failed = 0;
		for (const file of files) {
			try {
				drafts.push(...parsePromptFile(file.name, await readFile(file)));
			} catch (error) {
				if (error instanceof PromptImportError) failed += 1;
				else throw error;
			}
		}
		if (drafts.length === 0) {
			model.notify(t("prompt.import.empty"), "warning");
			return;
		}
		// 内容几乎一致时先提一句，但不拦：用户可能就是要覆盖一版新的。
		const duplicate = findSimilar(library.items, drafts[0]!.content);
		if (duplicate) model.notify(t("prompt.import.similar", { name: duplicate.name }), "info");
		model.importPrompts(drafts);
		model.notify(t("prompt.import.done", { count: drafts.length }), "success");
		if (failed > 0) model.notify(t("prompt.import.skipped", { count: failed }), "warning");
	}

	function handleSubmit(data: PromptFormData) {
		if (editingId) {
			const original = library.items.find(p => p.id === editingId);
			if (original) {
				// 修改前先备份
				const backup = createBackup(original);
				model.updatePrompt(editingId, data, backup);
			}
		} else {
			model.createPrompt(data);
		}
		setEditorOpen(false);
		setEditingId(null);
	}

	function requestDelete(id: string) {
		if (armedDelete !== id) {
			setArmedDelete(id);
			return;
		}
		model.deletePrompt(id);
		setArmedDelete(null);
	}

	return (
		<>
			<PageHeader
				title={t("page.prompts.title")}
				description={t("page.prompts.lead")}
				actions={
					<>
						<SegmentedControl<View>
							size="sm"
							value={view}
							onValueChange={setView}
							ariaLabel={t("page.prompts.title")}
							items={[
								{ value: "prompts", label: t("prompt.view.library") },
								{ value: "inject", label: t("prompt.view.inject") },
							]}
						/>
						{view === "inject" ? null : (
							<>
								<ImportMenu
									existing={library.items}
									onLocal={() => importRef.current?.click()}
									onTemplate={data => model.createPrompt({ ...data, mode: "append" })}
									notify={model.notify}
									systemPresent={templatePresent}
									onSystemContract={() =>
										model.createPrompt({
											name: SYSTEM_PROMPT_TEMPLATE.name,
											description: SYSTEM_PROMPT_TEMPLATE.description,
											content: SYSTEM_PROMPT_TEMPLATE.content,
											mode: SYSTEM_PROMPT_TEMPLATE.mode,
										})
									}
								/>
								<button
									type="button"
									onClick={() => {
										setEditingId(null);
										setEditorOpen(true);
									}}
									className="flex items-center gap-1 rounded-md bg-text px-2.5 py-1.5 text-[11.5px] font-medium text-surface"
								>
									+ {t("prompt.editor.create")}
								</button>
							</>
						)}
					</>
				}
			/>

			{/* 导入只读一次文本：.md/.txt 单条，.json 备份文件批量。 */}
			<input
				ref={importRef}
				type="file"
				multiple
				accept=".md,.markdown,.txt,.json"
				className="hidden"
				tabIndex={-1}
				aria-hidden
				onChange={event => {
					const picked = [...(event.target.files ?? [])];
					event.target.value = "";
					if (picked.length > 0) void handleImport(picked);
				}}
			/>

			{view === "inject" ? (
				<div className="fb-page">
					{/* 上：最终写进 AGENTS.md 的块；中：拒答梯度对照；下：目标矩阵与安装脚本。 */}
					<InjectBlockCard library={library} notify={model.notify} packId={packId} onPackChange={setPackId} />
					{/* 拒答梯度：面板负责「要测谁 + 选梯度」，执行交给宿主 AI（面板没有凭据）。 */}
					<ProbeRefusalCard
						record={model.probe.record}
						hostModel={model.probe.hostModel}
						profile={model.probe.profile}
						patchProfile={model.probe.patchProfile}
						refresh={model.probe.refresh}
						// 简报由 domain 生成：参数、要看哪些字段、结果要什么形状都在里面，
						// 所以宿主不必追问，也不会把密钥回显到对话里。
						onBrief={brief => model.askText(brief)}
						onDiscuss={() =>
							model.askText("按面板里的拒答梯度对照表，告诉我每一档为什么被拦，并按对应改写档位给出可直接发出的改写版本。")
						}
					/>
					<InjectPage model={model} embedded packId={packId} />
				</div>
			) : (
				<div className="fb-page">
					{library.items.length > 0 ? (
						<>
						<Card
							title={t("prompt.libraryTitle")}
							bodyClassName="p-0"
							fill
							className="min-h-[220px]"
							actions={<span className="font-mono text-[10.5px] text-text-4">{hits.length}</span>}
						>
							<div className="shrink-0 border-b border-line-subtle p-3">
								<input
									type="text"
									value={query}
									onChange={e => setQuery(e.target.value)}
									placeholder={t("prompt.searchPlaceholder")}
									className="w-full rounded-md border border-line-subtle bg-surface px-3 py-1.5 text-[12px] text-text outline-none focus:border-accent"
								/>
							</div>
							{/* 列表自己滚：卡片贴到面板底部，不经 max-h 封顶。 */}
							<div className="fb-scroll fb-fill-scroll overflow-y-auto p-3">
								{hits.length === 0 ? (
									<div className="py-8 text-center text-[12px] text-text-4">{t("prompt.searchEmpty")}</div>
								) : (
									<div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-2.5">
										{hits.map(hit => (
											<PromptCard
												key={hit.prompt.id}
												prompt={hit.prompt}
												snippet={hit.snippet}
												deleteArmed={armedDelete === hit.prompt.id}
												onActivate={() => model.activatePrompt(hit.prompt.id)}
												onDeactivate={() => model.deactivatePrompt()}
												onPreview={() => setPreviewId(hit.prompt.id)}
												onEdit={() => {
													setEditingId(hit.prompt.id);
													setEditorOpen(true);
												}}
												onDelete={() => requestDelete(hit.prompt.id)}
												onShowBackups={() => setBackupPromptId(hit.prompt.id)}
											/>
										))}
									</div>
								)}
							</div>
						</Card>
						</>
					) : (
						<Card bodyClassName="p-8" fill>
							<div className="text-center">
								<div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-surface-3 text-text-4">
									<Icon name="nav-prompts" className="size-5" />
								</div>
								<h3 className="text-[13px] font-semibold text-text">{t("prompt.emptyTitle")}</h3>
								<p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-text-4">{t("prompt.emptyBody")}</p>
								<button
									type="button"
									onClick={() => setEditorOpen(true)}
									className="mt-4 rounded-md bg-text px-3 py-1.5 text-[12px] font-medium text-surface"
								>
									+ {t("prompt.editor.create")}
								</button>
							</div>
						</Card>
					)}
				</div>
			)}

			<PromptEditorDialog
				open={editorOpen}
				editing={editing}
				onClose={() => {
					setEditorOpen(false);
					setEditingId(null);
				}}
				onSubmit={handleSubmit}
			/>

			<BackupRestoreDialog
				open={backupPromptId !== null}
				backups={promptBackups}
				onClose={() => setBackupPromptId(null)}
				onRestore={backup => {
					if (backupPromptId) model.restorePromptFromBackup(backupPromptId, backup);
					setBackupPromptId(null);
				}}
				onDelete={backupId => model.deleteBackup(backupId)}
			/>

			<PromptPreviewDialog
				open={previewId !== null}
				prompt={previewId ? (library.items.find(item => item.id === previewId) ?? null) : null}
				onClose={() => setPreviewId(null)}
				onEdit={() => {
					setEditingId(previewId);
					setPreviewId(null);
					setEditorOpen(true);
				}}
				notify={model.notify}
			/>
		</>
	);
}
