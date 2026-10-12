/**
 * driver-manager-page — 「点了安装像闪退」这条缺陷的界面侧回归。
 *
 * 旧界面的问题不是按钮坏了，而是失败看不出来：安装请求异步返回一句 note，界面 refresh 一次
 * 发现还是「未安装」，按钮就弹回原样；服务端写下的失败原因（HTTP 404）没有任何地方会显示。
 * 所以这里锁的是「界面必须把进度和失败原因如实呈现」：
 *   - 安装中显示进度区（含阶段文案与已下载量）
 *   - 失败时在卡片上显示上次失败原因
 *   - 已安装时显示真实路径、体积与环境变量
 *
 * 用 bindEngineServices 换掉引擎请求层，不起真实引擎。
 * 不用 JSX：node 原生不转换 JSX，统一用 createElement（与 settings-panel.test.js 一致）。
 *
 * 运行：npm test（脚本已带 --import ./src/test/support/dom-setup.mjs）。
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createElement } from "react";

import RTL from "@testing-library/react";

import { bindEngineServices } from "../shared/services/engine-client.ts";
import { DriverManagerPage } from "../features/database-workspace/components/driver-manager-page.tsx";

const { act, cleanup, fireEvent, render, screen, waitFor } = RTL;

afterEach(() => cleanup());

const INSTALLED_PATH = "/Users/me/.astravia-dbx-data/drivers/duckdb/darwin-x64/duckdb_worker";

function okEnvelope(data) {
	return { ok: true, status: 200, statusText: "OK", headers: {}, body: { ok: true, data } };
}

function driver(overrides = {}) {
	return {
		key: "duckdb",
		label: "DuckDB Native Driver（API 数据源本机查询通道）",
		description: "dbx API 数据源的本地 SQL 执行引擎。",
		envVar: "DBX_DUCKDB_DRIVER_PATH",
		installed: false,
		reason: "未检测到驱动可执行文件，点击「安装」从 dbx agents release 下载。",
		expectedPath: INSTALLED_PATH,
		platform: "darwin-x64",
		installStatus: { status: "idle", downloaded: 0, total: 0 },
		...overrides,
	};
}

function stubEngine({ frames = [driver()], installResult } = {}) {
	const calls = [];
	const queue = [...frames];
	return {
		calls,
		request: async (_serviceId, request) => {
			calls.push({ path: request.path, body: request.body });
			if (request.path === "/driver/status") {
				const frame = queue.length > 1 ? queue.shift() : queue[0];
				return okEnvelope({ drivers: [frame] });
			}
			if (request.path === "/driver/install") {
				return okEnvelope(installResult ?? { ok: true, driverKey: "duckdb", note: "下载已开始，轮询 /driver/status 查看进度" });
			}
			if (request.path === "/driver/set-path") {
				return okEnvelope({ ok: true, driverKey: "duckdb", path: INSTALLED_PATH, installedPath: INSTALLED_PATH, bridgeRestarted: true });
			}
			throw new Error(`桩引擎没有这个路由：${request.path}`);
		},
	};
}

async function openPage(engine = stubEngine(), props = {}) {
	bindEngineServices({ request: engine.request });
	const utils = render(createElement(DriverManagerPage, props));
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
	return utils;
}

describe("驱动管理页 · 未安装", () => {
	it("列出驱动并如实说明「未安装」以及为什么", async () => {
		await openPage();

		assert.ok(screen.getByText("驱动管理"));
		assert.ok(screen.getByText("DuckDB Native Driver（API 数据源本机查询通道）"));
		assert.ok(screen.getByText("未安装"));
		assert.ok(screen.getByText(/未检测到驱动可执行文件/));
		// 期望路径必须给出来，用户才能自己核对 / 手动放置
		assert.ok(screen.getByText(`期望路径：${INSTALLED_PATH}`));
		assert.ok(screen.getByRole("button", { name: /安装/ }));
	});

	it("没有驱动时报「没有需要管理的驱动」，而不是空白页", async () => {
		const engine = stubEngine({ frames: [] });
		engine.request = async (_serviceId, request) => {
			if (request.path === "/driver/status") return okEnvelope({ drivers: [] });
			throw new Error("unexpected");
		};
		await openPage(engine);
		assert.ok(screen.getByText("没有需要管理的驱动"));
	});

	it("引擎不可用时报错，而不是停在「检测驱动中」", async () => {
		bindEngineServices({
			request: async () => {
				throw new Error("Service is not ready");
			},
		});
		render(createElement(DriverManagerPage, {}));
		await waitFor(() => {
			assert.ok(screen.getByText(/引擎服务正在启动中/));
		});
		assert.equal(screen.queryByText("检测驱动中…"), null);
	});
});

describe("驱动管理页 · 失败可见", () => {
	it("服务端留下失败原因时，卡片上直接显示（这是「闪退」的真相）", async () => {
		await openPage(
			stubEngine({
				frames: [
					driver({
						installStatus: { status: "error", downloaded: 0, total: 0, error: "HTTP 404 Not Found" },
					}),
				],
			}),
		);

		assert.ok(screen.getByText(/上次安装失败：HTTP 404 Not Found/));
		// 失败态不显示进度区（避免看起来还在装）
		assert.equal(screen.queryByTestId("driver-install-progress"), null);
		assert.ok(screen.getByRole("button", { name: /安装/ }));
	});
});

describe("驱动管理页 · 安装进度", () => {
	it("轮询到下载中时显示进度区、阶段文案与字节数", async () => {
		await openPage(
			stubEngine({
				frames: [
					driver({
						installStatus: { status: "downloading", downloaded: 1_024, total: 7_653_574, percent: 50 },
					}),
				],
			}),
		);

		const progress = screen.getByTestId("driver-install-progress");
		assert.ok(progress);
		assert.ok(screen.getByText(/下载中 50%/));
		assert.ok(screen.getByText(/1\.0 KB \/ 7\.7 MB/));
		assert.equal(screen.queryByText("未安装")?.textContent, "未安装");
	});

	it("点「安装」后立刻进入安装中（不再是一次性刷新就弹回）", async () => {
		const statuses = [
			driver(),
			driver({ installStatus: { status: "resolving", downloaded: 0, total: 0 } }),
			driver({
				installed: true,
				installedPath: INSTALLED_PATH,
				sizeBytes: 30_227_136,
				installStatus: { status: "done", downloaded: 30_227_136, total: 30_227_136, percent: 100, bridgeRestarted: true },
			}),
		];
		const engine = stubEngine({ frames: statuses });
		await openPage(engine);

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /安装/ }));
		});

		// 请求一发出去就要显示「安装中」，而不是弹回「安装」
		assert.ok(engine.calls.some((call) => call.path === "/driver/install"));
		assert.equal(engine.calls.find((call) => call.path === "/driver/install").body.driverKey, "duckdb");
		assert.ok(screen.getByTestId("driver-install-progress"));

		// 页面默认 700ms 轮询一次，等它自己走到终态
		await waitFor(
			() => {
				assert.ok(screen.getByText("已安装"));
			},
			{ timeout: 5_000 },
		);
		assert.equal(screen.queryByTestId("driver-install-progress"), null);
	});
});

describe("驱动管理页 · 已安装", () => {
	it("显示真实路径、体积与环境变量", async () => {
		await openPage(
			stubEngine({
				frames: [
					driver({
						installed: true,
						installedPath: INSTALLED_PATH,
						sizeBytes: 30_227_136,
						installStatus: { status: "done", downloaded: 30_227_136, total: 30_227_136, percent: 100, bridgeRestarted: true },
					}),
				],
			}),
		);

		assert.ok(screen.getByText("已安装"));
		assert.ok(screen.getByText(/30\.2 MB/));
		assert.ok(screen.getByText(`环境变量：DBX_DUCKDB_DRIVER_PATH`));
		// 已安装不再提供「指定路径」
		assert.equal(screen.queryByRole("button", { name: /指定路径/ }), null);
	});

	it("装好了但 dbx-mcp 没重启时明说要重启宿主才生效", async () => {
		await openPage(
			stubEngine({
				frames: [
					driver({
						installed: true,
						installedPath: INSTALLED_PATH,
						sizeBytes: 30_227_136,
						installStatus: { status: "done", downloaded: 30_227_136, total: 30_227_136, percent: 100, bridgeRestarted: false },
					}),
				],
			}),
		);

		assert.ok(screen.getByText(/重启宿主后生效/));
	});
});

describe("驱动管理页 · 手动指定路径", () => {
	it("展开后未填路径时「应用」不可用，填了才调用 set-path", async () => {
		const engine = stubEngine();
		await openPage(engine);

		fireEvent.click(screen.getByRole("button", { name: /指定路径/ }));
		const apply = screen.getByRole("button", { name: "应用" });
		assert.equal(apply.disabled, true);

		const input = screen.getByPlaceholderText(/输入驱动可执行文件的完整路径/);
		fireEvent.change(input, { target: { value: "/Users/me/duckdb_worker" } });
		assert.equal(screen.getByRole("button", { name: "应用" }).disabled, false);

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "应用" }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		const setPath = engine.calls.find((call) => call.path === "/driver/set-path");
		assert.ok(setPath);
		assert.deepEqual(setPath.body, { driverKey: "duckdb", path: "/Users/me/duckdb_worker" });
	});
});

describe("驱动管理页 · 底部说明", () => {
	it("说明驱动存放位置与可替代的环境变量", async () => {
		await openPage();
		assert.ok(screen.getByText(/驱动按平台存放在引擎数据目录的 drivers\/ 下/));
		assert.ok(screen.getByText(/也可手动设置 DBX_DUCKDB_DRIVER_PATH 环境变量/));
	});
});
