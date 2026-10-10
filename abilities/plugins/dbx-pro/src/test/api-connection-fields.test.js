/**
 * 「API 接入」表单字段的回归测试。
 *
 * 覆盖两个曾经对不上的地方：
 * 1. Bearer 下那个框（内部是值前缀）以前挂着「令牌」的标签，用户会把 token 填进去，
 *    而服务端对 bearer 根本不读前缀 —— 现在该框只在 API Key 下出现，且正名为「值前缀」。
 * 2. 请求头与凭据都不从服务端回传，框里平时是空的；占位要说明「留空表示不修改」，
 *    不能让用户以为之前填的请求头丢了。
 *
 * 容器带 .dbx-root，与其它组件测试一致；不用 JSX，统一 createElement。
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createElement } from "react";
import RTL from "@testing-library/react";
import { ApiConnectionFields } from "../features/database-workspace/components/api-connection-fields.tsx";

const { cleanup, render } = RTL;

let container = null;

afterEach(() => {
	cleanup();
	container?.remove();
	container = null;
});

/** 只渲染受控组件，onChange 不回流（断言的是 DOM 里有哪些框）。 */
function renderFields(spec) {
	container = document.createElement("div");
	container.className = "dbx-root";
	document.body.appendChild(container);
	return render(
		createElement(ApiConnectionFields, {
			conn: { id: "local-api", name: "orders-api", db_type: "api", host: "", port: 0, api: spec },
			onChange: () => {},
		}),
		{ container },
	);
}

/** 表单里的标签文字（按出现顺序）。 */
function labels() {
	return [...container.querySelectorAll(".dbx-form-label")].map((el) => el.textContent);
}

function inputByPlaceholder(placeholder) {
	return container.querySelector(`input[placeholder="${placeholder}"]`);
}

/** 请求头是多行框；placeholder 带换行，不能走属性选择器。 */
function headerBox() {
	return container.querySelector("textarea");
}

describe("ApiConnectionFields 认证字段", () => {
	it("Bearer 下只有「凭据」，不再露出无用的前缀框", () => {
		renderFields({ url: "https://api.example.com/orders", method: "GET", auth: { kind: "bearer" } });
		assert.deepEqual(labels(), ["接口地址 *", "认证方式", "凭据", "数据路径", "行数上限", "自定义请求头（可选）"]);
		// 前缀字段对 bearer 无效（服务端 normalizeAuth 会丢掉），不该有输入口。
		assert.equal(inputByPlaceholder("留空即原样发送"), null);
	});

	it("API Key 下是「请求头名」+「值前缀」+「凭据」", () => {
		renderFields({ url: "https://api.example.com/orders", method: "GET", auth: { kind: "api-key", headerName: "X-Api-Key" } });
		assert.deepEqual(labels(), [
			"接口地址 *",
			"认证方式",
			"请求头名",
			"值前缀（可选）",
			"凭据",
			"数据路径",
			"行数上限",
			"自定义请求头（可选）",
		]);
		assert.ok(inputByPlaceholder("X-API-Key"), "请求头名应有输入框");
		assert.ok(inputByPlaceholder("留空即原样发送"), "值前缀应有输入框");
	});

	it("Basic 下是「用户名」+「密码」", () => {
		renderFields({ url: "https://api.example.com/orders", method: "GET", auth: { kind: "basic", username: "alice" } });
		assert.deepEqual(labels(), [
			"接口地址 *",
			"认证方式",
			"用户名",
			"密码",
			"数据路径",
			"行数上限",
			"自定义请求头（可选）",
		]);
		assert.equal(inputByPlaceholder("留空即原样发送"), null);
	});

	it("无需认证时不出现任何凭据字段", () => {
		renderFields({ url: "https://api.example.com/orders", method: "GET", auth: { kind: "none" } });
		assert.deepEqual(labels(), ["接口地址 *", "认证方式", "数据路径", "行数上限", "自定义请求头（可选）"]);
	});
});

describe("ApiConnectionFields 请求头占位", () => {
	it("没存过请求头时给示例", () => {
		renderFields({ url: "https://api.example.com/orders", method: "GET", auth: { kind: "none" } });
		assert.equal(headerBox().placeholder, "X-Env: prod\nAccept-Language: zh-CN");
		assert.match(container.textContent, /每行一条/);
		assert.equal(container.textContent.includes("留空表示不修改"), false);
	});

	it("存过请求头时说明留空即不修改", () => {
		renderFields({ url: "https://api.example.com/orders", method: "GET", auth: { kind: "none" }, hasHeaders: true });
		assert.equal(headerBox().placeholder, "已保存，留空表示不修改");
		assert.match(container.textContent, /留空表示不修改已保存的请求头/);
	});
});

describe("ApiConnectionFields 凭据占位", () => {
	it("已存凭据时提示留空不改", () => {
		renderFields({ url: "https://api.example.com/orders", method: "GET", auth: { kind: "bearer" }, hasSecret: true });
		assert.ok(inputByPlaceholder("已保存，留空表示不修改"));
	});
});
