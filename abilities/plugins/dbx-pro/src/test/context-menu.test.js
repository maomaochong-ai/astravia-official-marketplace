/**
 * ContextMenu 面板边界与交互回归测试。
 *
 * 覆盖的缺陷：表右键底部的「更多」子菜单只按父项顶对齐向右展开，
 * 在面板下缘展开时整体落到面板外，后几项被裁掉（真实浏览器里溢出 130px）。
 *
 * happy-dom 不做布局，这里用一套简化布局模型代替浏览器：
 * - 菜单高度由子项数量决定（行高 / 分隔线固定），宽度取 inline width / minWidth / maxWidth；
 * - 菜单位置取 inline left/top（面板铺满视口时，面板坐标 = 视口坐标）；
 * - 父项在菜单中的纵向位置由它在菜单里的序号累加得出。
 * 断言的是「组件算出的 inline 定位 + 实测尺寸」是否仍落在面板矩形内 ——
 * 这正是真实浏览器里决定会不会被裁掉的那部分。
 */

import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { createElement, useState } from "react";
import RTL from "@testing-library/react";

import { ContextMenu } from "../shared/components/context-menu.tsx";

const { cleanup, fireEvent, render } = RTL;

/** 面板铺满视口：菜单坐标原点与视口一致。 */
const VIEWPORT = { left: 0, top: 0, right: 1200, bottom: 700, width: 1200, height: 700 };
const ROW_HEIGHT = 26;
const SEPARATOR_HEIGHT = 9;
const MENU_PADDING = 8;
const MENU_BORDER = 2;
const EMPTY = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };

// ── 简化布局模型 ────────────────────────────────────────────

function num(value) {
	const n = Number.parseFloat(value);
	return Number.isFinite(n) ? n : 0;
}

function menuWidth(el) {
	const natural = el.style.width !== "" ? num(el.style.width) : num(el.style.minWidth);
	const max = el.style.maxWidth !== "" ? num(el.style.maxWidth) : Number.POSITIVE_INFINITY;
	return Math.min(natural, max);
}

function menuHeight(el) {
	let inner = MENU_PADDING;
	for (const child of el.children) {
		inner += child.classList.contains("h-px") ? SEPARATOR_HEIGHT : ROW_HEIGHT;
	}
	const max = el.style.maxHeight !== "" ? num(el.style.maxHeight) : Number.POSITIVE_INFINITY;
	return Math.min(inner + MENU_BORDER, max);
}

function menuRect(el) {
	const width = menuWidth(el);
	const height = menuHeight(el);
	const left = num(el.style.left);
	const top = num(el.style.top);
	return { left: left + VIEWPORT.left, top: top + VIEWPORT.top, right: left + VIEWPORT.left + width, bottom: top + VIEWPORT.top + height, width, height };
}

function itemRect(el) {
	const menu = el.closest('[role="menu"]');
	if (!menu) return EMPTY;
	const rect = menuRect(menu);
	let offset = (MENU_BORDER + MENU_PADDING) / 2;
	for (const child of menu.children) {
		if (child === el || child.contains(el)) break;
		offset += child.classList.contains("h-px") ? SEPARATOR_HEIGHT : ROW_HEIGHT;
	}
	return { left: rect.left, top: rect.top + offset, right: rect.right, bottom: rect.top + offset + ROW_HEIGHT, width: rect.width, height: ROW_HEIGHT };
}

function fakeRect(el) {
	if (typeof el.classList?.contains === "function" && el.classList.contains("dbx-root")) return { ...VIEWPORT };
	const role = el.getAttribute?.("role");
	if (role === "menu") return menuRect(el);
	if (role === "menuitem") return itemRect(el);
	return EMPTY;
}

let originalGetBoundingClientRect;

before(() => {
	originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
	Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
		return fakeRect(this);
	};
});

after(() => {
	Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

// ── 夹具 ────────────────────────────────────────────────────

const clicked = [];
const closes = [];

function item(label) {
	return { type: "item", label, onClick: () => void clicked.push(label) };
}

function sub(label, items) {
	return { type: "submenu", label, items };
}

function sep() {
	return { type: "separator" };
}

/** 与 connection-node.tsx 表右键同构（截取尾部，含「更多」）。 */
function tableMenuItems() {
	return [
		item("预览数据"),
		item("查看表结构"),
		item("在新标签页打开（不执行）"),
		sep(),
		item("统计行数"),
		sep(),
		sub("生成 SQL", [item("SELECT"), item("INSERT")]),
		sep(),
		sub("可视化", [item("生成企业看板")]),
		sep(),
		item("添加到 AI"),
		sep(),
		sub("更多", [
			item("执行 VACUUM"),
			item("执行 VACUUM FULL"),
			sep(),
			item("截断表"),
			item("清空数据"),
			item("删除表"),
			item("强制删除（CASCADE）"),
		]),
		sep(),
		item("刷新"),
	];
}

/** 受控包装：模拟调用方在 onClose 里收起菜单。 */
function Harness({ x, y, items }) {
	const [open, setOpen] = useState(true);
	if (!open) return null;
	return createElement(ContextMenu, {
		menu: { x, y, items },
		onClose: () => {
			closes.push(1);
			setOpen(false);
		},
	});
}

let container = null;

afterEach(() => {
	cleanup();
	container?.remove();
	container = null;
	clicked.length = 0;
	closes.length = 0;
});

function renderMenu(x, y, items = tableMenuItems()) {
	container = document.createElement("div");
	container.className = "dbx-root";
	document.body.appendChild(container);
	return render(createElement(Harness, { x, y, items }), { container });
}

function menus() {
	return Array.from(document.querySelectorAll('[role="menu"]'));
}

function submenuTrigger(label) {
	return Array.from(document.querySelectorAll('[role="menuitem"][aria-haspopup="true"]')).find(
		(button) => button.textContent.trim() === label,
	);
}

function submenuItem(menu, label) {
	return Array.from(menu.querySelectorAll('[role="menuitem"]')).find((button) => button.textContent.trim() === label);
}

describe("ContextMenu · 面板边界", () => {
	it("表右键在面板下缘：「更多」整体上移，全部子项留在面板内", () => {
		renderMenu(140, 690);
		const main = fakeRect(menus()[0]);
		assert.ok(main.top >= VIEWPORT.top && main.bottom <= VIEWPORT.bottom, `主菜单 ${main.top}~${main.bottom} 应落在面板内`);

		fireEvent.mouseOver(submenuTrigger("更多"));
		const submenu = menus()[1];
		assert.ok(submenu, "「更多」子菜单应已渲染");

		const sub = fakeRect(submenu);
		assert.ok(sub.top >= VIEWPORT.top, `子菜单顶部 ${sub.top} 越出面板上缘`);
		assert.ok(sub.bottom <= VIEWPORT.bottom, `子菜单底部 ${sub.bottom} 越出面板下缘 ${VIEWPORT.bottom}（修复前是 805）`);
		assert.equal(sub.bottom, VIEWPORT.bottom - 4, "底边贴住面板下缘");
	});

	it("空间足够时与父项顶对齐，不做无谓上移", () => {
		renderMenu(140, 60);
		fireEvent.mouseOver(submenuTrigger("更多"));
		const sub = fakeRect(menus()[1]);
		const item = fakeRect(submenuTrigger("更多"));
		assert.equal(sub.top, item.top);
	});

	it("面板右下角：子菜单翻到父菜单左侧且不出界", () => {
		renderMenu(1190, 120);
		const main = fakeRect(menus()[0]);
		fireEvent.mouseOver(submenuTrigger("更多"));
		const sub = fakeRect(menus()[1]);
		assert.ok(sub.right <= VIEWPORT.right - 4, `子菜单右缘 ${sub.right} 越出面板`);
		assert.ok(sub.left < main.left, "应翻到父菜单左侧");
		assert.match(submenuTrigger("更多").innerHTML, /chevron-left/, "展开项箭头应指向左侧");
	});

	it("箭头只反映展开项自己的方向：未展开项仍朝右", () => {
		renderMenu(1190, 120);
		fireEvent.mouseOver(submenuTrigger("更多"));
		assert.match(submenuTrigger("生成 SQL").innerHTML, /chevron-right/);
	});
});

describe("ContextMenu · 交互", () => {
	it("点击子菜单项：触发回调并关闭菜单（子菜单 portal 后不能被当成点外部）", () => {
		renderMenu(140, 300);
		fireEvent.mouseOver(submenuTrigger("更多"));
		const target = submenuItem(menus()[1], "删除表");
		assert.ok(target, "子菜单里应有「删除表」");

		fireEvent.mouseDown(target);
		assert.equal(menus().length, 2, "mousedown 子菜单项不应关掉菜单");
		assert.deepEqual(clicked, [], "仅 mousedown 不应触发点击");

		fireEvent.click(target);
		assert.deepEqual(clicked, ["删除表"]);
		assert.equal(menus().length, 0, "执行后菜单应关闭");
	});

	it("点击主菜单项：先关闭再执行", () => {
		renderMenu(140, 300);
		fireEvent.click(submenuItem(menus()[0], "预览数据"));
		assert.deepEqual(clicked, ["预览数据"]);
		assert.equal(menus().length, 0);
	});

	it("第一次 Esc 只收起子菜单，第二次才关菜单", () => {
		renderMenu(140, 300);
		fireEvent.mouseOver(submenuTrigger("更多"));
		assert.equal(menus().length, 2);

		fireEvent.keyDown(document, { key: "Escape" });
		assert.equal(menus().length, 1, "Esc 应先收起子菜单");
		assert.deepEqual(closes, []);

		fireEvent.keyDown(document, { key: "Escape" });
		assert.equal(menus().length, 0);
	});

	it("点击菜单外部关闭", () => {
		renderMenu(140, 300);
		fireEvent.mouseDown(document.body);
		assert.equal(menus().length, 0);
		assert.equal(closes.length, 1);
	});
});

describe("ContextMenu · 菜单自身滚动", () => {
	/** 临时把面板压矮，让菜单触发限高内部滚动。 */
	function withShortPanel(fn) {
		const originalHeight = VIEWPORT.height;
		VIEWPORT.height = 200;
		try {
			fn();
		} finally {
			VIEWPORT.height = originalHeight;
		}
	}

	it("面板装不下时限高交给内部滚动，滚动自身不会把菜单关掉", () => {
		withShortPanel(() => {
			renderMenu(140, 120);
			const main = menus()[0];
			assert.ok(main.style.maxHeight !== "", "应给出限高");
			fireEvent.scroll(main);
			assert.equal(menus().length, 1, "滚动菜单自身不应关闭菜单");
			assert.deepEqual(closes, []);
		});
	});

	it("滚动页面其他容器仍然关闭菜单", () => {
		renderMenu(140, 300);
		fireEvent.scroll(document.body);
		assert.equal(menus().length, 0);
		assert.equal(closes.length, 1);
	});

	it("主菜单滚动时只收起子菜单，避免子菜单停在旧锚点", () => {
		withShortPanel(() => {
			renderMenu(140, 120);
			fireEvent.mouseOver(submenuTrigger("更多"));
			assert.equal(menus().length, 2);

			fireEvent.scroll(menus()[0]);
			assert.equal(menus().length, 1, "滚动后子菜单应收起");
			assert.deepEqual(closes, [], "主菜单应仍然打开");
		});
	});
});
