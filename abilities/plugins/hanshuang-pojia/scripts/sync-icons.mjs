#!/usr/bin/env node
/**
 * 把 scripts/icon-manifest.json 里点名的图标，从 @iconify-json 的数据包解析成
 * 面板直接渲染的静态节点树（src/features/workbench/components/shell/icon-paths.ts）。
 *
 * 生成而不是运行时读 JSON：插件产物只需要几十个图标，不该背 10 MB 图标库；
 * 生成而不是手抄：图形必须与上游逐字一致，--check 在测试里当护栏用。
 *
 * 用法：node scripts/sync-icons.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(ROOT, "scripts/icon-manifest.json");
const OUT = join(ROOT, "src/features/workbench/components/shell/icon-paths.ts");

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

function readSet(name) {
	const file = join(ROOT, "node_modules/@iconify-json", name, "icons.json");
	const version = JSON.parse(readFileSync(join(ROOT, "node_modules/@iconify-json", name, "package.json"), "utf8")).version;
	return { data: JSON.parse(readFileSync(file, "utf8")), version };
}

function resolve(sets, reference) {
	const [setName, ...rest] = reference.split(":");
	const id = rest.join(":");
	const set = sets[setName];
	if (!set) throw new Error(`unknown icon set: ${setName}`);
	const icon = set.data.icons[id] ?? set.data.icons[set.data.aliases?.[id]?.parent ?? ""];
	if (!icon) throw new Error(`icon not found: ${reference}`);
	return { set: setName, id, body: icon.body };
}

function render() {
	const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
	const sets = { lucide: readSet("lucide"), solar: readSet("solar") };
	const rows = [];
	const sources = [];
	for (const [name, reference] of Object.entries(manifest.icons)) {
		const icon = resolve(sets, reference);
		rows.push(`\t${JSON.stringify(name)}: ${serialize(parseBody(icon.body))},`);
		sources.push(`\t${JSON.stringify(name)}: { set: ${JSON.stringify(icon.set)}, id: ${JSON.stringify(icon.id)} },`);
	}
	const header = [
		"/**",
		" * 由 scripts/sync-icons.mjs 从 scripts/icon-manifest.json 生成，请勿手改。",
		` * 数据来源：@iconify-json/solar ${sets.solar.version}、@iconify-json/lucide ${sets.lucide.version}。`,
		" *",
		" * 导航图标取 solar bold（实心，小尺寸下比细线更立得住），",
		" * 按钮与状态图标取 lucide（统一 2 单位描边，与 24 格网格对齐）。",
		" */",
		"",
		"export interface IconNode {",
		"\ttag: string;",
		"\tattrs?: Record<string, string>;",
		"\tchildren?: IconNode[];",
		"}",
		"",
		"/** 图标名到上游标识的映射，测试用它核对生成结果。 */",
		"export const ICON_SOURCES: Record<string, { set: string; id: string }> = {",
		...sources,
		"};",
		"",
		"export const ICON_PATHS: Record<string, IconNode[]> = {",
		...rows,
		"};",
		"",
	].join("\n");
	return header;
}

const expected = render();
if (process.argv.includes("--check")) {
	const actual = readFileSync(OUT, "utf8");
	if (actual !== expected) {
		console.error("icon paths are stale: run node scripts/sync-icons.mjs");
		process.exit(1);
	}
	console.log(`icon paths ok: ${Object.keys(JSON.parse(readFileSync(MANIFEST, "utf8")).icons).length} icons`);
} else {
	writeFileSync(OUT, expected);
	console.log(`wrote ${OUT}`);
}
