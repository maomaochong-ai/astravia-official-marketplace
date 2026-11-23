#!/usr/bin/env node
/**
 * 把面板要用的图标从 `@iconify-json/solar` 解析成静态节点树
 * （`src/shared/components/icons.generated.ts`）。
 *
 * 为什么生成而不是手绘：上一版每个图标都是手抄的路径，线宽、圆角、视觉重量各不相同，
 * dock 看起来像「杂乱无章的小图形」——用户的评价。宿主自己的图标就来自 Solar，
 * 用它才有官方感，也和小尺寸下的可读性一致。
 *
 * 为什么生成而不是运行时读 JSON：插件产物只需要十几个图标，不该背一个 10 MB 的图标库。
 *
 * 解析顺序：本插件的 node_modules → 同级插件的 node_modules（同一仓库里已有这个数据包）。
 * 两处都找不到时给出明确提示，不静默产出空图标。
 *
 * 用法：node scripts/sync-icons.mjs [--check]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/shared/components/icons.generated.ts");
const CHECK = process.argv.includes("--check");

/**
 * 面板用到的每个图标：导出名 → Solar bold 名。
 *
 * 全部取 `-bold`：dock 与工具条都是 14–16 px，实心比重描边立得住。
 * 名字直接对应用途（不是「看起来像」），换图标时改这里再跑一次同步。
 */
const ICONS = {
	// dock：画布的六个动词
	generate: "magic-wand-3-bold", // 作为主操作：生成
	raster: "gallery-wide-bold", // AI 图片（宿主图像服务）
	reference: "gallery-edit-bold", // 以这张为底再生成
	surprise: "shuffle-bold", // 换一组
	inspector: "tuning-2-bold", // 打开参数面板
	notes: "notes-bold", // 备注
	export: "download-minimalistic-bold", // 导出 / 品牌套件
	// 标题栏与浮动控件
	history: "history-bold",
	ai: "magic-wand-bold",
	reset: "restart-bold",
	// 通用动作
	close: "close-bold",
	check: "check-bold",
	trash: "trash-bin-minimalistic-bold",
	copy: "copy-bold",
	star: "star-bold",
	rename: "pen-bold",
	eye: "eye-bold",
	vector: "layers-minimalistic-bold",
	palette: "palette-bold",
	eyedropper: "pipette-bold",
	imageSize: "ruler-cross-pen-bold",
	folder: "folder-bold",
};

/** HTML 属性是 kebab-case，React 要 camelCase。 */
function camel(name) {
	return name.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function parseBody(body) {
	const roots = [];
	const stack = [roots];
	const tagRe = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[a-zA-Z-]+="[^"]*")*)\s*(\/?)>/g;
	let match;
	while ((match = tagRe.exec(body)) !== null) {
		const [, closing, tag, attributeText, selfClosing] = match;
		if (closing) {
			stack.pop();
			continue;
		}
		const attrs = {};
		for (const attribute of attributeText.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) attrs[camel(attribute[1])] = attribute[2];
		const node = { tag };
		if (Object.keys(attrs).length > 0) node.attrs = attrs;
		const parent = stack[stack.length - 1];
		parent.push(node);
		if (!selfClosing) {
			node.children = [];
			stack.push(node.children);
		}
	}
	if (stack.length !== 1) throw new Error("icon body has unbalanced tags");
	return roots;
}

function serialize(nodes) {
	const parts = nodes.map(node => {
		const fields = [`tag:"${node.tag}"`];
		if (node.attrs) fields.push(`attrs:${JSON.stringify(node.attrs)}`);
		if (node.children) fields.push(`children:${serialize(node.children)}`);
		return `{${fields.join(",")}}`;
	});
	return `[${parts.join(",")}]`;
}

function locateSolar() {
	const candidates = [
		join(ROOT, "node_modules/@iconify-json/solar"),
		// 同一仓库里另一个插件已经装了这个数据包：复用它，避免为了生成一次图标联网。
		join(ROOT, "..", "hanshuang-pojia/node_modules/@iconify-json/solar"),
	];
	for (const dir of candidates) {
		if (existsSync(join(dir, "icons.json"))) return dir;
	}
	throw new Error(
		[
			"找不到 @iconify-json/solar。",
			"在插件目录下执行 `npm i -D @iconify-json/solar`，或在仓库根执行 `npm i -D @iconify-json/solar --prefix abilities/plugins/logocreator`。",
			`已尝试：${candidates.join("、")}`,
		].join("\n"),
	);
}

function main() {
	const dir = locateSolar();
	const data = JSON.parse(readFileSync(join(dir, "icons.json"), "utf8"));
	const version = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version;

	const rows = [];
	const sources = [];
	for (const [name, id] of Object.entries(ICONS)) {
		const icon = data.icons[id] ?? data.icons[data.aliases?.[id]?.parent ?? ""];
		if (!icon) throw new Error(`solar 里没有这个图标：${id}（导出名 ${name}）`);
		rows.push(`\t${JSON.stringify(name)}: ${serialize(parseBody(icon.body))},`);
		sources.push(`\t${JSON.stringify(name)}: ${JSON.stringify(id)},`);
	}

	const text = [
		"/**",
		" * 由 scripts/sync-icons.mjs 生成，请勿手改。",
		` * 数据来源：@iconify-json/solar ${version}（与宿主界面同一套图标）。`,
		" *",
		" * 只收录面板实际用到的名字：一个图标一个用途，改用途就改脚本里的映射再同步。",
		" */",
		"",
		"export interface IconNode {",
		"\ttag: string;",
		"\tattrs?: Record<string, string>;",
		"\tchildren?: IconNode[];",
		"}",
		"",
		"/** 面板导出名 → Solar 图标名；测试用它核对生成结果与上游一致。 */",
		"export const ICON_SOURCES: Record<string, string> = {",
		...sources,
		"};",
		"",
		"export const ICON_PATHS: Record<string, IconNode[]> = {",
		...rows,
		"};",
		"",
	].join("\n");

	if (CHECK) {
		const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
		if (current !== text) {
			console.error("icons.generated.ts 与 @iconify-json/solar 不一致，运行 node scripts/sync-icons.mjs 重新生成。");
			process.exit(1);
		}
		console.log(`icons: ${Object.keys(ICONS).length} 个与 solar ${version} 一致`);
		return;
	}

	writeFileSync(OUT, text, "utf8");
	console.log(`icons: 写入 ${Object.keys(ICONS).length} 个图标（solar ${version}）→ ${OUT.replace(ROOT, ".")}`);
}

main();
