// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 导入菜单：一个按钮里放两条路（本地文件 / 随包预制模板）。
 *
 * 之前模板库是页面底部一张独立卡片，和顶部「导入」按钮做的是同一件事，
 * 用户得在两个地方找。现在合成一个下拉，这里锁三件事：
 *   1. 打开就能同时看到「本地文件」与六份预制模板；
 *   2. 点模板把正文取出来交给调用方，标题用文件名（六份首个 `#` 都是同一句，不能当标题）；
 *   3. 库里已有同正文时不再重复插一条，只给提示。
 */

const TEMPLATES = [
	{ id: "寒霜v1.2", title: "寒霜v1.2", file: "寒霜v1.2.md", summary: "旧版四段式", chars: 1200 },
	{ id: "寒霜v5", title: "寒霜v5", file: "寒霜v5.md", summary: "现行主用", chars: 2400 },
];

vi.mock("../../features/workbench/services/templates", () => ({
	templateEntries: () => TEMPLATES,
	loadTemplateBody: async (id: string) => `BODY:${id}`,
}));

const { ImportMenu } = await import("../../features/workbench/components/prompts/import-menu");

const translate = (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key);

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: translate }),
}));

afterEach(cleanup);

describe("ImportMenu", () => {
	it("lists the local-file route and every preset once opened", () => {
		render(<ImportMenu existing={[]} onLocal={() => {}} onTemplate={() => {}} notify={() => {}} />);
		// 菜单内容即便收起也在 DOM 里，断言文案存在即可。
		expect(screen.getByText("template.menu.local")).toBeTruthy();
		expect(screen.getByText("template.menu.presets")).toBeTruthy();
		for (const entry of TEMPLATES) expect(screen.getByText(entry.title)).toBeTruthy();
	});

	it("hands the template body to the caller, keyed by file name", async () => {
		const onTemplate = vi.fn();
		render(<ImportMenu existing={[]} onLocal={() => {}} onTemplate={onTemplate} notify={() => {}} />);
		fireEvent.click(screen.getByText("寒霜v5"));
		await waitFor(() => expect(onTemplate).toHaveBeenCalledTimes(1));
		expect(onTemplate.mock.calls[0][0]).toMatchObject({ name: "寒霜v5", content: "BODY:寒霜v5" });
	});

	it("does not add a second copy when the body is already in the library", async () => {
		const onTemplate = vi.fn();
		const notify = vi.fn();
		render(<ImportMenu existing={[{ content: "BODY:寒霜v5" }]} onLocal={() => {}} onTemplate={onTemplate} notify={notify} />);
		fireEvent.click(screen.getByText("寒霜v5"));
		await waitFor(() => expect(notify).toHaveBeenCalled());
		expect(onTemplate).not.toHaveBeenCalled();
		expect(String(notify.mock.calls[0][0])).toContain("template.alreadyImported");
	});

	it("routes the local-file item to the hidden file input", () => {
		const onLocal = vi.fn();
		render(<ImportMenu existing={[]} onLocal={onLocal} onTemplate={() => {}} notify={() => {}} />);
		fireEvent.click(screen.getByText("template.menu.local"));
		expect(onLocal).toHaveBeenCalledTimes(1);
	});
});
