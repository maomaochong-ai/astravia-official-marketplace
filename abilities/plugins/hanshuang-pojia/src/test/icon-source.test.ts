import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ICON_PATHS, ICON_SOURCES, type IconNode } from "../features/workbench/components/shell/icon-paths";
import { NAV } from "../features/workbench/state";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const WORKBENCH = join(ROOT, "src/features/workbench");

/** 上游 body 里每个元素的 tag + 属性，顺序与生成时一致。 */
function fingerprint(nodes: IconNode[]): string[] {
	return nodes.flatMap(node => {
		const attrs = Object.entries(node.attrs ?? {}).map(([key, value]) => `${key}=${value}`);
		return [`${node.tag} ${attrs.join(" ")}`, ...fingerprint(node.children ?? [])];
	});
}

function camel(name: string): string {
	return name.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

const SETS = new Map<string, { icons: Record<string, { body: string }>; aliases?: Record<string, { parent?: string }> }>();

function iconSet(name: string) {
	const cached = SETS.get(name);
	if (cached) return cached;
	const loaded = JSON.parse(readFileSync(join(ROOT, "node_modules/@iconify-json", name, "icons.json"), "utf8"));
	SETS.set(name, loaded);
	return loaded;
}

function upstream(reference: string): string[] {
	const [set, ...rest] = reference.split(":");
	const id = rest.join(":");
	const icons = iconSet(set!);
	const body: string | undefined = (icons.icons[id] ?? icons.icons[icons.aliases?.[id]?.parent ?? ""])?.body;
	if (!body) throw new Error(`icon not found: ${reference}`);
	const result: string[] = [];
	for (const match of body.matchAll(/<([a-zA-Z][\w-]*)((?:\s+[a-zA-Z-]+="[^"]*")*)\s*\/?>/g)) {
		const attrs = [...(match[2] ?? "").matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map(attribute => `${camel(attribute[1]!)}=${attribute[2]}`);
		result.push(`${match[1]} ${attrs.join(" ")}`);
	}
	return result;
}

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return /\.tsx?$/.test(entry.name) ? [path] : [];
	});
}

describe("icon data", () => {
	it("keeps every glyph byte-identical to the iconify package", () => {
		const names = Object.keys(ICON_SOURCES);
		expect(names.length).toBeGreaterThan(40);
		for (const name of names) {
			const source = ICON_SOURCES[name]!;
			expect(fingerprint(ICON_PATHS[name]!), `${name} (${source.set}:${source.id})`).toEqual(upstream(`${source.set}:${source.id}`));
		}
	});

	it("resolves every icon name the panel actually renders", () => {
		const used = new Set<string>();
		for (const group of NAV) for (const item of group.items) used.add(item.icon);
		for (const file of sourceFiles(WORKBENCH)) {
			const text = readFileSync(file, "utf8");
			for (const match of text.matchAll(/(?:name|icon)=["']([a-zA-Z][\w-]*)["']/g)) used.add(match[1]!);
		}
		expect(used.size).toBeGreaterThan(20);
		const missing = [...used].filter(name => !ICON_PATHS[name]);
		expect(missing).toEqual([]);
	});
});
