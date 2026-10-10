/**
 * 详情抽屉的接线回归：改筛选必须真的走到图表数据源上。
 *
 * 纯函数测试（dataset-filter / chart-source）证明不了接线 ——
 * 中间少接一环，或者只在「重算后传给了 props」处断掉，纯函数测试照样全绿。
 * 所以这里渲染真实抽屉，用真实 Chart.js 运行时画图，然后去问 canvas 上那个 Chart 实例
 * 「你现在拿到的是什么数据」。
 *
 * happy-dom 没有 2D context，但 Chart.js v4 仍会完成构造并把自己注册进 Chart.instances，
 * config.data 可读 —— 观察方式与 scripts/verify-chart-render.mjs 相同。
 *
 * 三条向后兼容语义也各有断言，不靠人工判断：
 *   - 旧产物（只有 html，无 datasets）只读，且导出仍用落库 html；
 *   - 没有 source 的静态图不随筛选变化，并给出可见提示；
 *   - 数据集被体积降级清空时，图表保留原快照而不是被清空。
 */

import assert from "node:assert/strict";
import { after, afterEach, describe, it } from "node:test";
import RTL from "@testing-library/react";
import { createElement } from "react";
import { setRuntime } from "../runtime-contract.ts";
import { resolveVisualizationHtml } from "../features/visualization/visualization-html.ts";
import { VisualizationDetailDrawer } from "../features/visualization/components/visualization-detail-drawer.tsx";

const { cleanup, fireEvent, render } = RTL;

/** 内存 storage：让 store 的惰性读取拿到「没有文件」而不是抛错。 */
function createMemoryStorage() {
	const files = new Map();
	return {
		files,
		readFile: (path) => Promise.resolve(files.has(path) ? files.get(path) : null),
		writeFile: (path, data) => {
			files.set(path, data);
			return Promise.resolve({ revision: "rev" });
		},
	};
}

setRuntime({ storage: createMemoryStorage() });
after(() => setRuntime(null));
afterEach(() => cleanup());

const ROWS = [
	{ region: "华东", gmv: 100 },
	{ region: "华南", gmv: 200 },
];

function makeDataset(overrides = {}) {
	return {
		id: "ds-1",
		title: "订单",
		connection: "db",
		table: "orders",
		sql: "SELECT region, SUM(amount) AS gmv FROM orders GROUP BY region",
		columns: ["region", "gmv"],
		rows: ROWS,
		rowCount: ROWS.length,
		fetchedAt: Date.now(),
		...overrides,
	};
}

function makeBoundItem(overrides = {}) {
	return {
		type: "bar",
		title: "GMV",
		data: { labels: ["华东", "华南"], datasets: [{ label: "gmv", data: [100, 200] }] },
		source: { datasetId: "ds-1", labelColumn: "region", valueColumns: ["gmv"] },
		...overrides,
	};
}

/** 没有 source 的静态快照图（旧产物 / AI 直接组好坐标的散点图都是这一类）。 */
function makeStaticItem() {
	return {
		type: "bar",
		title: "静态快照",
		data: { labels: ["A"], datasets: [{ label: "n", data: [7] }] },
	};
}

function makeViz(overrides = {}) {
	return {
		id: "viz-wiring",
		title: "月度 GMV",
		type: "dashboard",
		connection: "db",
		table: "orders",
		chartItems: [makeBoundItem()],
		datasets: [makeDataset()],
		filters: [],
		createdAt: Date.now(),
		...overrides,
	};
}

function mount(viz) {
	const { container } = render(
		createElement(VisualizationDetailDrawer, { viz, onClose: () => {}, onPreview: () => {} }),
	);
	return container;
}

/**
 * 全部已注册的 Chart 实例，按渲染顺序排列。
 *
 * 注意：happy-dom 没有 2D 上下文，Chart.js 拿不到 context 时会退回到自己创建的离屏
 * canvas，所以实例上的 `canvas` **不等于** DOM 里那个节点，`Chart.getChart(domCanvas)`
 * 找不到任何东西。但实例仍按顺序注册进 Chart.instances，config.data 可读 ——
 * 这正是我们要观察的对象（与 scripts/verify-chart-render.mjs 的观察方式一致）。
 */
function chartInstances() {
	const scope = globalThis.window ?? globalThis;
	const ChartCtor = scope.Chart;
	assert.equal(typeof ChartCtor, "function", "Chart.js 运行时未加载");
	return Object.values(ChartCtor.instances ?? {});
}

function chartDataAt(index) {
	const instances = chartInstances();
	assert.ok(instances[index], `没有第 ${index + 1} 个 Chart 实例`);
	return instances[index].config.data;
}

/** 实例数 = 图表数；顺便盯住「重渲染有没有漏销毁」。 */
function chartCount() {
	return chartInstances().length;
}

function canvasAt(container, index) {
	const canvases = container.querySelectorAll(".viz-canvas canvas");
	assert.ok(canvases[index], `没有第 ${index + 1} 个 canvas`);
	return canvases[index];
}

/** 勾选某个枚举取值（筛选面板里的 .viz-check 是 label 包 input）。 */
function clickChoice(container, text) {
	const labels = [...container.querySelectorAll(".viz-check")];
	const target = labels.find((label) => label.textContent.trim() === text);
	assert.ok(target, `筛选面板里没有取值「${text}」`);
	fireEvent.click(target.querySelector("input"));
}

describe("visualization-detail-wiring", () => {
	it("勾选筛选后图表数据源跟着变，清除后回到全量", () => {
		const container = mount(makeViz());
		canvasAt(container, 0); // 渲染的是 canvas 而不是「运行时未就绪」卡片
		assert.equal(chartCount(), 1, "只应有一个实例");

		const before = chartDataAt(0);
		assert.deepEqual(before.labels, ["华东", "华南"], "初始 labels");
		assert.deepEqual(before.datasets[0].data, [100, 200], "初始数据");
		assert.match(container.textContent, /筛选后\s*2\s*行/, "初始行数标注");

		clickChoice(container, "华南");

		const after = chartDataAt(0);
		assert.equal(chartCount(), 1, "重渲染后旧实例应已销毁");
		assert.deepEqual(after.labels, ["华南"], "筛选后 labels");
		assert.deepEqual(after.datasets[0].data, [200], "筛选后数据");
		assert.match(container.textContent, /筛选后\s*1\s*行\s*\/\s*已载入\s*2\s*行/, "筛选后行数标注");

		// 保留 AI 调好的 series 样式，只换数据
		assert.equal(after.datasets[0].label, "gmv", "series 名称不应被洗掉");

		const clear = [...container.querySelectorAll("button")].find((button) => button.textContent === "清除筛选");
		assert.ok(clear, "有筛选时应有「清除筛选」");
		fireEvent.click(clear);

		const restored = chartDataAt(0);
		assert.deepEqual(restored.labels, ["华东", "华南"], "清除后回到全量");
		assert.deepEqual(restored.datasets[0].data, [100, 200], "清除后回到全量数据");
	});

	it("度量列的区间筛选也接到图表上（不是只改标注）", () => {
		const container = mount(makeViz());
		const input = container.querySelector(".viz-range input");
		assert.ok(input, "度量列应给出区间输入框");

		// 注意：React 的 onChange 必须走 RTL 的 { target } 形式，直接改 .value 再 fireEvent.change
		// 到不了 React（实测 happy-dom 下 target.value 会变成空串）。
		fireEvent.change(input, { target: { value: "150" } });

		const data = chartDataAt(0);
		assert.deepEqual(data.labels, ["华南"], "区间筛后 labels");
		assert.deepEqual(data.datasets[0].data, [200], "区间筛后数据");
	});

	it("没有 source 的静态图不随筛选变化，并说明原因", () => {
		const container = mount(makeViz({ chartItems: [makeBoundItem(), makeStaticItem()] }));

		const notes = container.querySelectorAll(".viz-canvas-note");
		assert.equal(notes.length, 1, "只有静态图给出未绑定提示");
		assert.match(notes[0].textContent, /未绑定数据集/);
		assert.equal(chartCount(), 2, "两张图两个实例");
		assert.deepEqual(chartDataAt(1).datasets[0].data, [7], "静态图初始数据");

		clickChoice(container, "华南");

		assert.equal(chartCount(), 2, "重渲染后不应残留旧实例");
		assert.deepEqual(chartDataAt(0).datasets[0].data, [200], "绑定图跟随筛选");
		assert.deepEqual(chartDataAt(1).datasets[0].data, [7], "静态图不受影响");
	});

	it("旧产物（只有 html、无 datasets）只读：说明原因、不给筛选面板、禁用重新取数、导出仍用落库 html", () => {
		const html = "<!doctype html><html><body><p>legacy snapshot</p></body></html>";
		const legacy = makeViz({
			id: "viz-legacy",
			datasets: undefined,
			filters: undefined,
			chartItems: [makeStaticItem()],
			html,
		});
		const container = mount(legacy);

		assert.match(container.textContent, /没有数据集信息（旧格式快照）/, "应说明为什么不能筛选");
		assert.equal(container.querySelector(".viz-check"), null, "旧产物不应出现筛选控件");
		assert.equal(container.querySelector(".viz-field"), null, "旧产物不应出现数据集字段");
		assert.equal(container.querySelector(".viz-canvas-note"), null, "旧产物不该提示「未绑定数据集」");

		const refetch = [...container.querySelectorAll("button")].find((button) => button.textContent === "重新取数");
		assert.ok(refetch, "按钮仍在（只是不可用）");
		assert.equal(refetch.disabled, true, "无数据集时不能重新取数");

		assert.ok(canvasAt(container, 0), "旧产物仍可查看");
		assert.equal(resolveVisualizationHtml(legacy), html, "导出必须用落库的 html，而不是重建成残缺产物");
	});

	it("数据集被体积降级清空时：如实说明，且图表保留原快照而不是被清空", () => {
		const container = mount(makeViz({ datasets: [makeDataset({ rows: [], rowCount: 5000 })] }));

		assert.match(container.textContent, /数据已被裁剪（体积超限）/, "应说明数据被裁剪");
		assert.equal(container.querySelector(".viz-check"), null, "没有可筛的行时不给筛选控件");
		assert.match(container.textContent, /已载入\s*0\s*行/, "摘要里如实说 0 行");

		const data = chartDataAt(0);
		assert.deepEqual(data.labels, ["华东", "华南"], "图表保留原快照");
		assert.deepEqual(data.datasets[0].data, [100, 200], "图表不被空数组洗白");
	});
});
