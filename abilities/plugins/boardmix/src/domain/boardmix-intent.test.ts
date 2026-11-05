import { describe, expect, it } from "vitest";
import { matchBoardmixIntent } from "./boardmix-intent";

describe("matchBoardmixIntent", () => {
	it("提到产品名或「白板」就接住", () => {
		expect(matchBoardmixIntent("帮我在 boardmix 上看看上周的评审板")).toBe("focus");
		expect(matchBoardmixIntent("Boardmix 里怎么弄")).toBe("focus");
		expect(matchBoardmixIntent("打开白板")).toBe("focus");
		expect(matchBoardmixIntent("show me the whiteboard")).toBe("focus");
	});

	it("要新建时走新建入口", () => {
		expect(matchBoardmixIntent("在白板上新建一个流程图")).toBe("create");
		expect(matchBoardmixIntent("开个白板讲一下这个方案")).toBe("create");
		expect(matchBoardmixIntent("create a whiteboard for the review")).toBe("create");
	});

	it("无关提问一律放过去", () => {
		expect(matchBoardmixIntent("帮我改一下这个 React 组件")).toBeNull();
		expect(matchBoardmixIntent("这个文档的表格怎么导出")).toBeNull();
		expect(matchBoardmixIntent("")).toBeNull();
		expect(matchBoardmixIntent(undefined)).toBeNull();
		expect(matchBoardmixIntent(42)).toBeNull();
	});
});
