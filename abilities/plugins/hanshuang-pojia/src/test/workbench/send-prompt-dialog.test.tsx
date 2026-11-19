// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// 组件只用 SDK 的 useTranslation；测试里没有宿主桥，t 原样返回键名（与既有 tsx 测试同口径）。
vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

import { SendPromptDialog } from "../../features/workbench/components/workbench/send-prompt-dialog";

/**
 * 发送前编辑：这一层存在的意义是「改完再发」，所以测三件事：
 *  1. 不动的话，发出去的和初值逐字相同（预览不能变成第二套文案）；
 *  2. 改了的话，发出去的是改后的文本；
 *  3. 空文本不发。
 */

const INITIAL = "请按 lab 契约继续：先定位，再给补丁表。";

afterEach(cleanup);

function open(props: Partial<React.ComponentProps<typeof SendPromptDialog>> = {}) {
	const onSend = vi.fn();
	const onClose = vi.fn();
	render(<SendPromptDialog open initial={INITIAL} onClose={onClose} onSend={onSend} {...props} />);
	return { onSend, onClose };
}

const sendButton = () => screen.getByText("chat.preview.send").closest("button") as HTMLButtonElement;
const cancelButton = () => screen.getByText("common.cancel").closest("button") as HTMLButtonElement;

describe("发送前确认", () => {
	it("不修改时发送的就是初值", () => {
		const { onSend, onClose } = open();
		fireEvent.click(sendButton());
		expect(onSend).toHaveBeenCalledWith(INITIAL);
		expect(onClose).toHaveBeenCalled();
	});

	it("修改后发送编辑过的文本", () => {
		const { onSend } = open();
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "只做静态分析，不要执行样本。" } });
		fireEvent.click(sendButton());
		expect(onSend).toHaveBeenCalledWith("只做静态分析，不要执行样本。");
	});

	it("首尾空白被剪掉，空文本不发", () => {
		const { onSend } = open();
		const box = screen.getByRole("textbox");
		fireEvent.change(box, { target: { value: "   " } });
		expect(sendButton().disabled).toBe(true);
		fireEvent.change(box, { target: { value: "  有内容  " } });
		fireEvent.click(sendButton());
		expect(onSend).toHaveBeenCalledWith("有内容");
	});

	it("关闭不发任何东西", () => {
		const { onSend, onClose } = open();
		fireEvent.click(cancelButton());
		expect(onSend).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
	});

	it("关着的时候什么都不渲染", () => {
		render(<SendPromptDialog open={false} initial={INITIAL} onClose={() => {}} onSend={() => {}} />);
		expect(screen.queryByRole("textbox")).toBeNull();
	});
});
