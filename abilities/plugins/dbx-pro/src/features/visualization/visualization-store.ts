/**
 * visualization-store — 可视化（看板/大屏）存储管理。
 * 
 * 存储生成的 HTML 可视化内容，支持：
 * - 添加新的可视化
 * - 列出所有可视化
 * - 删除可视化
 * - 持久化到 localStorage
 */

import { useState, useCallback, useEffect } from "react";
import type { Visualization } from "./visualization-bridge";

export type { Visualization };

export interface StoredVisualization extends Visualization {
	id: string;
	createdAt: number;
}

const STORAGE_KEY = "dbx-pro-visualizations";
const MAX_VISUALIZATIONS = 20;

function loadVisualizations(): StoredVisualization[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch {
		// ignore
	}
	return [];
}

function saveVisualizations(items: StoredVisualization[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_VISUALIZATIONS)));
	} catch {
		// ignore
	}
}

export function useVisualizationStore() {
	const [visualizations, setVisualizations] = useState<StoredVisualization[]>(() => loadVisualizations());

	useEffect(() => {
		saveVisualizations(visualizations);
	}, [visualizations]);

	const addVisualization = useCallback((viz: Visualization): StoredVisualization => {
		const newViz: StoredVisualization = {
			...viz,
			id: `viz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			createdAt: Date.now(),
		};
		setVisualizations((prev) => [newViz, ...prev].slice(0, MAX_VISUALIZATIONS));
		return newViz;
	}, []);

	const removeVisualization = useCallback((id: string): void => {
		setVisualizations((prev) => prev.filter((v) => v.id !== id));
	}, []);

	const clearAll = useCallback((): void => {
		setVisualizations([]);
	}, []);

	return {
		visualizations,
		addVisualization,
		removeVisualization,
		clearAll,
	};
}
