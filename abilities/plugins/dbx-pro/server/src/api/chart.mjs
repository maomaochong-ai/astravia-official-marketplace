/**
 * chart.mjs — 图表类型注册表（从 chart-registry.json 动态加载）。
 *   GET /api/chart/graphTypes
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
let _registryCache = null;

async function loadChartRegistry() {
	if (_registryCache) return _registryCache;
	try {
		const raw = await readFile(join(__dirname, "..", "engine", "chart-registry.json"), "utf-8");
		_registryCache = JSON.parse(raw);
		return _registryCache;
	} catch {
		return { graphTypes: [] };
	}
}

export function chartRoutes() {
	return [
		["/api/chart/graphTypes", "GET", false, async () => {
			const registry = await loadChartRegistry();
			return { graphTypes: registry.graphTypes ?? [] };
		}],
	];
}
