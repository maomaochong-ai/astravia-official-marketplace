// @vitest-environment jsdom

/**
 * 「本次需要的工具」里安装按钮的可见性。
 *
 * 这里守的是用户实际反馈的两条行为：
 *   1. 已经就绪的行不该再出现「安装」按钮（装了还提示装，是噪声）；
 *   2. 一键安装只出现在真的跑得起来的配方上 —— 需要管理员密码、或包管理器里根本没有
 *      的工具（java / jeb / ghidra / pwndbg）只给复制，绝不给一个点了必然失败的按钮。
 *
 * 宿主提供的命令通道用假实现替代：这里只验证「给不给按钮」，不验证真的去装东西。
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

import { ReaToolReadiness } from "../src/features/rea-workflow/components/rea-tool-readiness";
import type { DoctorCheck } from "../src/features/rea-workflow/live/doctor-readiness";
import type { DoctorReport } from "../src/features/rea-workflow/hooks/use-doctor-report";

const INSTALL_LABEL = "tab.tools.install";
const COPY_LABEL = "tab.tools.copy";

// doctor 说 node / host / jadx 都在；其余运行时依赖没有探测通道，因此停在「未确认」。
const CHECKS: readonly DoctorCheck[] = [
	{ name: "node", ok: true },
	{ name: "host", ok: true },
	{ name: "jadx", ok: true },
];

const report: DoctorReport = {
	checks: CHECKS,
	summary: null,
	status: "ready",
	message: null,
	lastRunAt: 1,
	recheck: () => {},
};

function renderPanel(options: { readonly withSpawnCommand: boolean }) {
	return render(
		<ReaToolReadiness
			target="mobile"
			calls={[]}
			running={[]}
			report={report}
			run={vi.fn() as never}
			runCommand={null}
			spawnRea={null}
			spawnCommand={options.withSpawnCommand ? (vi.fn() as never) : null}
			cwd={null}
		/>,
	);
}

/** 按工具展示名找到它所在的行；同名只应出现一次。 */
function rowOf(label: string): HTMLElement {
	const labelNode = screen.getAllByText(label)[0];
	const row = labelNode?.closest("li");
	if (!row) throw new Error(`没有找到 ${label} 所在的行`);
	return row as HTMLElement;
}

function buttonsOf(row: HTMLElement): readonly HTMLElement[] {
	return Array.from(row.querySelectorAll("button"));
}

function hasButton(row: HTMLElement, label: string): boolean {
	return buttonsOf(row).some((button) => (button.textContent ?? "").includes(label));
}

afterEach(cleanup);

describe("就绪行不再显示安装按钮", () => {
	// 已就绪组默认收起，展开后才看得到这些行。
	it("doctor 确认就绪的 jadx 没有安装按钮", () => {
		renderPanel({ withSpawnCommand: true });
		fireEvent.click(screen.getByTitle("tab.tools.expandAll"));
		renderPanel({ withSpawnCommand: true });
		const row = rowOf("jadx");
		expect(within(row).getByText("tab.tools.state.ready")).toBeTruthy();
		expect(hasButton(row, INSTALL_LABEL)).toBe(false);
	});
});

describe("可执行配方才给一键安装", () => {
	it("未确认但配方可跑的 frida 有安装按钮，同时保留复制入口", () => {
		renderPanel({ withSpawnCommand: true });
		const row = rowOf("Frida");
		expect(within(row).getByText("tab.tools.state.unknown")).toBeTruthy();
		expect(hasButton(row, INSTALL_LABEL)).toBe(true);
		expect(hasButton(row, COPY_LABEL)).toBe(true);
	});

	it("需要管理员密码的 java 不给安装按钮，只给复制与原因", () => {
		renderPanel({ withSpawnCommand: true });
		const row = rowOf("Java");
		expect(hasButton(row, INSTALL_LABEL)).toBe(false);
		expect(hasButton(row, COPY_LABEL)).toBe(true);
		expect(within(row).getByText("tab.tools.note.javaAdmin")).toBeTruthy();
	});

	it("没有命令通道时连可跑的配方也不给按钮", () => {
		renderPanel({ withSpawnCommand: false });
		const row = rowOf("Frida");
		expect(hasButton(row, INSTALL_LABEL)).toBe(false);
		expect(hasButton(row, COPY_LABEL)).toBe(true);
	});
});

describe("展开后的完整清单", () => {
	it("jeb 只能复制，apktool 可以一键装", () => {
		renderPanel({ withSpawnCommand: true });
		fireEvent.click(screen.getByTitle("tab.tools.expandAll"));

		const jeb = rowOf("JEB");
		expect(hasButton(jeb, INSTALL_LABEL)).toBe(false);
		expect(hasButton(jeb, COPY_LABEL)).toBe(true);

		const apktool = rowOf("apktool");
		expect(hasButton(apktool, INSTALL_LABEL)).toBe(true);
	});
});
