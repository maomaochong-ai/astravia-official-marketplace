/**
 * use-canvas-history.ts — 画布撤销/重做（快照栈）。
 *
 * 模型对齐 ComfyUI 的 `changeTracker.captureCanvasState()`：一次“离散变更”产生一个历史点，
 * 拖拽/缩放节点这类连续手势只落一个历史点。这里用「空闲提交」实现等价语义 ——
 * 指纹变化后等 idleMs 无新变化才提交，于是整段拖拽折叠成一次。
 *
 * 约定：
 *   - 指纹（fingerprint）由调用方给出，且必须忽略选中态等临时字段，
 *     否则纯选择操作会污染历史；canvas-editor 的 `serializeCanvas` 已经满足这一点。
 *   - 撤销栈在换页时由 `reset(snapshot, fingerprint)` 重置，避免把「空画布 → 加载完成」
 *     误记成一步可撤销操作。
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface CanvasHistory {
	canUndo: boolean;
	canRedo: boolean;
	undo: () => void;
	redo: () => void;
	/** 换页/初次加载时调用：清空历史并以当前快照为基线。 */
	reset: (snapshot: unknown, fingerprint: string) => void;
}

interface Entry {
	snapshot: unknown;
	fingerprint: string;
}

export interface UseCanvasHistoryOptions {
	/** 当前快照（内容变化即触发一次待提交）。 */
	snapshot: unknown;
	/** 快照指纹 —— 相等视为无变化。 */
	fingerprint: string;
	/** 应用某个历史快照（写回 nodes/links）。 */
	onApply: (snapshot: never) => void;
	limit?: number;
	idleMs?: number;
}

const DEFAULT_LIMIT = 60;
const DEFAULT_IDLE_MS = 500;

export function useCanvasHistory({
	snapshot,
	fingerprint,
	onApply,
	limit = DEFAULT_LIMIT,
	idleMs = DEFAULT_IDLE_MS,
}: UseCanvasHistoryOptions): CanvasHistory {
	const onApplyRef = useRef(onApply);
	useEffect(() => {
		onApplyRef.current = onApply;
	});

	const limitRef = useRef(limit);
	limitRef.current = limit;

	const presentRef = useRef<Entry>({ snapshot, fingerprint });
	const pastRef = useRef<Entry[]>([]);
	const futureRef = useRef<Entry[]>([]);
	const pendingRef = useRef<Entry | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [counts, setCounts] = useState({ past: 0, future: 0 });
	// snapshot 每渲染都是一个新对象，用 ref 取最新值，避免空闲计时器被无关渲染反复重置
	const snapshotRef = useRef(snapshot);
	snapshotRef.current = snapshot;

	const clearTimer = useCallback(() => {
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const syncCounts = useCallback(() => {
		setCounts({ past: pastRef.current.length, future: futureRef.current.length });
	}, []);

	const commit = useCallback(
		(entry: Entry) => {
			if (entry.fingerprint === presentRef.current.fingerprint) return;
			pastRef.current.push(presentRef.current);
			while (pastRef.current.length > limitRef.current) pastRef.current.shift();
			presentRef.current = entry;
			futureRef.current = [];
			syncCounts();
		},
		[syncCounts],
	);

	/** 把待提交的最新状态落进历史（撤销前先调用，保证手势中的改动可被撤销）。 */
	const flush = useCallback(() => {
		clearTimer();
		const pending = pendingRef.current;
		pendingRef.current = null;
		if (pending) commit(pending);
	}, [clearTimer, commit]);

	useEffect(() => {
		if (fingerprint === presentRef.current.fingerprint) {
			pendingRef.current = null;
			clearTimer();
			return;
		}
		pendingRef.current = { snapshot: snapshotRef.current, fingerprint };
		clearTimer();
		timerRef.current = setTimeout(() => {
			timerRef.current = null;
			const pending = pendingRef.current;
			pendingRef.current = null;
			if (pending) commit(pending);
		}, idleMs);
		return clearTimer;
	}, [fingerprint, idleMs, commit, clearTimer]);

	const undo = useCallback(() => {
		flush();
		const previous = pastRef.current.pop();
		if (!previous) return;
		futureRef.current.unshift(presentRef.current);
		presentRef.current = previous;
		pendingRef.current = null;
		syncCounts();
		onApplyRef.current(previous.snapshot as never);
	}, [flush, syncCounts]);

	const redo = useCallback(() => {
		flush();
		const next = futureRef.current.shift();
		if (!next) return;
		pastRef.current.push(presentRef.current);
		while (pastRef.current.length > limitRef.current) pastRef.current.shift();
		presentRef.current = next;
		pendingRef.current = null;
		syncCounts();
		onApplyRef.current(next.snapshot as never);
	}, [flush, syncCounts]);

	const reset = useCallback(
		(nextSnapshot: unknown, nextFingerprint: string) => {
			clearTimer();
			pendingRef.current = null;
			pastRef.current = [];
			futureRef.current = [];
			presentRef.current = { snapshot: nextSnapshot, fingerprint: nextFingerprint };
			syncCounts();
		},
		[clearTimer, syncCounts],
	);

	return {
		canUndo: counts.past > 0,
		canRedo: counts.future > 0,
		undo,
		redo,
		reset,
	};
}
