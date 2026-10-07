/**
 * visualization-store — 可视化（看板 / 大屏）产物存储。
 *
 * 存的是工具（dbx-dashboard / dbx-screen）生成的 HTML 产物：
 * 新增、列出、删除、清空，持久化到宿主存储。
 *
 * 写入模型：**模块级单例 + 外部状态**。此前每个 useVisualizationStore() 各自
 * 持有一份数组快照，并在自己那份快照上整份写回；工作台与画廊同时打开时，
 * 画廊删掉一条就会把工作台刚生成的看板一并抹掉（顺序相反则复活已删条目）。
 * 现在列表只有一份，所有实例通过 useSyncExternalStore 读同一引用，写入先合并再落盘。
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import { getStorage } from "../../runtime-contract.ts";
import type { Visualization } from "./visualization-bridge";

export type { Visualization };

export interface StoredVisualization extends Visualization {
	id: string;
	createdAt: number;
}

const STORE_PATH = "visualizations.json";
const STORE_SCHEMA_VERSION = 1;
const MAX_VISUALIZATIONS = 20;

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

/** 只接受结构可信的条目：非对象或缺 id 的一律丢弃，避免半截数据污染列表。 */
function normalize(value: unknown): StoredVisualization[] {
	if (!Array.isArray(value)) return [];
	return value.filter((entry): entry is StoredVisualization => {
		if (typeof entry !== "object" || entry === null) return false;
		const candidate = entry as Partial<StoredVisualization>;
		if (typeof candidate.id !== "string" || candidate.id.length === 0) return false;
		// legacy 迁移 —— 旧存储没有 chartItems（只有 html），自动补空数组，避免 gallery 里 undefined
		if (!Array.isArray(candidate.chartItems)) {
			candidate.chartItems = [];
		}
		return true;
	});
}

/** 落盘串行化：整份写入必须按调用顺序落地，否则后写的旧快照会盖掉新状态。 */
let writeChain: Promise<unknown> = Promise.resolve();

function persist(): Promise<void> {
	const flush = writeChain.then(
		() => writeJsonFile(getStorage(), STORE_PATH, { schemaVersion: STORE_SCHEMA_VERSION, items }),
		() => writeJsonFile(getStorage(), STORE_PATH, { schemaVersion: STORE_SCHEMA_VERSION, items }),
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
		const raw = Array.isArray(doc)
			? doc
			: (doc as { items?: unknown } | null)?.items;
		const restored = normalize(raw).slice(0, MAX_VISUALIZATIONS);
		if (mutatedBeforeHydrate || restored.length === 0) return;
		const known = new Set(items.map((v) => v.id));
		emit([...items, ...restored.filter((v) => !known.has(v.id))].slice(0, MAX_VISUALIZATIONS));
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
		emit([newViz, ...items].slice(0, MAX_VISUALIZATIONS));
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

	return {
		visualizations,
		addVisualization,
		removeVisualization,
		clearAll,
	};
}
