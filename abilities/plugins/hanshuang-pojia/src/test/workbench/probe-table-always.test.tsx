// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

import { EMPTY_PROFILE } from "../../domain/refusal-probe";
import { ProbeRefusalCard } from "../../features/workbench/components/prompts/probe-refusal-card";

/**
 * 没有会话、没有记录、没有实时对照 —— 用户说的「表格没出现」最常见的现场。
 * 表格必须还在：每一档列出、判定写「未测」。
 */
afterEach(cleanup);

describe("gradient table without a session", () => {
	it("still lists every rung, with an unrun verdict", () => {
		render(
			<div data-panel-root>
				<ProbeRefusalCard
					record={null}
					profile={EMPTY_PROFILE}
					patchProfile={() => {}}
					onBrief={() => {}}
					onDiscuss={() => {}}
					refresh={() => {}}
				/>
			</div>,
		);
		expect(screen.getByTestId("probe-table")).toBeTruthy();
		// 默认梯度是四档（EMPTY_PROFILE.level = 4）。
		const rows = screen.getByTestId("probe-table").querySelectorAll("tbody tr");
		expect(rows.length).toBe(4);
		for (const row of rows) expect(row.getAttribute("data-verdict")).toBe("pending");
		expect(screen.getAllByText("probe.verdict.pending").length).toBe(4);
	});

	it("shows the live rows instead of the empty-table message", () => {
		render(
			<div data-panel-root>
				<ProbeRefusalCard
					record={null}
					profile={{ ...EMPTY_PROFILE, model: "manual-model" }}
					patchProfile={() => {}}
					onBrief={() => {}}
					onDiscuss={() => {}}
					refresh={() => {}}
					live={{
						model: "manual-model",
						rows: [
							{ level: 1, name: "边界确认", verdict: "answered", text: "只问边界" },
							{ level: 2, name: "证据清单", verdict: "refused", kind: "policy", text: "要证据清单" },
						],
					}}
				/>
			</div>,
		);
		const rows = screen.getByTestId("probe-table").querySelectorAll("tbody tr");
		expect(rows.length).toBe(2);
		expect(rows[1]?.getAttribute("data-verdict")).toBe("refused");
		// 曾经这里显示「这一次探测没有拿到可判定的回复」—— 那句话已删，因为行现在来自 live。
		expect(screen.queryByText("probe.rowsEmpty")).toBeNull();
	});
});
