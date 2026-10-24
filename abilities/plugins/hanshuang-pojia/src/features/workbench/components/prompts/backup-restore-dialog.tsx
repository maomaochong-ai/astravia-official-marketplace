import { useMemo } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PromptBackup } from "../../../../domain/prompt-backup";

export interface BackupRestoreDialogProps {
	open: boolean;
	backups: PromptBackup[];
	onClose(): void;
	onRestore(backup: PromptBackup): void;
	onDelete(backupId: string): void;
}

function formatTime(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleString();
}

/** 备份还原对话框：列出指定 prompt 的所有备份，支持还原和删除。 */
export function BackupRestoreDialog({ open, backups, onClose, onRestore, onDelete }: BackupRestoreDialogProps) {
	const { t } = useTranslation();
	const sorted = useMemo(() => [...backups].sort((a, b) => b.createdAt - a.createdAt), [backups]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
			<div
				className="flex max-h-[70vh] w-full max-w-xl flex-col rounded-lg border border-line bg-surface-2"
				onClick={e => e.stopPropagation()}
			>
				<div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
					<h2 className="text-[14px] font-semibold text-text">{t("prompt.backup.title")}</h2>
					<button type="button" onClick={onClose} className="text-text-4 hover:text-text" aria-label="close">
						✕
					</button>
				</div>

				<div className="fb-scroll min-h-0 flex-1 overflow-y-auto">
					{sorted.length === 0 ? (
						<div className="p-8 text-center text-[12px] text-text-4">{t("prompt.backup.empty")}</div>
					) : (
						<ul className="divide-y divide-line-subtle">
							{sorted.map(backup => (
								<li key={backup.id} className="flex items-center gap-3 px-4 py-2.5">
									<div className="min-w-0 flex-1">
										<div className="truncate text-[12px] font-medium text-text">{backup.promptName}</div>
										<div className="text-[10.5px] text-text-4">{formatTime(backup.createdAt)}</div>
									</div>
									<button
										type="button"
										onClick={() => onRestore(backup)}
										className="rounded-md bg-text px-2.5 py-1 text-[11px] font-medium text-surface hover:opacity-90"
									>
										{t("prompt.backup.restore")}
									</button>
									<button
										type="button"
										onClick={() => onDelete(backup.id)}
										className="rounded-md px-2 py-1 text-[11px] text-text-4 hover:text-risk-low"
									>
										{t("common.delete")}
									</button>
								</li>
							))}
						</ul>
					)}
				</div>

				<div className="flex items-center justify-end border-t border-line-subtle px-4 py-3">
					<button
						type="button"
						onClick={onClose}
						className="rounded-md px-3 py-1.5 text-[12px] text-text-3 hover:text-text"
					>
						{t("common.close")}
					</button>
				</div>
			</div>
		</div>
	);
}
