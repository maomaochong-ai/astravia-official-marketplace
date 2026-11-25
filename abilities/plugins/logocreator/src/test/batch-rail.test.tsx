// @vitest-environment happy-dom

/**
 * 「一次工具调用出三张，画布只显示一张」的回归。
 *
 * 修法分两半：`pending-design` 存整批 id（工具侧），画布把整批铺成缩略图轨（面板侧）。
 * 这个文件守住后半：N 张就 N 个可点的缩略图，点谁谁成为主图。
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeSpec } from "../domain/spec";
import type { DesignRecord } from "../domain/history-store";
import { BatchRail } from "../features/canvas/components/batch-rail";
import { claimPendingDesignIds, clearPendingDesigns, setPendingDesignIds } from "../features/canvas/pending-design";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => `${key}${params ? `:${Object.values(params).join("/")}` : ""}` }),
	useActiveConversation: () => ({ id: null, cwd: null, isStreaming: false }),
}));

function record(id: string, brandName: string): DesignRecord {
	return {
		id,
		spec: normalizeSpec({ brandName }),
		engine: "local",
		subject: "leaf",
		createdAt: 1,
		favorite: false,
	} as DesignRecord;
}

afterEach(() => {
	cleanup();
	clearPendingDesigns();
});

describe("the variant rail", () => {
	it("shows one thumbnail per design in the batch", () => {
		const records = [record("a", "Alpha"), record("b", "Beta"), record("c", "Gamma")];
		render(<BatchRail records={records} selectedId="b" onSelect={() => {}} onDismiss={() => {}} />);
		expect(screen.getByText(/batch\.title:3/)).toBeTruthy();
		expect(screen.getAllByRole("button", { name: /batch\.item/ }).length).toBe(3);
	});

	it("marks the open design and reports the click", () => {
		const records = [record("a", "Alpha"), record("b", "Beta")];
		const onSelect = vi.fn();
		render(<BatchRail records={records} selectedId="a" onSelect={onSelect} onDismiss={() => {}} />);

		const [first, second] = screen.getAllByRole("button", { name: /batch\.item/ });
		expect(first!.getAttribute("aria-pressed")).toBe("true");
		expect(second!.getAttribute("aria-pressed")).toBe("false");

		fireEvent.click(second!);
		expect(onSelect).toHaveBeenCalledWith(records[1]);
	});

	it("stays out of the way for a single design", () => {
		const { container } = render(
			<BatchRail records={[record("a", "Alpha")]} selectedId="a" onSelect={() => {}} onDismiss={() => {}} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("hands the whole batch to the panel, not just the last id", () => {
		// 工具侧：一次调用写了三张，交给面板的必须是三条 id。
		setPendingDesignIds("C:/repo/demo", ["a", "b", "c"]);
		expect(claimPendingDesignIds("C:/repo/demo")).toEqual(["a", "b", "c"]);
		// 认领是一次性的：再读就空了，不会把旧批次拖回新会话。
		expect(claimPendingDesignIds("C:/repo/demo")).toEqual([]);
	});
});
