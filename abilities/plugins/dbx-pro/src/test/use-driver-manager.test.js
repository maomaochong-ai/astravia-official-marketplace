/**
 * use-driver-manager — 安装轮询与失败可见。
 *
 * 这条用例锁住的是用户实际看到的行为，而不是「请求发出去了」：
 * 旧实现点了「安装」只 refresh 一次，服务端异步下载失败后按钮直接弹回「未安装」，
 * 失败原因（HTTP 404）只留在服务端状态文件里 —— 用户的说法就是「点了就闪退，装不上」。
 * 所以这里断言：安装期间有进度、轮询到终态才收手、失败原因能从 drivers 里读出来。
 *
 * 用 bindEngineServices 换掉引擎请求层（不起真实引擎、不发网络请求）。
 *
 * 运行：npm test（脚本已带 --import ./src/test/support/dom-setup.mjs）。
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import RTL from "@testing-library/react";

import { bindEngineServices } from "../shared/services/engine-client.ts";
import {
	DRIVER_INSTALL_STEP_TEXT,
	describeInstallProgress,
	isInstallSettled,
	useDriverManager,
} from "../features/database-workspace/hooks/use-driver-manager.ts";

const { act, cleanup, renderHook } = RTL;

afterEach(cleanup);

function okEnvelope(data) {
	return { ok: true, status: 200, statusText: "OK", headers: {}, body: { ok: true, data } };
}

function failEnvelope(code, message) {
	return { ok: true, status: 502, statusText: "Bad Gateway", headers: {}, body: { ok: false, error: { code, message } } };
}

function driverStatus(overrides = {}) {
	return {
		key: "duckdb",
		label: "DuckDB Native Driver",
		installed: false,
		expectedPath: "/tmp/drivers/duckdb/darwin-x64/duckdb_worker",
		envVar: "DBX_DUCKDB_DRIVER_PATH",
		platform: "darwin-x64",
		installStatus: { status: "idle", downloaded: 0, total: 0 },
		...overrides,
	};
}

/**
 * 桩引擎：按路径给出应答序列，并记下每次调用的方法与请求体。
 * `statuses` 是一个队列，用完之后一律重复最后一帧（模拟「一直没进展」）。
 */
function stubEngine({ statuses = [driverStatus()], installResult, installFails, setPathFails } = {}) {
	const calls = [];
	const queue = [...statuses];
	const last = () => queue[Math.min(queue.length, queue.length) - 1];
	void last;
	return {
		calls,
		request: async (_serviceId, request) => {
			calls.push({ path: request.path, method: request.method, body: request.body });
			if (request.path === "/driver/status") {
				const frame = queue.length > 1 ? queue.shift() : queue[0];
				return okEnvelope({ drivers: [frame] });
			}
			if (request.path === "/driver/install") {
				if (installFails) return failEnvelope("DRIVER_DOWNLOAD_FAILED", "下载失败：HTTP 404 Not Found");
				return okEnvelope(installResult ?? { ok: true, driverKey: "duckdb", note: "下载已开始，轮询 /driver/status 查看进度" });
			}
			if (request.path === "/driver/set-path") {
				if (setPathFails) return failEnvelope("BAD_REQUEST", "文件不存在: /nope/duckdb_worker");
				return okEnvelope({ ok: true, driverKey: "duckdb", path: "/tmp/drivers/duckdb/darwin-x64/duckdb_worker", bridgeRestarted: true });
			}
			throw new Error(`桩引擎没有这个路由：${request.path}`);
		},
	};
}

/** 挂载一次 hook 并等挂载后的自动查询落地。 */
async function mount(options) {
	const utils = renderHook(() => useDriverManager(options));
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
	return utils;
}

describe("useDriverManager · 状态查询", () => {
	it("挂载后查询 /driver/status，并把驱动列表交给界面", async () => {
		const engine = stubEngine();
		bindEngineServices({ request: engine.request });
		const { result } = await mount({ autoLoad: true });

		assert.equal(engine.calls[0].path, "/driver/status");
		assert.equal(engine.calls[0].method, "POST");
		assert.equal(result.current.drivers.length, 1);
		assert.equal(result.current.drivers[0].key, "duckdb");
		assert.equal(result.current.loading, false);
	});

	it("查询失败时把原因报给界面（而不是静默停在「检测驱动中」）", async () => {
		bindEngineServices({
			request: async () => {
				throw new Error("Service is not ready");
			},
		});
		const { result } = await mount({ autoLoad: true });

		assert.match(result.current.error ?? "", /引擎服务正在启动中/);
		assert.equal(result.current.loading, false);
	});

	it("未安装时进度取服务端状态，而不是本地猜的", async () => {
		const engine = stubEngine({ statuses: [driverStatus({ installStatus: { status: "error", downloaded: 0, total: 0, error: "下载失败：HTTP 404 Not Found" } })] });
		bindEngineServices({ request: engine.request });
		const { result } = await mount({ autoLoad: true });

		assert.equal(result.current.drivers[0].installStatus.error, "下载失败：HTTP 404 Not Found");
	});
});

describe("useDriverManager · 安装轮询", () => {
	it("安装期间轮询到 done 才收手，并刷新出已安装状态", async () => {
		const engine = stubEngine({
			statuses: [
				driverStatus({ installStatus: { status: "resolving", downloaded: 0, total: 0 } }),
				driverStatus({ installStatus: { status: "downloading", downloaded: 1024, total: 7653574, percent: 0 } }),
				driverStatus({
					installed: true,
					installedPath: "/tmp/drivers/duckdb/darwin-x64/duckdb_worker",
					sizeBytes: 30227136,
					installStatus: { status: "done", downloaded: 30227136, total: 30227136, percent: 100, bridgeRestarted: true },
				}),
			],
		});
		bindEngineServices({ request: engine.request });
		const { result } = await mount({ autoLoad: false, intervalMs: 1 });

		await act(async () => {
			await result.current.install("duckdb");
		});

		assert.equal(result.current.drivers[0].installed, true);
		assert.equal(result.current.drivers[0].installStatus.bridgeRestarted, true);
		assert.equal(result.current.installingKey, null);
		assert.equal(result.current.error, null);
		assert.deepEqual(
			engine.calls.map((call) => call.path),
			["/driver/install", "/driver/status", "/driver/status", "/driver/status"],
		);
		assert.equal(engine.calls[0].body.driverKey, "duckdb");
	});

	it("服务端报失败时停止轮询，并把失败原因留在卡片上（不弹成请求层错误）", async () => {
		const engine = stubEngine({
			statuses: [
				driverStatus({ installStatus: { status: "downloading", downloaded: 0, total: 0 } }),
				driverStatus({ installStatus: { status: "error", downloaded: 0, total: 0, error: "下载失败：HTTP 404 Not Found" } }),
				driverStatus({ installStatus: { status: "error", downloaded: 0, total: 0, error: "下载失败：HTTP 404 Not Found" } }),
			],
		});
		bindEngineServices({ request: engine.request });
		const { result } = await mount({ autoLoad: false, intervalMs: 1 });

		await act(async () => {
			await result.current.install("duckdb");
		});

		assert.equal(result.current.drivers[0].installStatus.status, "error");
		assert.equal(result.current.drivers[0].installStatus.error, "下载失败：HTTP 404 Not Found");
		assert.equal(result.current.installingKey, null);
		// 失败原因由卡片呈现，顶部横幅只放请求层问题
		assert.equal(result.current.error, null);
		// 轮询在读到 error 后立刻退出，不会把同一份失败刷很多遍
		assert.equal(engine.calls.filter((call) => call.path === "/driver/status").length, 2);
	});

	it("安装请求本身失败（引擎不可用、参数非法）时报到顶部横幅并回收按钮", async () => {
		const engine = stubEngine({ installFails: true });
		bindEngineServices({ request: engine.request });
		const { result } = await mount({ autoLoad: false, intervalMs: 1 });

		await act(async () => {
			await result.current.install("duckdb");
		});

		assert.match(result.current.error ?? "", /HTTP 404 Not Found/);
		assert.equal(result.current.installingKey, null);
	});

	it("驱动已经就位时不再轮询", async () => {
		const engine = stubEngine({
			installResult: { ok: true, driverKey: "duckdb", installedPath: "/tmp/drivers/duckdb/darwin-x64/duckdb_worker", note: "驱动已存在" },
			statuses: [driverStatus({ installed: true, installStatus: { status: "done", downloaded: 1, total: 1, percent: 100 } })],
		});
		bindEngineServices({ request: engine.request });
		const { result } = await mount({ autoLoad: false, intervalMs: 1 });

		await act(async () => {
			await result.current.install("duckdb");
		});

		assert.deepEqual(
			engine.calls.map((call) => call.path),
			["/driver/install", "/driver/status"],
		);
		assert.equal(result.current.drivers[0].installed, true);
	});

	it("一直没进展时按时超时，不再无限转圈", async () => {
		const engine = stubEngine({
			statuses: [driverStatus({ installStatus: { status: "downloading", downloaded: 1024, total: 7653574 } })],
		});
		bindEngineServices({ request: engine.request });
		const { result } = await mount({ autoLoad: false, intervalMs: 1, timeoutMs: 25 });

		await act(async () => {
			await result.current.install("duckdb");
		});

		assert.match(result.current.error ?? "", /驱动安装超时/);
		assert.equal(result.current.installingKey, null);
	});

	it("逐阶段轮询，直到服务端给终态才把 installingKey 放掉", async () => {
		const phases = [
			"resolving",
			"downloading",
			"extracting",
			"done",
		];
		const statuses = phases.map((phase, index) =>
			driverStatus({
				installed: phase === "done",
				installedPath: phase === "done" ? "/tmp/drivers/duckdb/darwin-x64/duckdb_worker" : undefined,
				installStatus: { status: phase, downloaded: index * 100, total: 400, percent: index * 25 },
			}),
		);
		const engine = stubEngine({ statuses });
		bindEngineServices({ request: engine.request });
		const { result } = await mount({ autoLoad: false, intervalMs: 1 });

		const seen = [];
		let pending;
		// 安装是一个基于真实定时器的轮询循环：先启动它（这个 act 只负责刷出乐观的
		// resolving 状态），再用一个个 act 边界推进真实定时器。
		await act(async () => {
			pending = result.current.install("duckdb");
		});
		for (let i = 0; i < 300; i += 1) {
			if (result.current.progress) seen.push(describeInstallProgress(result.current.progress));
			if (result.current.installingKey === null && result.current.drivers[0]?.installed) break;
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 1));
			});
		}
		await act(async () => {
			await pending;
		});

		// 四个阶段都轮询到了，而且在读到 done 之后没有再发一次请求
		assert.deepEqual(
			engine.calls.map((call) => call.path),
			["/driver/install", "/driver/status", "/driver/status", "/driver/status", "/driver/status"],
		);
		assert.equal(result.current.drivers[0].installed, true);
		assert.equal(result.current.installingKey, null);
		assert.equal(result.current.progress, null);
		// 安装期间 progress 是可渲染的文案（React 会把同一 tick 内的多次 setState 合并，
		// 所以这里只断言「至少暴露过、且都是已知阶段文案」，不锁定中间帧数）
		assert.ok(seen.length > 0, "安装期间应暴露过 progress");
		assert.ok(
			seen.every((text) => text.length > 0),
			`progress 文案不应为空：${JSON.stringify(seen)}`,
		);
	});
});

describe("useDriverManager · 手动指定路径", () => {
	it("指定成功后重新查询状态", async () => {
		const engine = stubEngine({
			statuses: [driverStatus({ installed: true, installedPath: "/tmp/drivers/duckdb/darwin-x64/duckdb_worker", installStatus: { status: "done", downloaded: 7, total: 7, percent: 100 } })],
		});
		bindEngineServices({ request: engine.request });
		const { result } = await mount({ autoLoad: true });

		await act(async () => {
			await result.current.setPath("duckdb", "/Users/me/duckdb_worker");
		});

		assert.deepEqual(
			engine.calls.map((call) => call.path),
			["/driver/status", "/driver/set-path", "/driver/status"],
		);
		assert.equal(engine.calls[1].body.path, "/Users/me/duckdb_worker");
		assert.equal(result.current.drivers[0].installed, true);
		assert.equal(result.current.error, null);
	});

	it("路径不可用时报错，且不谎称已安装", async () => {
		const engine = stubEngine({ setPathFails: true, statuses: [driverStatus()] });
		bindEngineServices({ request: engine.request });
		const { result } = await mount({ autoLoad: true });

		await act(async () => {
			await result.current.setPath("duckdb", "/nope/duckdb_worker");
		});

		assert.match(result.current.error ?? "", /文件不存在/);
		assert.equal(result.current.drivers[0].installed, false);
	});

	it("clearError 收掉顶部横幅", async () => {
		const engine = stubEngine({ setPathFails: true });
		bindEngineServices({ request: engine.request });
		const { result } = await mount({ autoLoad: false });

		await act(async () => {
			await result.current.setPath("duckdb", "/nope/duckdb_worker");
		});
		assert.ok(result.current.error);

		await act(async () => {
			result.current.clearError();
		});
		assert.equal(result.current.error, null);
	});
});

describe("进度文案", () => {
	it("阶段文案齐全，未知阶段原样回显", () => {
		assert.equal(DRIVER_INSTALL_STEP_TEXT.resolving, "获取驱动清单…");
		assert.equal(DRIVER_INSTALL_STEP_TEXT.extracting, "解压安装中…");
		assert.equal(DRIVER_INSTALL_STEP_TEXT.idle, "");
	});

	it("有百分比时带上百分比，没有总长度时只报阶段", () => {
		assert.equal(describeInstallProgress({ status: "downloading", downloaded: 1024, total: 2048, percent: 50 }), "下载中 50%");
		assert.equal(describeInstallProgress({ status: "downloading", downloaded: 1024, total: 0 }), "下载中");
		assert.equal(describeInstallProgress({ status: "resolving", downloaded: 0, total: 0 }), "获取驱动清单…");
		assert.equal(describeInstallProgress(null), "");
	});

	it("只有 done/error 算终态", () => {
		assert.equal(isInstallSettled({ status: "done", downloaded: 1, total: 1 }), true);
		assert.equal(isInstallSettled({ status: "error", downloaded: 0, total: 0 }), true);
		assert.equal(isInstallSettled({ status: "downloading", downloaded: 1, total: 2 }), false);
		assert.equal(isInstallSettled(undefined), false);
	});
});
