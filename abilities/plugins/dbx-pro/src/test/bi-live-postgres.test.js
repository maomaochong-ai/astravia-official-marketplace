/**
 * bi-live-postgres — 「BI 数据资产」的真实 PostgreSQL 门控集成测试。
 *
 * 为什么要有这个文件：M1 的三条验收里，有几条只能真连接上才能回答 ——
 *   ① 真库生成 dashboard / screen 产物，且离线单文件仍能渲染（M1 验收 ③）
 *   ② 改筛选只重算前端、**不发起新的引擎查询**（M1 验收 ②）
 *   ③ 「重新取数」反映新数据；SQL 失败时引擎错误原样可见（M1 验收 ④）
 * 这些不能用纯函数单测替代（方案 §4 硬要求 ②）：纯函数能证明算法对，证明不了接线通。
 *
 * 被测的是**插件的真实取数链路**，不是手搓 HTTP：
 *   子进程真起 server/src/http-server.mjs（端口 0），把服务层的 services.request
 *   代理到它，于是 useDatasetRefetch → executeServerPage → engineExecuteByName
 *   全程走真实实现；引擎侧再经 dbx-mcp 打到本机真实的 PostgreSQL 17。
 *
 * 门控：本机连不上 PostgreSQL 时整组跳过 —— CI 上没有库，跳过是诚实的结果而不是失败。
 * 判据就是 `psql -d postgres -Atc "select 1"` 能跑通（同时验证了客户端与连通性）。
 *
 * 数据：在 database postgres 里建一次性 schema dbx_bi_e2e，结束 drop cascade，
 * 不污染用户自己的库；建表 / 插行 / 拆表都走 psql，让用例只聚焦「读 → 筛选 → 重取数」。
 */

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import RTL from "@testing-library/react";
import { createElement, useState } from "react";
import { Window } from "happy-dom";

import { bindEngineServices, engineAddConnection } from "../shared/services/engine-client.ts";
import { executeServerPage } from "../shared/services/execute-server-page.ts";
import { setRuntime } from "../runtime-contract.ts";
import { DATASET_ROW_LIMIT } from "../domain/dataset-spec.ts";
import { resolveChartItems } from "../domain/chart-source.ts";
import { resolveVisualizationHtml } from "../features/visualization/visualization-html.ts";
import { withEmbeddedChartJs } from "../shared/utils/chart-runtime.ts";
import { setSaveCallback } from "../features/visualization/visualization-bridge.ts";
import { createDbxChartCollectionTool } from "../tools/dbx-chart-collection.ts";
import { useDatasetRefetch } from "../features/visualization/hooks/use-dataset-refetch.ts";
import { DatasetFilterPanel } from "../features/visualization/components/dataset-filter-panel.tsx";

const { act, cleanup, fireEvent, render, renderHook, waitFor } = RTL;

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PLUGIN_ROOT = resolve(HERE, "..", "..");
const ENGINE_ENTRY = process.env.DBX_ENGINE_ENTRY ?? join(PLUGIN_ROOT, "server", "src", "http-server.mjs");
const TOKEN = "bi-live-token-1234567890";

const SCHEMA = "dbx_bi_e2e";
const TABLE = `${SCHEMA}.orders`;
const ORDER_SQL = `select region, amount from ${TABLE} order by region`;

/** 本机 PostgreSQL 的连接参数。空密码是本机 Homebrew pg 的 trust 认证，真连不上时会跳过而不是硬失败。 */
const PG_CONNECTION = {
	name: "pg-bi-live",
	dbType: "postgres",
	host: "127.0.0.1",
	port: 5432,
	username: process.env.PGUSER || process.env.USER || "postgres",
	password: "",
	database: "postgres",
};

function psql(sql) {
	return execFileSync("psql", ["-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atc", sql], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 15_000,
	});
}

function probePostgres() {
	try {
		psql("select 1");
		return true;
	} catch {
		return false;
	}
}

const LIVE = probePostgres();

/** 子进程起引擎，从 stdout 的 listening 事件取端口（与 engine-service.test.js 同一套机制）。 */
function startEngine({ args = [] } = {}) {
	return new Promise((resolvePromise, rejectPromise) => {
		const env = { ...process.env, ASTRAVIA_SERVICE_SECRET_ENGINE_KEY: TOKEN };
		const child = spawn(process.execPath, [ENGINE_ENTRY, "--port", "0", ...args], {
			env,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			rejectPromise(new Error(`引擎未在 20s 内就绪。stderr=${stderr}`));
		}, 20_000);
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
			for (const line of stdout.split("\n")) {
				if (!line.trim().startsWith("{")) continue;
				let event;
				try {
					event = JSON.parse(line);
				} catch {
					continue;
				}
				if (event.event === "listening") {
					clearTimeout(timer);
					resolvePromise({
						baseUrl: `http://127.0.0.1:${event.port}`,
						child,
						stop: () =>
							new Promise((done) => {
								if (child.exitCode !== null || child.signalCode !== null) {
									done(child.exitCode ?? 0);
									return;
								}
								child.once("exit", (code) => done(code));
								child.kill("SIGTERM");
							}),
					});
				}
			}
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			rejectPromise(error);
		});
	});
}

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

/**
 * 不注入任何库地执行一份自包含产物 HTML。
 *
 * `document.body.innerHTML = html` **不会执行**插入的 <script>，所以必须把内联脚本
 * 逐段取出自己 eval（顺序：内联的 Chart.js UMD → defaults + new Chart）。
 * happy-dom 没有 2D 上下文，但 Chart.js v4 仍会注册实例，因此
 * 「每个图表一个实例且 datasets 非空」就是可用的回归信号。
 */
function renderStandalone(standalone) {
	const win = new Window();
	win.document.body.innerHTML = standalone.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? "";
	const scripts = standalone.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g) ?? [];
	let error = null;
	for (const tag of scripts) {
		const code = tag.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
		try {
			win.eval(code);
		} catch (caught) {
			error = caught;
			break;
		}
	}
	const instances = Object.values(win.Chart?.instances ?? {});
	return {
		scriptCount: scripts.length,
		instances: instances.length,
		instancesWithData: instances.filter((instance) => (instance.config?.data?.datasets?.length ?? 0) > 0).length,
		error,
	};
}

/** 受控容器：DatasetFilterPanel 本身不持有筛选状态，由父组件持有。 */
function FilterHost({ datasets, onChange }) {
	const [filters, setFilters] = useState([]);
	return createElement(DatasetFilterPanel, {
		datasets,
		filters,
		onChange: (next) => {
			setFilters(next);
			onChange(next);
		},
	});
}

function clickChoice(container, text) {
	const labels = [...container.querySelectorAll(".viz-check")];
	const target = labels.find((label) => label.textContent.trim() === text);
	assert.ok(target, `筛选面板里没有取值「${text}」`);
	fireEvent.click(target.querySelector("input"));
}

describe("BI 数据资产 · 真实 PostgreSQL（门控）", { skip: LIVE ? false : "本机连不上 PostgreSQL（psql -d postgres 失败），跳过真实连接集成用例" }, () => {
	let engine = null;
	let dataDir = "";
	const engineCalls = [];
	const notifyCalls = [];
	const savedVizs = [];
	const captured = {};
	let baseRows = [];

	function queryCount() {
		return engineCalls.filter((call) => call.path === "/query").length;
	}

	/**
	 * 把服务层的 services.request 代理到真实引擎。
	 * 返回值形状必须与 EngineServiceResponse 一致：envelope 在 body 上。
	 */
	async function request(serviceId, req) {
		const method = req.method ?? (req.body === undefined ? "GET" : "POST");
		engineCalls.push({ path: req.path, method });
		const response = await fetch(`${engine.baseUrl}${req.path}`, {
			method,
			headers: {
				...(req.body === undefined ? {} : { "content-type": "application/json" }),
				authorization: `Bearer ${TOKEN}`,
			},
			body: req.body === undefined ? undefined : JSON.stringify(req.body),
		});
		let body = null;
		try {
			body = await response.json();
		} catch {
			body = null;
		}
		return { ok: response.ok, status: response.status, statusText: response.statusText, headers: {}, body };
	}

	before(async () => {
		psql(`drop schema if exists ${SCHEMA} cascade`);
		psql(`create schema ${SCHEMA}`);
		psql(`create table ${TABLE} (region text primary key, amount integer not null, created_at date not null)`);
		psql(
			`insert into ${TABLE} (region, amount, created_at) values ` +
				`('华东', 100, date '2026-01-01'), ('华南', 200, date '2026-01-02'), ` +
				`('华北', 300, date '2026-01-03'), ('西南', 400, date '2026-01-04')`,
		);

		dataDir = mkdtempSync(join(tmpdir(), "dbx-bi-live-"));
		engine = await startEngine({ args: ["--data", dataDir] });
		bindEngineServices({ request });
		setRuntime({ storage: createMemoryStorage(), ui: { notify: (payload) => notifyCalls.push(payload) }, services: { request } });
		setSaveCallback((viz) => savedVizs.push(viz));

		const added = await engineAddConnection(PG_CONNECTION, { timeoutMs: 30_000 });
		assert.ok(added.id, `注册 PostgreSQL 连接失败：${JSON.stringify(added)}`);

		const outcome = await executeServerPage(PG_CONNECTION.name, ORDER_SQL, {
			baseOffset: 0,
			pageSize: DATASET_ROW_LIMIT,
			timeoutMs: 30_000,
		});
		baseRows = outcome.rows;
		assert.deepEqual(
			baseRows.map((row) => String(row.region)).sort(),
			["华东", "华北", "华南", "西南"].sort(),
			"真实 PostgreSQL 没有返回预期的 4 行",
		);
	});

	after(async () => {
		bindEngineServices(null);
		setRuntime(null);
		try {
			if (engine) await engine.stop();
		} catch {
			/* 收尾失败不应掩盖测试结果 */
		}
		try {
			if (dataDir) rmSync(dataDir, { recursive: true, force: true });
		} catch {
			/* 同上 */
		}
		try {
			psql(`drop schema if exists ${SCHEMA} cascade`);
		} catch {
			/* 同上 */
		}
	});

	it("① 真库生成 dashboard / screen 产物，离线单文件不注入库也能渲染", async () => {
		const tool = createDbxChartCollectionTool();
		// 绑定数据源的图仍然要带一份快照 data：charts[].data 是既有契约，
		// source 只是让它在筛选 / 重新取数时能被重算（ADR-0009 §6）。
		const snapshot = {
			labels: baseRows.map((row) => String(row.region)),
			datasets: [{ label: "amount", data: baseRows.map((row) => Number(row.amount)) }],
		};

		for (const theme of ["dashboard", "screen"]) {
			savedVizs.length = 0;
			const result = await tool.handler({
				trigger: {
					input: {
						type: theme,
						title: `真实取数 ${theme}`,
						charts: [
							{
								type: "bar",
								title: "各区域金额",
								source: { datasetId: "ds-orders", labelColumn: "region", valueColumns: ["amount"] },
								data: snapshot,
							},
						],
						datasets: [
							{
								id: "ds-orders",
								title: "订单按区域",
								connection: PG_CONNECTION.name,
								table: TABLE,
								sql: ORDER_SQL,
								columns: ["region", "amount"],
								rows: baseRows,
								rowCount: baseRows.length,
							},
						],
					},
				},
			});

			assert.equal(result.ok, true, `产物生成失败：${result.error}`);
			assert.equal(result.chartCount, 1);
			assert.equal(result.datasetCount, 1);
			assert.match(result.message, /可在「BI 数据资产」里筛选与重新取数/);
			assert.equal(savedVizs.length, 1, "工具没有把产物交给 UI（saveVisualizationToStore 未触发）");

			const viz = savedVizs[0];
			captured[theme] = viz;
			assert.equal(viz.html, undefined, "带 datasets 的产物不应落库 html（M1 起 html 是导出时的派生产物）");
			assert.equal(viz.datasets.length, 1);
			assert.equal(viz.datasets[0].rows.length, 4);

			// 真实数据 → 图表数据源（详情抽屉导出时走的同一条路径）
			const items = resolveChartItems(viz.chartItems, viz.datasets);
			assert.equal(items.length, 1);
			assert.deepEqual(
				[...items[0].data.labels].sort(),
				baseRows.map((row) => String(row.region)).sort(),
			);
			assert.deepEqual(
				[...items[0].data.datasets[0].data].sort((a, b) => a - b),
				[100, 200, 300, 400],
				"图表数据源不是真实库里的金额",
			);

			// 导出：自包含单文件，不引用任何外部脚本
			const standalone = withEmbeddedChartJs(resolveVisualizationHtml(viz, items));
			assert.ok(!standalone.includes("cdn.jsdelivr.net"), "离线产物不应再引用 Chart.js CDN");
			assert.ok(!/<script[^>]*\ssrc=/.test(standalone), "离线产物不应引用任何外部脚本");

			const rendered = renderStandalone(standalone);
			assert.equal(rendered.error, null, `离线产物执行报错：${rendered.error && rendered.error.message}`);
			assert.equal(rendered.instances, 1, "离线产物里没有创建出 Chart 实例");
			assert.equal(rendered.instancesWithData, 1, "离线产物里的 Chart 实例没有拿到数据");
		}
	});

	it("② 筛选只重算前端，不发起新的引擎查询", async () => {
		const viz = captured.dashboard;
		assert.ok(viz, "① 没有产出 dashboard 产物");

		const unfiltered = resolveChartItems(viz.chartItems, viz.datasets);
		const filtered = resolveChartItems(viz.chartItems, viz.datasets, [
			{ datasetId: "ds-orders", column: "region", values: ["华东"] },
		]);
		assert.equal(unfiltered[0].data.labels.length, 4);
		assert.deepEqual(filtered[0].data.labels, ["华东"]);
		assert.deepEqual(filtered[0].data.datasets[0].data, [100]);
		// 筛选是纯函数重算，数据集本身不该被改写
		assert.equal(viz.datasets[0].rows.length, 4);

		// 真实筛选面板：点一下勾选，改的是前端筛选，不是 SQL
		const before = queryCount();
		const emitted = [];
		const { container } = render(
			createElement(FilterHost, { datasets: viz.datasets, onChange: (next) => emitted.push(next) }),
		);
		clickChoice(container, "华东");

		assert.equal(emitted.length, 1, "筛选面板没有把新筛选交给父组件");
		assert.equal(emitted[0].length, 1);
		assert.equal(emitted[0][0].datasetId, "ds-orders");
		assert.equal(emitted[0][0].column, "region");
		assert.deepEqual(emitted[0][0].values, ["华东"]);
		assert.equal(queryCount(), before, "改筛选不应发起新的引擎查询（ADR-0009 §6 第 2 条）");
		cleanup();
	});

	it("③ 重新取数反映新数据；SQL 失败时引擎错误原样可见", async () => {
		const viz = captured.dashboard;
		assert.ok(viz, "① 没有产出 dashboard 产物");

		psql(`insert into ${TABLE} (region, amount, created_at) values ('西北', 500, date '2026-02-01')`);

		let refetched = null;
		const ok = renderHook(() => useDatasetRefetch(viz, (datasets) => {
			refetched = datasets;
		}));
		await act(async () => {
			await ok.result.current.refetch();
		});
		await waitFor(() => assert.equal(ok.result.current.status, "ok"));
		assert.match(ok.result.current.message, /已载入 5 行/);
		assert.ok(refetched, "onRefetched 没有被调用，新数据集没有交给 UI");
		assert.equal(refetched[0].rows.length, 5);
		assert.equal(refetched[0].rowCount, 5);
		const regions = refetched[0].rows.map((row) => String(row.region));
		assert.ok(regions.includes("西北"), `重新取数没有看到新插入的行：${regions.join("、")}`);
		cleanup();

		// SQL 失败：错误文本原样透出 —— 改写过的文案会掩盖真正原因
		const broken = { ...viz, datasets: [{ ...viz.datasets[0], sql: `select nope from ${TABLE}` }] };
		const bad = renderHook(() => useDatasetRefetch(broken, () => {}));
		await act(async () => {
			await bad.result.current.refetch();
		});
		await waitFor(() => assert.equal(bad.result.current.status, "error"));
		assert.match(bad.result.current.message, /column "nope" does not exist/);
		cleanup();
	});
});
