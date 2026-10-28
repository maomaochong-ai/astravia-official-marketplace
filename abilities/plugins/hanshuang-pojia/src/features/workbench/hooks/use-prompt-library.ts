/**
 * 提示词库的面板状态：列表、筛选、当前生效项、备份的增删。
 *
 * 数据与排序在 `domain/prompt-library`，这里只包一层 React 状态与副作用，
 * 页面不得再写第二份筛选或备份逻辑。
 */

import { useCallback, useEffect, useState } from "react";
import type { PromptBackup } from "../../../domain/prompt-backup";
import { pruneBackups, restoreFromBackup } from "../../../domain/prompt-backup";
import type { InjectMode, PromptItem, PromptLibrary } from "../../../domain/prompt-library";
import {
	activatePrompt as doActivate,
	createPrompt as doCreate,
	deactivateAll,
	deletePrompt as doDelete,
	EMPTY_LIBRARY,
	updatePrompt as doUpdate,
} from "../../../domain/prompt-library";
import type { WorkbenchBridge } from "../bridge";
import { nameDrafts, type PromptDraft } from "../services/prompt-import";

export interface PromptLibraryModel {
	library: PromptLibrary;
	backups: PromptBackup[];
	loaded: boolean;
	createPrompt(data: { name: string; description: string; content: string; mode: InjectMode }): void;
	/** 导入的草稿批量写库；同名自动加序号。 */
	importPrompts(drafts: readonly PromptDraft[]): void;
	updatePrompt(id: string, data: { name: string; description: string; content: string; mode: InjectMode }, backup?: PromptBackup): void;
	deletePrompt(id: string): void;
	activatePrompt(id: string): void;
	deactivatePrompt(): void;
	restorePromptFromBackup(promptId: string, backup: PromptBackup): void;
	deleteBackup(backupId: string): void;
}

const STORAGE_KEY_LIBRARY = "prompt-library";
const STORAGE_KEY_BACKUPS = "prompt-backups";

/** 提示词库与备份的持久化 hook。 */
export function usePromptLibrary(bridge: WorkbenchBridge): PromptLibraryModel {
	const [library, setLibrary] = useState<PromptLibrary>(EMPTY_LIBRARY);
	const [backups, setBackups] = useState<PromptBackup[]>([]);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		bridge
			.readState<PromptLibrary>(STORAGE_KEY_LIBRARY)
			.then(stored => {
				if (stored && Array.isArray(stored.items)) {
					setLibrary({
						items: stored.items.map(normalizeItem),
						activeId: typeof stored.activeId === "string" ? stored.activeId : null,
					});
				}
			})
			.catch(() => undefined)
			.finally(() => setLoaded(true));
		bridge
			.readState<PromptBackup[]>(STORAGE_KEY_BACKUPS)
			.then(stored => {
				if (Array.isArray(stored)) setBackups(stored.filter(b => b && typeof b.id === "string"));
			})
			.catch(() => undefined);
	}, [bridge]);

	useEffect(() => {
		if (!loaded) return;
		bridge.writeState(STORAGE_KEY_LIBRARY, library).catch(() => undefined);
	}, [bridge, library, loaded]);

	useEffect(() => {
		bridge.writeState(STORAGE_KEY_BACKUPS, backups).catch(() => undefined);
	}, [bridge, backups]);

	const createPrompt = useCallback(
		(data: { name: string; description: string; content: string; mode: InjectMode }) => {
			setLibrary(prev => ({
				...prev,
				items: [...prev.items, doCreate(data)],
			}));
		},
		[],
	);

	const updatePrompt = useCallback(
		(id: string, data: { name: string; description: string; content: string; mode: InjectMode }, backup?: PromptBackup) => {
			setLibrary(prev => doUpdate(prev, id, data));
			if (backup) {
				setBackups(prev => pruneBackups([...prev, backup], 10));
			}
		},
		[],
	);

	const deletePrompt = useCallback((id: string) => {
		setLibrary(prev => doDelete(prev, id));
	}, []);

	const activatePrompt = useCallback((id: string) => {
		setLibrary(prev => doActivate(prev, id));
	}, []);

	const deactivatePrompt = useCallback(() => {
		setLibrary(prev => deactivateAll(prev));
	}, []);

	const restorePromptFromBackup = useCallback((promptId: string, backup: PromptBackup) => {
		setLibrary(prev => ({
			...prev,
			items: prev.items.map(item => (item.id === promptId ? restoreFromBackup(item, backup) : item)),
		}));
	}, []);

	const importPrompts = useCallback((drafts: readonly PromptDraft[]) => {
		setLibrary(prev => ({
			...prev,
			items: [...prev.items, ...nameDrafts(drafts, prev.items.map(item => item.name)).map(draft => doCreate(draft))],
		}));
	}, []);

	const deleteBackup = useCallback((backupId: string) => {
		setBackups(prev => prev.filter(b => b.id !== backupId));
	}, []);

	return {
		createPrompt,
		importPrompts,
		library,
		backups,
		loaded,
		updatePrompt,
		deletePrompt,
		activatePrompt,
		deactivatePrompt,
		restorePromptFromBackup,
		deleteBackup,
	};
}

function normalizeItem(value: PromptItem): PromptItem {
	return {
		id: typeof value.id === "string" ? value.id : `prompt-${Date.now()}`,
		name: typeof value.name === "string" ? value.name : "",
		description: typeof value.description === "string" ? value.description : "",
		content: typeof value.content === "string" ? value.content : "",
		mode: value.mode === "override" || value.mode === "prepend" ? value.mode : "append",
		active: value.active === true,
		createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
		updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
	};
}
