// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

import { DesignSwitcher } from "../features/canvas/components/design-switcher";

/**
 * 切换器只在「有得选」时出现：一个只有唯一选项的下拉是噪音，
 * 而一张空下拉会让人以为设计稿丢了。
 */
afterEach(cleanup);

const docs = [
	{ path: "acme.logocreator-design/design.astravia-log", folder: "acme.logocreator-design", slug: "acme", modifiedAt: 20 },
	{ path: "moss.logocreator-design/design.astravia-log", folder: "moss.logocreator-design", slug: "moss", modifiedAt: 10 },
];

describe("design switcher", () => {
	it("lists every design document once there is more than one", () => {
		render(<DesignSwitcher docs={docs} current={docs[0]!.folder} onSelect={() => {}} />);
		const trigger = screen.getByTestId("design-switcher");
		// 触发器显示当前包的短名（不是整条路径）。
		expect(trigger.textContent).toContain("acme");

		fireEvent.click(trigger);
		const options = screen.getAllByRole("option");
		expect(options).toHaveLength(2);
		expect(options[0]!.textContent).toContain("acme");
		expect(options[1]!.textContent).toContain("moss");
		// 当前包被标记，方便键盘/视觉确认。
		expect(options[0]!.getAttribute("aria-selected")).toBe("true");
	});

	it("reports the chosen package", () => {
		const onSelect = vi.fn();
		render(<DesignSwitcher docs={docs} current={docs[0]!.folder} onSelect={onSelect} />);
		fireEvent.click(screen.getByTestId("design-switcher"));
		fireEvent.click(screen.getAllByRole("option")[1]!);
		expect(onSelect).toHaveBeenCalledWith(docs[1]);
	});

	it("still renders for a single package, so the open one is confirmable", () => {
		// 上一版只有一份包时整块不渲染，「展不开」的下拉就此消失；现在单份也显示。
		render(<DesignSwitcher docs={[docs[0]!]} current={docs[0]!.folder} onSelect={() => {}} />);
		expect(screen.getByTestId("design-switcher")).toBeTruthy();
	});

	it("renders nothing when the project has no package at all", () => {
		const { container } = render(<DesignSwitcher docs={[]} current={null} onSelect={() => {}} />);
		expect(container.firstChild).toBeNull();
	});

	it("says it is scanning on the first open, instead of showing an empty control", () => {
		render(<DesignSwitcher docs={[]} current={null} loading onSelect={() => {}} />);
		expect(screen.getByText("design.switcherLoading")).toBeTruthy();
	});
});
