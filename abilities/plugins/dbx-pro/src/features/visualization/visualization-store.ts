/**
 * visualization-store — 可视化（看板 / 大屏）产物存储。
 *
 * 存的是工具（dbx_chart_collection）生成的产物：新增、列出、删除、清空，持久化到宿主存储。
 * 文档格式与 v1 → v2 迁移规则在 domain/visualization-doc；这里只管状态与落盘。
 *
 * 写入模型：**模块级单例 + 外部状态**。此前每个 useVisualizationStore() 各自
 * 持有一份数组快照，并在自己那份快照上整份写回；工作台与画廊同时打开时，
 * 画廊删掉一条就会把工作台刚生成的看板一并抹掉（顺序相反则复活已删条目）。
 * 现在列表只有一份，所有实例通过 useSyncExternalStore 读同一引用，写入先合并再落盘。
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import { getStorage, getUi } from "../../runtime-contract.ts";
import type { Visualization } from "./visualization-bridge";
import {
	readVisualizationDoc,
	toVisualizationDoc,
	type StoredVisualization,
} from "../../domain/visualization-doc.ts";

export type { Visualization, StoredVisualization };

const STORE_PATH = "visualizations.json";
/** 单文件容量上限。超限时丢弃**最旧**的条目，并明确告知用户（见 notifyTruncated）。 */
const MAX_VISUALIZATIONS = 100;

/** 唯一状态源；只有 emit() 会替换它，保证 useSyncExternalStore 快照引用稳定。 */
let items: StoredVisualization[] = [];

/** 是否已经发起过从宿主存储的读取（一个进程只读一次）。 */
let hydrateStarted = false;

/** 读取完成前是否已有本地写入；此时本地状态优先，避免读回旧数据覆盖用户操作。 */
let mutatedBeforeHydrate = false;

const listeners = new Set<() => void>();

function emit(next: StoredVisualization[]): void {
	items = next;
	for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot(): StoredVisualization[] {
	return items;
}

/**
 * 超出上限时丢弃的是最旧条目 —— 必须让用户看到。
 * 静默丢数据是缺陷：用户会以为产物已保存，直到某天发现它不见了。
 */
function notifyTruncated(dropped: number): void {
	if (dropped <= 0) return;
	try {
		getUi()?.notify?.({
			message: `BI 数据资产已达上限 ${MAX_VISUALIZATIONS} 条，最早的 ${dropped} 条未能保存`,
			variant: "warning",
		});
	} catch {
		/* 宿主不支持 notify 或运行时未就绪时静默忽略 */
	}
}

/** 落盘串行化：整份写入必须按调用顺序落地，否则后写的旧快照会盖掉新状态。 */
let writeChain: Promise<unknown> = Promise.resolve();

function persist(): Promise<void> {
	const flush = writeChain.then(
		() => writeJsonFile(getStorage(), STORE_PATH, toVisualizationDoc(items)),
		() => writeJsonFile(getStorage(), STORE_PATH, toVisualizationDoc(items)),
	);
	// 落盘失败不能打断主操作，但必须留痕，否则用户以为产物已保存。
	writeChain = flush.catch((error) => {
		console.warn("[dbx-pro] 可视化产物保存失败", error);
	});
	return writeChain.then(() => undefined);
}

async function hydrate(): Promise<void> {
	try {
		const doc = await readJsonFile<unknown>(getStorage(), STORE_PATH);
		const restored = readVisualizationDoc(doc);
		if (mutatedBeforeHydrate || restored.length === 0) return;
		const known = new Set(items.map((v) => v.id));
		const merged = [...items, ...restored.filter((v) => !known.has(v.id))];
		const kept = merged.slice(0, MAX_VISUALIZATIONS);
		emit(kept);
		notifyTruncated(merged.length - kept.length);
	} catch (error) {
		console.warn("[dbx-pro] 可视化产物读取失败", error);
	}
}

/** 惰性读取一次；任何实例挂载都会触发，读取结果成为共享状态。 */
function ensureHydrated(): void {
	if (hydrateStarted) return;
	hydrateStarted = true;
	void hydrate();
}

export function useVisualizationStore() {
	const visualizations = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	useEffect(() => {
		ensureHydrated();
	}, []);

	const addVisualization = useCallback((viz: Visualization): StoredVisualization => {
		const newViz: StoredVisualization = {
			...viz,
			id: `viz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			createdAt: Date.now(),
		};
		mutatedBeforeHydrate = true;
		const merged = [newViz, ...items];
		const kept = merged.slice(0, MAX_VISUALIZATIONS);
		emit(kept);
		notifyTruncated(merged.length - kept.length);
		void persist();
		return newViz;
	}, []);

	const removeVisualization = useCallback((id: string): void => {
		mutatedBeforeHydrate = true;
		emit(items.filter((v) => v.id !== id));
		void persist();
	}, []);

	const clearAll = useCallback((): void => {
		mutatedBeforeHydrate = true;
		emit([]);
		void persist();
	}, []);

	/**
	 * 局部更新一条产物：筛选变化、重新取数后的行 / 行数刷新都走这里。
	 * id 与 createdAt 是身份字段，不接受 patch 覆盖，避免调用方无意改掉引用关系。
	 */
	const updateVisualization = useCallback((id: string, patch: Partial<Visualization>): void => {
		mutatedBeforeHydrate = true;
		let matched = false;
		const next = items.map((viz) => {
			if (viz.id !== id) return viz;
			matched = true;
			return { ...viz, ...patch, id: viz.id, createdAt: viz.createdAt };
		});
		if (!matched) return;
		emit(next);
		void persist();
	}, []);

	return {
		visualizations,
		addVisualization,
		updateVisualization,
		removeVisualization,
		clearAll,
	};
}
