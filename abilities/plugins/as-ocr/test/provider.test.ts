import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PluginCliProviderPhase, PluginCliProviderStatus, PluginContext } from "@astravia-org/plugin-sdk";
import {
	isProviderBusy,
	OCR_INSTALL_PACKAGE,
	outputTail,
	phaseLabel,
	watchOcrProvider,
} from "../src/review/provider.ts";

/** provider.ts 纯函数 + 安装播报的回归测试（ocr 由宿主托管，播报文案不能误报）。 */

const status = (phase: PluginCliProviderPhase, recentOutput = ""): PluginCliProviderStatus => ({
	providerId: "ocr",
	phase,
	recentOutput,
});

interface Fake {
	ctx: PluginContext;
	notifications: Array<{ message: string; variant?: string }>;
	emit(status: PluginCliProviderStatus): void;
	listenerCount(): number;
}

/** 最小 fake ctx：只实现 watchOcrProvider 用到的 cliProviders.onStatusChanged 与 ui.notify。 */
function fakeContext(): Fake {
	const listeners = new Set<(next: PluginCliProviderStatus) => void>();
	const notifications: Array<{ message: string; variant?: string }> = [];
	const ctx = {
		cliProviders: {
			onStatusChanged(listener: (next: PluginCliProviderStatus) => void) {
				listeners.add(listener);
				return {
					dispose: () => {
						listeners.delete(listener);
					},
				};
			},
		},
		ui: {
			notify(options: { message: string; variant?: string }) {
				notifications.push(options);
			},
		},
	} as unknown as PluginContext;
	return {
		ctx,
		notifications,
		emit: (next) => {
			for (const listener of [...listeners]) listener(next);
		},
		listenerCount: () => listeners.size,
	};
}

describe("phaseLabel / isProviderBusy", () => {
	it("每个阶段都有中文文案（不出现 undefined）", () => {
		const phases: PluginCliProviderPhase[] = ["disabled", "checking", "installing", "verifying", "ready", "failed"];
		for (const phase of phases) {
			assert.equal(typeof phaseLabel(phase), "string");
			assert.ok(phaseLabel(phase).length > 0, `${phase} 缺文案`);
		}
	});

	it("安装中/校验中/探测中算忙，就绪与失败不算", () => {
		assert.equal(isProviderBusy("checking"), true);
		assert.equal(isProviderBusy("installing"), true);
		assert.equal(isProviderBusy("verifying"), true);
		assert.equal(isProviderBusy("ready"), false);
		assert.equal(isProviderBusy("failed"), false);
		assert.equal(isProviderBusy("disabled"), false);
	});
});

describe("outputTail（安装日志尾部）", () => {
	it("只保留末尾非空行", () => {
		const output = "line1\n\nline2\n   \nline3";
		assert.equal(outputTail(output, 2), "line2\nline3");
		assert.equal(outputTail(output), "line1\nline2\nline3");
	});

	it("超长时按字符数截断，保留尾部", () => {
		const tail = outputTail("x".repeat(100), 8, 10);
		assert.equal(tail.length, 10);
		assert.equal(tail, "x".repeat(10));
	});

	it("空输出返回空串（面板据此不渲染日志块）", () => {
		assert.equal(outputTail(""), "");
		assert.equal(outputTail("\n  \n"), "");
	});
});

describe("watchOcrProvider（安装进度播报）", () => {
	it("普通探测（checking → ready）不打扰用户", () => {
		const fake = fakeContext();
		watchOcrProvider(fake.ctx);
		fake.emit(status("checking", "ocr --version"));
		fake.emit(status("ready", "open-code-review v1.12.13 darwin/arm64"));
		assert.deepEqual(fake.notifications, []);
	});

	it("进入 installing 播报一次（含包名），就绪后再播报成功", () => {
		const fake = fakeContext();
		watchOcrProvider(fake.ctx);
		fake.emit(status("checking"));
		fake.emit(status("installing", "npm warn deprecated"));
		assert.equal(fake.notifications.length, 1);
		assert.equal(fake.notifications[0]?.variant, "info");
		assert.ok(fake.notifications[0]?.message.includes(OCR_INSTALL_PACKAGE));
		// 同一阶段重复广播（安装输出追加）不重复弹窗
		fake.emit(status("installing", "npm warn deprecated\nadded 1 package"));
		assert.equal(fake.notifications.length, 1);
		fake.emit(status("verifying"));
		fake.emit(status("ready"));
		assert.equal(fake.notifications.length, 2);
		assert.equal(fake.notifications[1]?.variant, "success");
	});

	it("安装失败播报错误并带上失败原因", () => {
		const fake = fakeContext();
		watchOcrProvider(fake.ctx);
		fake.emit(status("installing"));
		fake.emit({ ...status("failed", "npm ERR! network timeout"), message: "npm ERR! network timeout" });
		const last = fake.notifications.at(-1);
		assert.equal(last?.variant, "error");
		assert.ok(last?.message.includes("npm ERR! network timeout"));
	});

	it("忽略其它 provider 的状态，dispose 后不再播报", () => {
		const fake = fakeContext();
		const subscription = watchOcrProvider(fake.ctx);
		fake.emit({ ...status("installing"), providerId: "lark-cli" });
		assert.deepEqual(fake.notifications, []);
		subscription.dispose();
		assert.equal(fake.listenerCount(), 0);
	});
});
