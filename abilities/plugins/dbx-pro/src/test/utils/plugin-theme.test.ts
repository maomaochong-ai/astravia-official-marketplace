/**
 * 主题属性下发测试 — 每个插件根都必须带 data-dbx-theme（src/style.css 据此切令牌）。
 *
 * 宿主只在 <html> 上写 data-mode，而插件样式被 plugin-vite 包进
 * @scope ([data-astravia-plugin-root="dbx-pro"])，作用域内匹配不到 html[data-mode]；
 * 属性缺失的那一帧就会退到系统色板 / 默认浅色，所以「何时写属性」是这里有意义的断言。
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { applyPluginTheme, initPluginTheme } from "../../shared/theme/plugin-theme.ts";

const ATTR = "data-dbx-theme";

/** MutationObserver 回调不在当前微任务里同步执行，等一次宏任务更稳。 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** 复刻宿主包裹结构：宿主容器 + 插件自己的 .dbx-root，两层都带插件根标记。 */
function mountRoot() {
	const host = document.createElement("div");
	host.setAttribute("data-astravia-plugin-root", "dbx-pro");
	document.body.appendChild(host);
	const root = document.createElement("div");
	root.setAttribute("data-astravia-plugin-root", "dbx-pro");
	root.className = "dbx-root";
	host.appendChild(root);
	return { host, root };
}

beforeEach(() => {
	document.body.innerHTML = "";
	document.documentElement.removeAttribute("data-mode");
});

describe("applyPluginTheme", () => {
	it("宿主容器与插件根都写属性，并跟随 data-mode 切换", () => {
		document.documentElement.setAttribute("data-mode", "dark");
		const { host, root } = mountRoot();

		applyPluginTheme();
		assert.equal(host.getAttribute(ATTR), "dark");
		assert.equal(root.getAttribute(ATTR), "dark");

		document.documentElement.setAttribute("data-mode", "light");
		applyPluginTheme();
		assert.equal(host.getAttribute(ATTR), "light");
		assert.equal(root.getAttribute(ATTR), "light");
	});
});

describe("initPluginTheme", () => {
	it("宿主后插入的插件根会被补上属性", async () => {
		document.documentElement.setAttribute("data-mode", "dark");
		const dispose = initPluginTheme();
		try {
			const { host, root } = mountRoot();
			await flush();
			assert.equal(host.getAttribute(ATTR), "dark");
			assert.equal(root.getAttribute(ATTR), "dark");
		} finally {
			dispose();
		}
	});

	it("与插件根无关的节点插入不触发同步", async () => {
		document.documentElement.setAttribute("data-mode", "dark");
		const dispose = initPluginTheme();
		try {
			const { host } = mountRoot();
			await flush();
			// 人为改错，作为「这次变更是否触发了同步」的探针。
			host.setAttribute(ATTR, "light");
			document.body.appendChild(document.createElement("div"));
			await flush();
			assert.equal(host.getAttribute(ATTR), "light");
		} finally {
			dispose();
		}
	});
});
