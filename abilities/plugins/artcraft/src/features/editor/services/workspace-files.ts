import type { PluginContext } from "@astravia-org/plugin-sdk";
import { emptyDocument, parse, serialize, type KernelDocument } from "../../../domain/kernel-document.ts";

/**
 * Where the page lives.
 *
 * Autosave goes to the plugin's own storage: it survives a restart, never asks the
 * user for a location, and never writes into their project behind their back.
 * Writing to disk is an explicit action (`导出`), which is why the only filesystem
 * call here is `saveAs` — the one the user confirms in a native dialog.
 *
 * ADR: docs/adr/<slug>/craft-0011-the-engine-is-ours.md
 */

const DOCUMENT_PATH = "document.json";

export interface CraftFiles {
	load(): Promise<KernelDocument | null>;
	save(document: KernelDocument): Promise<void>;
	exportPng(base64: string, name: string): Promise<string | null>;
	exportProject(document: KernelDocument, name: string): Promise<string | null>;
	readProject(path: string): Promise<KernelDocument | null>;
}

export function craftFiles(ctx: PluginContext, fallback: KernelDocument): CraftFiles {
	return {
		async load() {
			try {
				const text = await ctx.storage.readFile(DOCUMENT_PATH, "utf8");
				if (!text) return null;
				return parse(text, fallback);
			} catch {
				return null;
			}
		},
		async save(document) {
			try {
				await ctx.storage.writeFile(DOCUMENT_PATH, serialize(document), "utf8");
			} catch {
				// Storage is best effort: a full disk must not break the canvas.
			}
		},
		async exportPng(base64, name) {
			const payload = base64.replace(/^data:image\/png;base64,/, "");
			return ctx.fs.saveAs(`${name}.png`, payload, "base64", {
				title: "导出图片",
				filters: [{ name: "PNG", extensions: ["png"] }],
			});
		},
		async exportProject(document, name) {
			return ctx.fs.saveAs(`${name}.json`, serialize(document), "utf8", {
				title: "导出工程",
				filters: [{ name: "JSON", extensions: ["json"] }],
			});
		},
		async readProject(path) {
			try {
				const read = await ctx.fs.readFile(path);
				const text = read.encoding === "base64" ? atob(read.content) : read.content;
				return parse(text, emptyDocument(fallback.mode, fallback.width, fallback.height, fallback.background));
			} catch {
				return null;
			}
		},
	};
}
