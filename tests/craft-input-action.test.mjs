/**
 * 输入栏里的那一枚开关，是市场插件唯一该占的位置。
 *
 * 宿主把「提示上下文附件」画在输入框卡片**下沿外面**，那枚胶囊跨消息、跨会话都在，
 * 是给宿主内置附件留的位置。craft 家族曾经用它交付编辑器状态，结果：
 *
 *   - 装上插件、什么都没做，输入框下面也可能挂着一枚说不清用处的名字；
 *   - 编辑器标签已经关了，胶囊还在，用户点开发现指着一片空气。
 *
 * 现在状态随 `decoratePrompt()` 在发送时交付：任何时刻输入框内外都不留痕，屏幕上唯一
 * 的插件痕迹是用户亲手打开的那枚开关，以及它在工具行里的高亮胶囊。
 *
 * 这份测试钉的就是这条边界——它靠读源码而不是渲染，因为要防的是「有人又把它加回来」，
 * 而不是某一次渲染的具体像素。
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../abilities/plugins/", import.meta.url));
const APPS = ["designcraft", "effectcraft", "filmcraft", "lightcraft", "pdfcraft", "vectorcraft", "photocraft",
	"cadcraft", "deckcraft", "figcraft", "gridcraft", "wordcraft", "texturecraft", "materialcraft", "craft-anything"];

function sources(app) {
	const found = [];
	const walk = (directory) => {
		for (const entry of readdirSync(directory)) {
			const path = join(directory, entry);
			if (statSync(path).isDirectory()) {
				walk(path);
				continue;
			}
			if (/\.tsx?$/.test(entry)) found.push(path);
		}
	};
	walk(join(ROOT, app, "src"));
	return found;
}

function read(app, relative) {
	return readFileSync(join(ROOT, app, relative), "utf8");
}

test("no craft plugin writes a prompt attachment", () => {
	const offenders = [];
	for (const app of APPS) {
		for (const file of sources(app)) {
			// 匹配调用而不是提到名字：注释里解释它一遍不算违规。
			if (/\.setPromptAttachment\s*\(/.test(readFileSync(file, "utf8"))) {
				offenders.push(file.slice(ROOT.length).replaceAll("\\", "/"));
			}
		}
	}
	assert.deepEqual(
		offenders,
		[],
		`prompt attachments render under the composer card and stay there; market plugins must use the input action instead:\n${offenders.join("\n")}`,
	);
});

test("the composer entry is a toggle, off by default, in both conversation scenarios", () => {
	for (const app of APPS) {
		const index = read(app, "src/index.tsx");
		assert.match(index, /registerInputAction\(/, `${app}: no input action is registered`);
		assert.match(index, /defaultActive:\s*false/, `${app}: the toggle must start off — an installed plugin shows nothing`);
		assert.match(index, /scope_use:\s*\[\s*"conversation",\s*"project"\s*\]/, `${app}: the toggle must appear in both scenarios`);
	}
});

test("the editor state reaches the model through decoratePrompt", () => {
	for (const app of APPS) {
		const index = read(app, "src/index.tsx");
		assert.match(index, /decoratePrompt\s*:/, `${app}: decoratePrompt is how the state rides along`);
		assert.match(index, /readCraftState\(\)/, `${app}: decoratePrompt must read the published state`);
		assert.match(read(app, "src/features/editor/engagement.ts"), /export function publishCraftState/, `${app}: no state publisher`);
	}
});
