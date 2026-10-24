import { useMemo, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { Card } from "../shell/card";
import { PageHeader } from "../shell/page-header";
import { createBackup } from "../../../../domain/prompt-backup";
import type { PromptFormData } from "../prompts/prompt-editor-dialog";
import { PromptEditorDialog } from "../prompts/prompt-editor-dialog";
import { PromptCard } from "../prompts/prompt-card";
import { BackupRestoreDialog } from "../prompts/backup-restore-dialog";
import { InjectBlockCard } from "../prompts/inject-block-card";
import type { PageProps } from "./overview";

/**
 * 提示词库页面。
 *
 * 等价于寒霜注入工具的 PromptWorkbench：用户可以创建多套提示词、
 * 激活其中一套、在不同场景之间切换。修改前自动备份，可一键还原。
 */
export function PromptsPage({ model }: PageProps) {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const [editorOpen, setEditorOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [backupPromptId, setBackupPromptId] = useState<string | null>(null);

	const library = model.promptLibrary;
	const backups = model.promptBackups;

	const editing = editingId ? library.items.find(p => p.id === editingId) ?? null : null;

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		const items = q
			? library.items.filter(
					p =>
						p.name.toLowerCase().includes(q) ||
						p.description.toLowerCase().includes(q) ||
						p.content.toLowerCase().includes(q),
				)
			: library.items;
		return [...items].sort((a, b) => {
			if (a.active !== b.active) return a.active ? -1 : 1;
			return b.updatedAt - a.updatedAt;
		});
	}, [library.items, query]);

	const promptBackups = useMemo(
		() => backups.filter(b => b.promptId === backupPromptId),
		[backups, backupPromptId],
	);

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

	function handleDelete(id: string) {
		if (!confirm(t("prompt.deleteConfirm"))) return;
		model.deletePrompt(id);
	}

	return (
		<>
			<PageHeader
				title={t("page.prompts.title")}
				description={t("page.prompts.lead")}
				actions={
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
				}
			/>

			<div className="space-y-3 p-4">
				{library.items.length > 0 ? (
					<Card title={t("prompt.libraryTitle")} bodyClassName="p-3">
						<div className="mb-3">
							<input
								type="text"
								value={query}
								onChange={e => setQuery(e.target.value)}
								placeholder={t("prompt.searchPlaceholder")}
								className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-[12px] text-text outline-none focus:border-purple"
							/>
						</div>

						{filtered.length === 0 ? (
							<div className="py-8 text-center text-[12px] text-text-4">{t("prompt.searchEmpty")}</div>
						) : (
							<div className="grid gap-2.5 @min-[640px]:grid-cols-2">
								{filtered.map(prompt => (
									<PromptCard
										key={prompt.id}
										prompt={prompt}
										onActivate={() => model.activatePrompt(prompt.id)}
										onDeactivate={() => model.deactivatePrompt()}
										onEdit={() => {
											setEditingId(prompt.id);
											setEditorOpen(true);
										}}
										onDelete={() => handleDelete(prompt.id)}
										onShowBackups={() => setBackupPromptId(prompt.id)}
									/>
								))}
							</div>
						)}
					</Card>
				) : (
					<Card bodyClassName="p-8">
						<div className="text-center">
							<div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-surface-3 text-text-4">
								📝
							</div>
							<h3 className="text-[13px] font-semibold text-text">{t("prompt.emptyTitle")}</h3>
							<p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-text-4">{t("prompt.emptyBody")}</p>
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

				<InjectBlockCard library={library} notify={model.notify} />
			</div>

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
		</>
	);
}
