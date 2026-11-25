// @vitest-environment happy-dom

/**
 * 画布上「这一批」的呈现。
 *
 * 真实缺陷：一次生成 4 张时，画布只画一张，另外三张放在 dock 上方一条缩略图轨里 ——
 * 那条轨和 dock 抢同一块底部空间（截图里直接叠在一起），而且那几张只能看不能动。
 *
 * 现在的契约：
 *   1. 2 张以上铺成网格，每张都是可点的目标（选中 / 放大）；
 *   2. 单张不进网格（回退到原来的单张画布）；
 *   3. 网格里的缩略图与主图同源：矢量用预览缓存，位图用 blob URL。
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeSpec } from "../domain/spec";
import type { DesignRecord } from "../domain/history-store";
import { VariantGrid } from "../features/canvas/components/variant-grid";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join("/")}` : key) }),
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

afterEach(cleanup);

describe("the canvas variant grid", () => {
	it("lays out every design of the batch as its own tile", () => {
		const records = [record("a", "Alpha"), record("b", "Beta"), record("c", "Gamma"), record("d", "Delta")];
		render(<VariantGrid records={records} selectedId="b" onSelect={() => {}} onStage={() => {}} />);

		// 每张一个选中按钮 + 一个放大按钮。
		expect(screen.getAllByTitle(/grid\.select/).length).toBe(4);
		expect(screen.getAllByRole("button", { name: "grid.stage" }).length).toBe(4);
	});

	it("marks the open one and reports selection", () => {
		const records = [record("a", "Alpha"), record("b", "Beta")];
		const onSelect = vi.fn();
		render(<VariantGrid records={records} selectedId="a" onSelect={onSelect} onStage={() => {}} />);

		const [first, second] = screen.getAllByTitle(/grid\.select/);
		expect(first!.getAttribute("aria-pressed")).toBe("true");
		expect(second!.getAttribute("aria-pressed")).toBe("false");

		fireEvent.click(second!);
		expect(onSelect).toHaveBeenCalledWith(records[1]);
	});

	it("can enlarge one tile into the single canvas", () => {
		const records = [record("a", "Alpha"), record("b", "Beta")];
		const onStage = vi.fn();
		render(<VariantGrid records={records} selectedId="a" onSelect={() => {}} onStage={onStage} />);

		fireEvent.click(screen.getAllByRole("button", { name: "grid.stage" })[0]!);
		expect(onStage).toHaveBeenCalledWith(records[0]);
	});

	it("stays out of the way for a single design", () => {
		const { container } = render(
			<VariantGrid records={[record("a", "Alpha")]} selectedId="a" onSelect={() => {}} onStage={() => {}} />,
		);
		expect(container.firstChild).toBeNull();
	});
});
