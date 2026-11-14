import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtefactPanels } from "../features/scan-console/components/artefact-panels";

afterEach(cleanup);

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key} ${JSON.stringify(params)}` : key);

/**
 * 三个台账面板到底能不能用 —— 从 DOM 判定，而不是从数据存在判定。
 *
 * 用户说的「死功能」有两种形态，这里各钉一条：
 *  - 写了但看不到正文（笔记）：点一行必须展开 `strix_note_get` 取回的正文；
 *  - 数据比面板多却不说（覆盖）：超过上限必须有"还有 N 行"，不能静默截断。
 */

describe("notes panel is inspectable", () => {
	it("expands a row and shows the body fetched for that id", async () => {
		const onOpenNote = vi.fn(async (id: string) => `body of ${id}: GET /api/orders/1002`);
		render(
			<ArtefactPanels
				t={t}
				todos={[]}
				coverage={[]}
				notes={[
					{ id: "n1", title: "IDOR payload", category: "findings", updatedAt: "" },
					{ id: "n2", title: "endpoint map", category: "plan", updatedAt: "" },
				]}
				onOpenNote={onOpenNote}
			/>,
		);

		// 列表里只有标题，正文要显式打开——这是"可检查"而不是"能看见一行字"。
		expect(screen.getByText("IDOR payload")).toBeTruthy();
		await userEvent.click(screen.getByText("IDOR payload"));
		expect(await screen.findByText(/body of n1/)).toBeTruthy();
		expect(onOpenNote).toHaveBeenCalledWith("n1");

		// 再点一次收起，已经取到的正文不再挂着。
		await userEvent.click(screen.getByText("IDOR payload"));
		expect(screen.queryByText(/body of n1/)).toBeNull();
	});

	it("surfaces a failed fetch instead of an empty box", async () => {
		render(
			<ArtefactPanels
				t={t}
				todos={[]}
				coverage={[]}
				notes={[{ id: "n1", title: "broken", category: "", updatedAt: "" }]}
				onOpenNote={async () => {
					throw new Error("note n1 is gone");
				}}
			/>,
		);
		await userEvent.click(screen.getByText("broken"));
		expect(await screen.findByText(/note n1 is gone/)).toBeTruthy();
	});
});

describe("coverage panel tells the truth about truncation", () => {
	it("says how many rows are not shown", () => {
		const coverage = Array.from({ length: 11 }, (_, index) => ({
			surface: `/api/thing-${index}`,
			outcome: "clean" as const,
		}));
		render(<ArtefactPanels t={t} todos={[]} notes={[]} coverage={coverage} coverageTally={{ clean: 11, vulnerable: 0 }} />);
		expect(screen.getByText(/panels.moreRows/)).toBeTruthy();
		expect(screen.getByText(/"count":3/)).toBeTruthy();
	});

	it("uses the service tally rather than counting the visible rows", () => {
		render(
			<ArtefactPanels
				t={t}
				todos={[]}
				notes={[]}
				coverage={[{ surface: "/api/a", outcome: "clean" }]}
				// 服务知道全量：1 个可见，但台账里有 5 个 vulnerable 与 9 个 clean。
				coverageTally={{ vulnerable: 5, clean: 9 }}
			/>,
		);
		expect(screen.getByText("5/9")).toBeTruthy();
	});
});

describe("plan panel", () => {
	it("shows progress on the title and marks unfinished work", () => {
		render(
			<ArtefactPanels
				t={t}
				notes={[]}
				coverage={[]}
				todos={[
					{ id: "t1", title: "enumerate /api", status: "done", priority: "high" },
					{ id: "t2", title: "try /admin", status: "in_progress", priority: "critical" },
				]}
			/>,
		);
		expect(screen.getByText("1/2")).toBeTruthy();
		expect(screen.getByText("try /admin")).toBeTruthy();
		expect(screen.getByText(/critical/)).toBeTruthy();
	});

	it("keeps its empty state honest, behind an expander", async () => {
		// 空面板在标题行就写明“谁来填”；具体空态文案收在展开后——两处都要真的存在。
		render(<ArtefactPanels t={t} todos={[]} notes={[]} coverage={[]} />);
		expect(screen.getByText("rail.empty.todos")).toBeTruthy();
		expect(screen.getByText("rail.empty.coverage")).toBeTruthy();
		expect(screen.getByText("rail.empty.notes")).toBeTruthy();

		for (const toggle of screen.getAllByRole("button", { name: "+" })) {
			await userEvent.click(toggle);
		}
		expect(screen.getByText("todos.empty")).toBeTruthy();
		expect(screen.getByText("coverage.empty")).toBeTruthy();
		// 笔记空态在同一次展开里可见（三个盒子各自一个开关）。
		expect(screen.getByText("notes.empty")).toBeTruthy();
	});
});
