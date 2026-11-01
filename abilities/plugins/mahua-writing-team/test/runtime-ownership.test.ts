import { afterEach, describe, expect, it, vi } from "vitest";
import { consoleLogStore } from "../src/application/console-log/console-log-store.js";
import type { StudioRuntime } from "../src/plugin-context.js";
import {
	clearStudioRuntime,
	getStudioRuntime,
	resetStudioRuntime,
	setStudioRuntime,
	tryGetStudioRuntime,
} from "../src/plugin-context.js";

/**
 * 重复激活的所有权规则。
 *
 * 宿主给同一个插件开多个能力会话（`capabilitySessionId` 不同），两个 `activate` 落在同一个
 * 模块实例上。后一次先装好运行时，前一次几十毫秒后才 dispose——卸载若无条件清空，就会把
 * 后来者刚装上的那份抹掉，界面从此读不到 ctx，静默停在启动骨架上。
 *
 * 这两个用例钉住的就是这条：卸载只能拆自己装的那一份。
 */

const fake = (name: string): StudioRuntime =>
	({
		ctx: { i18n: { t: (key: string) => `${name}:${key}` } },
		service: { name },
		gate: { name },
	}) as unknown as StudioRuntime;

afterEach(() => {
	resetStudioRuntime();
	consoleLogStore.setSink(() => {});
});

describe("studio runtime ownership", () => {
	it("keeps the newer runtime when the older activation disposes later", () => {
		const first = setStudioRuntime(fake("first"));
		const second = setStudioRuntime(fake("second"));

		clearStudioRuntime(first);

		expect(getStudioRuntime()).toBe(second);
	});

	it("clears only its own runtime", () => {
		const only = setStudioRuntime(fake("only"));

		clearStudioRuntime(only);

		expect(tryGetStudioRuntime()).toBeNull();
	});

	it("keeps the newest translator so a stalled panel can still speak", () => {
		const first = setStudioRuntime(fake("first"));
		const second = setStudioRuntime(fake("second"));

		clearStudioRuntime(first);

		expect(getStudioRuntime().ctx.i18n.t("window.starting")).toBe("second:window.starting");
	});
});

describe("console sink ownership", () => {
	const draft = {
		at: new Date(0).toISOString(),
		origin: "studio" as const,
		textKey: "console.test",
		status: "start" as const,
	};

	it("detaches only the sink it installed", () => {
		const older = vi.fn();
		const newer = vi.fn();

		consoleLogStore.setSink(older);
		consoleLogStore.setSink(newer);
		consoleLogStore.releaseSink(older);
		consoleLogStore.append(draft);

		expect(older).not.toHaveBeenCalled();
		expect(newer).toHaveBeenCalledTimes(1);
	});

	it("stops writing once its own sink is released", () => {
		const sink = vi.fn();

		consoleLogStore.setSink(sink);
		consoleLogStore.releaseSink(sink);
		consoleLogStore.append(draft);

		expect(sink).not.toHaveBeenCalled();
	});
});
