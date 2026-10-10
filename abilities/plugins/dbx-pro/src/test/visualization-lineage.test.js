/**
 * visualization-lineage 的回归：产物引用了哪些表，以及谁引用了同一张表。
 *
 * 三条最容易悄悄错下去的语义各有断言，不靠人工判断：
 *   1. 表的身份是 (连接, 表名) —— 不同连接上的同名表不是同一张表；
 *   2. 反查必须排除自己 —— 产物自己当然引用了自己的表，不排除就成了自问自答；
 *   3. 旧格式快照没有取数 SQL —— 如实说明「只有表信息」，不用空串或反推的 SQL 冒充事实。
 *
 * 纯函数直接测；文案与接线渲染真实组件，避免「函数算对了但面板没接上」。
 * 面板是纯 props 组件，抽屉负责 store 与纯函数的接线 —— 所以两个层次都能单独盯。
 */

import assert from "node:assert/strict";
import { after, afterEach, describe, it } from "node:test";
import RTL from "@testing-library/react";
import { createElement } from "react";
import {
	collectLineageSources,
	collectLineageTables,
	findArtifactsByTable,
	formatLineageTable,
	formatLineageTime,
} from "../domain/visualization-lineage.ts";
import { setRuntime } from "../runtime-contract.ts";
import { VisualizationDetailDrawer } from "../features/visualization/components/visualization-detail-drawer.tsx";
import { VisualizationLineagePanel } from "../features/visualization/components/visualization-lineage-panel.tsx";
import { useVisualizationStore } from "../features/visualization/visualization-store.ts";

const { act, cleanup, render, renderHook } = RTL;

/** 内存 storage：让 store 的惰性读取拿到「没有文件」而不是抛错。 */
function createMemoryStorage() {
	const files = new Map();
	return {
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
	{ region: "华东", amount: 100 },
	{ region: "华南", amount: 200 },
];

/** 固定时间：本地时间构造，断言因此与时区无关。 */
const AT = new Date(2026, 0, 2, 3, 4, 5).getTime();

function makeDataset(overrides = {}) {
	return {
		id: "ds-1",
		title: "订单",
		connection: "pg",
		table: "orders",
		sql: "select region, amount from orders",
		columns: ["region", "amount"],
		rows: ROWS,
		rowCount: 5000,
		fetchedAt: AT,
		...overrides,
	};
}

/** 一条绑定了 ds-1 的图表（抽屉里会真的画出来）。 */
function makeItem(overrides = {}) {
	return {
		type: "bar",
		title: "GMV",
		data: { labels: ["华东", "华南"], datasets: [{ label: "amount", data: [100, 200] }] },
		source: { datasetId: "ds-1", labelColumn: "region", valueColumns: ["amount"] },
		...overrides,
	};
}

function makeViz(overrides = {}) {
	return {
		id: "viz-main",
		title: "本月 GMV",
		type: "dashboard",
		connection: "",
		table: "",
		chartItems: [makeItem()],
		datasets: [makeDataset()],
		filters: [],
		createdAt: AT,
		...overrides,
	};
}

function renderPanel(props) {
	const { container } = render(createElement(VisualizationLineagePanel, props));
	return container;
}

function mount(viz) {
	const { container } = render(
		createElement(VisualizationDetailDrawer, { viz, onClose: () => {}, onPreview: () => {} }),
	);
	return container;
}

describe("visualization-lineage · 纯函数", () => {
	it("(连接, 表名) 成对匹配：不同连接上的同名表是两张表", () => {
		const viz = makeViz({
			datasets: [
				makeDataset({ id: "ds-pg", connection: "pg", table: "orders" }),
				makeDataset({ id: "ds-mysql", connection: "mysql", table: "orders" }),
			],
		});

		assert.deepEqual(collectLineageTables(viz), [
			{ connection: "pg", table: "orders" },
			{ connection: "mysql", table: "orders" },
		]);
	});

	it("数据集是权威来源：同一张表只列一次，产物的追踪字段不额外算一个来源", () => {
		const viz = makeViz({
			// 追踪字段：Agent schema 不暴露，新产物通常为空
			connection: "pg",
			table: "some_tracking_table",
			datasets: [
				makeDataset({ id: "ds-a", connection: "pg", table: "orders" }),
				makeDataset({ id: "ds-b", connection: "pg", table: "orders" }),
			],
		});

		assert.deepEqual(
			collectLineageTables(viz),
			[{ connection: "pg", table: "orders" }],
			"两个数据集引用同一张表时应去重",
		);
	});

	it("旧格式快照：表来自产物的连接与表，但如实标注没有 SQL", () => {
		const legacy = makeViz({ id: "viz-legacy", connection: "pg", table: "orders", datasets: undefined });

		assert.deepEqual(collectLineageTables(legacy), [{ connection: "pg", table: "orders" }]);

		const sources = collectLineageSources(legacy);
		assert.equal(sources.length, 1);
		assert.equal(sources[0].kind, "snapshot");
		assert.equal(sources[0].connection, "pg");
		assert.equal(sources[0].table, "orders");
		assert.equal(sources[0].sql, null, "旧快照没有 SQL：必须是 null，不能用空串冒充");
		assert.equal(sources[0].rowCount, null);
		assert.equal(sources[0].loadedCount, null);
		assert.equal(sources[0].fetchedAt, null);
	});

	it("新产物的来源带 SQL 与行数口径：SQL 行数 ≠ 已载入行数", () => {
		const viz = makeViz({ datasets: [makeDataset({ rows: ROWS, rowCount: 5000 })] });
		const sources = collectLineageSources(viz);

		assert.equal(sources.length, 1);
		assert.equal(sources[0].kind, "dataset");
		assert.equal(sources[0].title, "订单");
		assert.equal(sources[0].sql, "select region, amount from orders");
		assert.equal(sources[0].rowCount, 5000, "SQL 完整结果行数");
		assert.equal(sources[0].loadedCount, 2, "已载入本地的行数");
		assert.equal(sources[0].fetchedAt, AT);
	});

	it("空 SQL 与空表名如实表达：sql 为 null，没有表名就不产生表", () => {
		assert.equal(
			collectLineageSources(makeViz({ datasets: [makeDataset({ sql: "" })] }))[0].sql,
			null,
			"空 SQL 应为 null，与「有 SQL」可区分",
		);

		const noTable = makeViz({
			connection: "",
			table: "",
			datasets: [makeDataset({ id: "ds-notable", connection: "", table: "" })],
		});
		assert.deepEqual(collectLineageTables(noTable), [], "连表名都没有时不产生表");
		assert.equal(collectLineageSources(noTable)[0].table, "");
	});

	it("反查只命中 (连接, 表名) 相同的产物，并排除自己", () => {
		const items = [
			{
				id: "viz-main",
				title: "本月 GMV",
				type: "dashboard",
				createdAt: 1,
				datasets: [makeDataset({ id: "m", connection: "pg", table: "orders" })],
			},
			{
				id: "viz-sibling",
				title: "订单明细",
				type: "screen",
				createdAt: 2,
				datasets: [makeDataset({ id: "s", connection: "pg", table: "orders" })],
			},
			{
				id: "viz-other-conn",
				title: "MySQL 订单",
				type: "dashboard",
				createdAt: 3,
				datasets: [makeDataset({ id: "o", connection: "mysql", table: "orders" })],
			},
			{
				id: "viz-other-table",
				title: "用户",
				type: "dashboard",
				createdAt: 4,
				datasets: [makeDataset({ id: "u", connection: "pg", table: "users" })],
			},
		];

		assert.deepEqual(
			findArtifactsByTable(items, { connection: "pg", table: "orders" }, "viz-main"),
			[{ id: "viz-sibling", title: "订单明细", type: "screen", createdAt: 2 }],
			"别的连接上的同名表、别的表都不应命中，自己必须被排除",
		);

		assert.equal(
			findArtifactsByTable(items, { connection: "pg", table: "orders" }).length,
			2,
			"不传 excludeId 时自己也在结果里（排除由调用方决定）",
		);
	});

	it("旧格式快照也能被反查到：与「引用了哪些表」共用同一套规则", () => {
		const items = [
			{
				id: "viz-new",
				title: "新产物",
				type: "dashboard",
				datasets: [makeDataset({ id: "n", connection: "pg", table: "orders" })],
			},
			{ id: "viz-legacy", title: "旧快照", type: "dashboard", connection: "pg", table: "orders", createdAt: 9 },
		];

		const found = findArtifactsByTable(items, { connection: "pg", table: "orders" }, "viz-new");
		assert.deepEqual(found.map((entry) => entry.id), ["viz-legacy"]);
		assert.equal(found[0].createdAt, 9);
	});

	it("反查的兜底值可显示可比较：缺 title / type / createdAt 时给出默认值", () => {
		const items = [{ id: "viz-bare", datasets: [makeDataset({ id: "b", connection: "pg", table: "orders" })] }];

		assert.deepEqual(findArtifactsByTable(items, { connection: "pg", table: "orders" }), [
			{ id: "viz-bare", title: "", type: "dashboard", createdAt: null },
		]);
		assert.deepEqual(
			findArtifactsByTable(items, { connection: "pg", table: "" }),
			[],
			"目标表为空时没有可匹配的表，不返回全部产物",
		);
	});

	it("时间格式化为本地 YYYY-MM-DD HH:mm，无效输入返回空串", () => {
		assert.equal(formatLineageTime(AT), "2026-01-02 03:04");
		assert.equal(formatLineageTime(new Date(2026, 11, 31, 23, 59, 59).getTime()), "2026-12-31 23:59", "月日时分补零");
		assert.equal(formatLineageTime(null), "");
		assert.equal(formatLineageTime(undefined), "");
		assert.equal(formatLineageTime(Number.NaN), "");
		assert.equal(formatLineageTime(Number.POSITIVE_INFINITY), "");
	});

	it("「连接 → 表」的展示文本：没有连接时只显示表名", () => {
		assert.equal(formatLineageTable({ connection: "pg", table: "orders" }), "pg → orders");
		assert.equal(formatLineageTable({ connection: "", table: "orders" }), "orders");
	});
});

describe("visualization-lineage · 面板文案", () => {
	it("来源区列出连接 → 表、行数口径与取数 SQL；反查区列出其他产物", () => {
		const viz = makeViz();
		const container = renderPanel({
			sources: collectLineageSources(viz),
			createdAt: viz.createdAt,
			references: [
				{
					table: { connection: "pg", table: "orders" },
					entries: [{ id: "viz-sibling", title: "订单明细", type: "screen", createdAt: AT }],
				},
			],
		});

		const text = container.textContent;
		assert.match(text, /血缘/);
		assert.match(text, /生成时间 2026-01-02 03:04/);
		assert.match(text, /pg → orders/);
		assert.match(text, /SQL 共 5000 行 \/ 已载入 2 行/);

		assert.equal(container.querySelectorAll(".viz-lineage .viz-sql").length, 1, "取数 SQL 应能展开查看");
		assert.match(container.querySelector(".viz-lineage .viz-sql").textContent, /from orders/);

		assert.match(text, /引用了同一张表的其他产物/);
		assert.match(text, /订单明细/);
		assert.match(container.querySelector(".viz-lineage-entry-meta").textContent, /大屏/, "反查条目要标出产物类型");
		assert.match(container.querySelector(".viz-lineage-entry-meta").textContent, /2026-01-02 03:04/);
	});

	it("旧格式快照如实说明「没有取数 SQL」，且不显示生成时间", () => {
		const legacy = makeViz({
			id: "viz-legacy",
			connection: "pg",
			table: "orders",
			datasets: undefined,
			createdAt: undefined,
		});
		const container = renderPanel({
			sources: collectLineageSources(legacy),
			createdAt: legacy.createdAt,
			references: [{ table: { connection: "pg", table: "orders" }, entries: [] }],
		});

		assert.match(container.textContent, /旧格式快照只有表信息，没有取数 SQL/);
		assert.doesNotMatch(container.textContent, /生成时间/, "时间未知时不编一个时间出来");
		assert.equal(container.querySelector(".viz-lineage .viz-sql"), null, "没有 SQL 就不该出现 SQL 块");
		assert.match(container.textContent, /暂无其他产物引用这张表/);
	});

	it("没有来源、也没有反查目标时说清楚，而不是给一个空壳", () => {
		const container = renderPanel({ sources: [], createdAt: null, references: [] });

		assert.match(container.textContent, /该产物没有记录数据来源。/);
		assert.equal(container.querySelector(".viz-lineage-group"), null, "没有要查的表就不显示反查区");
	});
});

describe("visualization-lineage · 抽屉接线", () => {
	it("抽屉里能看到来源与反查，且反查结果不含自己、也不含别的连接", () => {
		const store = renderHook(() => useVisualizationStore());

		// 真实接线：抽屉拿到的永远是 store 里那一份（id 与生成时间由 store 分配）
		let main;
		act(() => {
			main = store.result.current.addVisualization(makeViz({ title: "本月 GMV" }));
			store.result.current.addVisualization(
				makeViz({
					title: "订单明细",
					type: "screen",
					datasets: [
						makeDataset({
							id: "ds-sibling",
							connection: "pg",
							table: "orders",
							sql: "select count(*) from orders",
						}),
					],
				}),
			);
			store.result.current.addVisualization(
				makeViz({
					title: "MySQL 订单",
					datasets: [makeDataset({ id: "ds-mysql", connection: "mysql", table: "orders" })],
				}),
			);
		});

		const container = mount(main);
		const lineage = container.querySelector(".viz-lineage");
		assert.ok(lineage, "抽屉里应有血缘区");

		// 生成时间由 store 分配，这里只校验格式（精确格式由上面的面板用例盯住）
		assert.match(lineage.textContent, /生成时间 \d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
		assert.match(lineage.textContent, /pg → orders/);
		assert.equal(lineage.querySelectorAll(".viz-lineage .viz-sql").length, 1, "来源应带上自己的取数 SQL");
		assert.match(lineage.querySelector(".viz-lineage .viz-sql").textContent, /from orders/);

		const entries = [...lineage.querySelectorAll(".viz-lineage-entry")];
		assert.equal(entries.length, 1, "同连接同表的其他产物恰好一个：自己与别的连接都不该出现");
		assert.match(entries[0].textContent, /订单明细/);
		assert.match(entries[0].textContent, /大屏/);
		assert.doesNotMatch(lineage.textContent, /MySQL 订单/, "同名表在别的连接上不算同一张表");
		assert.doesNotMatch(lineage.textContent, /本月 GMV/, "反查不能把自己列出来");
	});
});
