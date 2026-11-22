// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// 主题与翻译来自宿主：单测里只钉「菜单按 key 渲染、点击后关闭」这两件事。
vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));
import { ContextMenu } from "../../features/workbench/components/shell/context-menu";
import type { PanelMenu } from "../../features/workbench/hooks/use-panel-menu";

/**
 * The shared menu is what the document tree, the case library and the sample list all use.
 * It has to survive the same three interactions everywhere: click an item, press Escape,
 * click outside. Those are the ones that silently break when a menu is copied per page.
 */
const menu: PanelMenu = {
	left: 12,
	top: 12,
	heading: "cases/client-auth-gate/",
	groups: [
		{ id: "open", items: [{ id: "open", label: "menu.open", icon: "eye", run: () => {} }] },
		{
			id: "export",
			items: [
				{ id: "package", label: "menu.exportPackage", icon: "save", hint: "3", run: () => {} },
				{ id: "listing", label: "menu.exportIndex", icon: "save", run: () => {} },
			],
		},
	],
};

afterEach(cleanup);

describe("context menu", () => {
	it("renders every group, the heading and the row hint", () => {
		render(
			<div data-panel-root>
				<ContextMenu menu={menu} onClose={() => {}} />
			</div>,
		);
		expect(screen.getByRole("menu")).toBeTruthy();
		expect(screen.getByText("cases/client-auth-gate/")).toBeTruthy();
		expect(screen.getAllByRole("menuitem")).toHaveLength(3);
		expect(screen.getByText("3")).toBeTruthy();
	});

	it("runs the item and closes in that order", () => {
		const run = vi.fn();
		const close = vi.fn();
		render(
			<div data-panel-root>
				<ContextMenu
					menu={{ left: 0, top: 0, groups: [{ id: "g", items: [{ id: "a", label: "only", run }] }] }}
					onClose={close}
				/>
			</div>,
		);
		fireEvent.click(screen.getByText("only"));
		expect(run).toHaveBeenCalledTimes(1);
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("closes on Escape and on a click on the scrim", () => {
		const close = vi.fn();
		render(
			<div data-panel-root>
				<ContextMenu menu={menu} onClose={close} />
			</div>,
		);
		fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
		fireEvent.click(screen.getByTestId("context-menu-scrim"));
		expect(close).toHaveBeenCalledTimes(2);
	});

	it("renders nothing when there is no menu", () => {
		render(
			<div data-panel-root>
				<ContextMenu menu={null} onClose={() => {}} />
			</div>,
		);
		expect(screen.queryByRole("menu")).toBeNull();
	});
});
