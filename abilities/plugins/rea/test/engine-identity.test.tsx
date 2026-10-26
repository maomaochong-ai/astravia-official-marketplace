// @vitest-environment jsdom

/**
 * 「引擎详情」卡片的可见内容。
 *
 * 用户之前看到的报错是 `sh: doctor: command not found` 与「检查没有返回任何项目」——
 * 两句话都没说清「面板连的是哪个 rea、装了几份、Skill 有没有装」。这张卡就是为了
 * 把那三件事说出来，所以测试守的是：
 *   1. doctor 没给摘要时只显示空态，不编造版本号与路径；
 *   2. doctor 给了摘要时，版本 / 安装位置 / Skill / 目录计数 / 客户端注册都逐行落地；
 *   3. 装了多份时一定有可见告警（这是最容易让人误判「面板坏了」的情况）；
 *   4. 「让 Agent 自检」在自检进行中不可重复点。
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) =>
			params === undefined ? key : `${key}:${JSON.stringify(params)}`,
	}),
}));

import { ReaEngineIdentity } from "../src/features/rea-workflow/components/rea-engine-identity";
import type { DoctorSummary } from "../src/features/rea-workflow/live/doctor-summary";

afterEach(cleanup);

const SUMMARY: DoctorSummary = {
	healthy: true,
	environmentHealthy: true,
	scopeMode: "project",
	cliVersion: "6.8.0",
	skillState: "missing",
	skillVersion: null,
	installPaths: ["/opt/homebrew/bin/rea", "/usr/local/bin/rea"],
	installState: "multiple",
	catalog: { cliCommands: 175, mcpTools: 229, mcpPrompts: 6 },
	registrations: [
		{ client: "claude_code", state: "missing" },
		// 真实取值只有 aligned / stale / unknown / missing / invalid / manual（ClientRegistrationStatus.js）。
		{ client: "codex", state: "aligned" },
	],
};

describe("ReaEngineIdentity", () => {
	it("没有摘要时只给空态，不显示任何版本或路径", () => {
		render(<ReaEngineIdentity summary={null} onAskAgent={() => {}} askingAgent={false} />);

		expect(screen.getByText("ui.engine.identity.empty")).toBeTruthy();
		expect(screen.queryByText(/6\.8\.0/u)).toBeNull();
		expect(screen.queryByText("ui.engine.identity.version")).toBeNull();
	});

	it("有摘要时逐行给出身份，多安装有可见告警", () => {
		render(<ReaEngineIdentity summary={SUMMARY} onAskAgent={() => {}} askingAgent={false} />);

		expect(screen.getByText("6.8.0")).toBeTruthy();
		expect(screen.getByText(/opt\/homebrew\/bin\/rea/u)).toBeTruthy();
		expect(screen.getByText("multiple")).toBeTruthy();
		expect(screen.getByText("missing")).toBeTruthy();
		expect(screen.getByText('ui.engine.identity.catalogValue:{"commands":175,"tools":229,"prompts":6}')).toBeTruthy();
		expect(screen.getByText('ui.engine.identity.registrationsValue:{"aligned":1,"total":2}')).toBeTruthy();
		expect(screen.getByText('ui.engine.identity.multipleInstalls:{"count":2}')).toBeTruthy();
	});

	it("点「让 Agent 自检」会把请求交给上层，进行中不可重复点", () => {
		const onAskAgent = vi.fn();
		const { rerender } = render(
			<ReaEngineIdentity summary={SUMMARY} onAskAgent={onAskAgent} askingAgent={false} />,
		);

		fireEvent.click(screen.getByText("ui.engine.askAgent"));
		expect(onAskAgent).toHaveBeenCalledTimes(1);

		rerender(<ReaEngineIdentity summary={SUMMARY} onAskAgent={onAskAgent} askingAgent />);
		const button = screen.getByText("ui.engine.askAgent").closest("button");
		expect(button?.disabled).toBe(true);
	});

	it("缺字段显示占位符，不拿默认值冒充真实值", () => {
		render(
			<ReaEngineIdentity
				summary={{ ...SUMMARY, cliVersion: null, installPaths: [], installState: null }}
				onAskAgent={() => {}}
				askingAgent={false}
			/>,
		);

		expect(screen.getAllByText("ui.engine.identity.missing").length).toBeGreaterThanOrEqual(3);
		expect(screen.queryByText('ui.engine.identity.multipleInstalls:{"count":0}')).toBeNull();
	});
});
