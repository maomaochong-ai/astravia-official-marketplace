/**
 * 图表卡片外观的两侧一致性守卫（ADR-0009 §10 验收 ⑤）。
 *
 * UI 内渲染的图表卡片和导出产物看起来必须是同一个东西，但样式天然是两份文件：
 * 导出产物内联 themes/*.css（不能依赖宿主 CSS），UI 用 visualization.css 里的
 * .viz-theme-* 变量。这份重复是刻意的，所以必须有个开关能被拦住漂移。
 *
 * 断言方向：把期望值写死在测试里，两侧各自去对 —— 只改一侧必红。
 * 只比对**颜色 / 圆角 / 阴影**这类「同一个设计决策」的 token；
 * 字号刻意不比：导出产物用 clamp() 跟随视口，抽屉里是固定值，这属于有意的差异。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import dashboardCss from "../features/visualization/themes/dashboard.css?raw";
import screenCss from "../features/visualization/themes/screen.css?raw";
import visualizationCss from "../features/visualization/visualization.css?raw";

/** 归一化：rgba(255, 255, 255, 0.04) 与 rgba(255,255,255,0.04) 是同一个值。 */
function normalize(value) {
	return value.replace(/\s+/g, "").toLowerCase();
}

/** 取出 `selector { ... }` 的声明块；测试里的规则都是单层无嵌套，够用。 */
function block(css, selector, label) {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
	assert.ok(match, `${label}: 未找到规则 ${selector}`);
	return match[1];
}

/**
 * 取声明值。
 *
 * `border` 的匹配要求属性名后面紧跟冒号，所以不会误吃 `border-radius`。
 */
function declaration(cssBlock, property, label) {
	const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = cssBlock.match(new RegExp(`(?:^|;)\\s*${escaped}\\s*:([^;]*)`));
	assert.ok(match, `${label}: ${property} 未声明`);
	return normalize(match[1]);
}

/**
 * 每个主题的期望 token（= 设计决策，唯一事实源）。
 *
 * ui 变量名与导出侧选择器的对应关系写在下面，改主题就是改这张表 + 两侧样式。
 */
const THEMES = [
	{
		name: "看板浅色",
		exportCss: dashboardCss,
		exportCard: ".chart-card",
		exportTitle: ".chart-card h3",
		exportDesc: ".chart-desc",
		uiCss: visualizationCss,
		uiTheme: ".dbx-root .viz-theme-dashboard",
		expect: {
			background: "#ffffff",
			border: "1px solid #e5e7eb",
			boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
			borderRadius: "12px",
			title: "#111827",
			desc: "#6b7280",
		},
	},
	{
		name: "大屏深色",
		exportCss: screenCss,
		exportCard: ".chart-card",
		exportTitle: ".chart-card h3",
		exportDesc: ".chart-desc",
		uiCss: visualizationCss,
		uiTheme: ".dbx-root .viz-theme-screen",
		expect: {
			background: "rgba(255,255,255,0.04)",
			border: "1px solid rgba(6,182,212,0.25)",
			boxShadow: "0 0 24px rgba(6,182,212,0.12)",
			borderRadius: "4px",
			title: "#a5f3fc",
			desc: "#94a3b8",
		},
	},
];

// 期望值也按「空白无关」归一化：CSS 里的 1px solid #e5e7eb 与 1pxsolid#e5e7eb 是同一个值，
// 断言不应该被排版空格绊倒。
for (const theme of THEMES) {
	for (const key of Object.keys(theme.expect)) {
		theme.expect[key] = normalize(theme.expect[key]);
	}
}

describe("chart-theme-parity", () => {
	for (const theme of THEMES) {
		describe(theme.name, () => {
			it("导出产物（themes/*.css）的卡片 token 与设计决策一致", () => {
				const card = block(theme.exportCss, theme.exportCard, theme.name);
				assert.equal(declaration(card, "background", theme.name), theme.expect.background, "卡片背景");
				assert.equal(declaration(card, "border", theme.name), theme.expect.border, "卡片描边");
				assert.equal(declaration(card, "box-shadow", theme.name), theme.expect.boxShadow, "卡片阴影");
				assert.equal(declaration(card, "border-radius", theme.name), theme.expect.borderRadius, "卡片圆角");

				const title = block(theme.exportCss, theme.exportTitle, theme.name);
				assert.equal(declaration(title, "color", theme.name), theme.expect.title, "图表标题色");

				const desc = block(theme.exportCss, theme.exportDesc, theme.name);
				assert.equal(declaration(desc, "color", theme.name), theme.expect.desc, "图表说明色");
			});

			it("UI 内渲染（visualization.css 的 .viz-theme-*）与同一组 token 一致", () => {
				const ui = block(theme.uiCss, theme.uiTheme, theme.name);
				assert.equal(declaration(ui, "--viz-card-bg", theme.name), theme.expect.background, "--viz-card-bg");
				assert.equal(declaration(ui, "--viz-card-border", theme.name), theme.expect.border, "--viz-card-border");
				assert.equal(declaration(ui, "--viz-card-shadow", theme.name), theme.expect.boxShadow, "--viz-card-shadow");
				assert.equal(declaration(ui, "--viz-card-radius", theme.name), theme.expect.borderRadius, "--viz-card-radius");
				assert.equal(declaration(ui, "--viz-title", theme.name), theme.expect.title, "--viz-title");
				assert.equal(declaration(ui, "--viz-desc", theme.name), theme.expect.desc, "--viz-desc");
			});

			it("卡片消费的是这一组变量（而不是写死值）", () => {
				const css = theme.uiCss;
				assert.match(css, /\.viz-canvas-card\s*\{[^}]*var\(--viz-card-radius/, "圆角未走变量");
				assert.match(css, /\.viz-canvas-card\s*\{[^}]*var\(--viz-card-bg/, "背景未走变量");
				assert.match(css, /\.viz-canvas-title\s*\{[^}]*var\(--viz-title/, "标题色未走变量");
			});
		});
	}

	it("两个主题的卡片外观确实不同（防止复制粘贴时漏改其中一份）", () => {
		const dashboard = THEMES[0].expect;
		const screen = THEMES[1].expect;
		assert.notEqual(dashboard.background, screen.background);
		assert.notEqual(dashboard.borderRadius, screen.borderRadius);
		assert.notEqual(dashboard.title, screen.title);
	});

	it("UI 内渲染用的仍是 themes/*.css 的同一份规则（模式串未被改写）", () => {
		// 导出产物内联的是原文件；一旦有人把 .chart-card 改名为 .viz-canvas-card，
		// 导出路径会静默退化成无样式页面，这里把它钉住。
		for (const theme of THEMES) {
			assert.match(theme.exportCss, /\.chart-card\s*\{/, `${theme.name}: .chart-card 规则消失`);
			assert.match(theme.exportCss, /\.chart-desc\s*\{/, `${theme.name}: .chart-desc 规则消失`);
		}
	});
});
