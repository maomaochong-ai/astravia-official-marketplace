// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
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
		const select = screen.getByTestId("design-switcher") as HTMLSelectElement;
		expect([...select.options].map(option => option.value)).toEqual(["acme.logocreator-design", "moss.logocreator-design"]);
		expect(select.value).toBe("acme.logocreator-design");
	});

	it("stays out of the way when there is nothing to switch between", () => {
		const { container } = render(<DesignSwitcher docs={[docs[0]!]} current={docs[0]!.folder} onSelect={() => {}} />);
		expect(container.firstChild).toBeNull();
		expect(screen.queryByTestId("design-switcher")).toBeNull();
	});

	it("says it is scanning on the first open, instead of showing an empty control", () => {
		render(<DesignSwitcher docs={[]} current={null} loading onSelect={() => {}} />);
		expect(screen.getByText("design.switcherLoading")).toBeTruthy();
	});
});
