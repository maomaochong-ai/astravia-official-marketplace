import { useEffect, useMemo, useRef, useState } from "react";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { KernelDocument } from "../../../domain/kernel-document.ts";
import { craftFiles, type CraftFiles } from "../services/workspace-files.ts";
import { editorStrings, type EditorStrings } from "../strings.ts";
import { useEngine, type KernelConfig } from "../kernel/useEngine.ts";
import type { KernelEngine } from "../kernel/engine.ts";

/**
 * Everything the tab needs that is not a component: restore, autosave, shortcuts,
 * export. Keeping it here means `craft-tab.tsx` stays a layout file and the hooks
 * stay testable without rendering.
 */

export interface CraftEditor {
	engine: KernelEngine;
	version: number;
	strings: EditorStrings;
	files: CraftFiles;
	note: string | null;
	exportPng: () => Promise<void>;
	exportJson: () => Promise<void>;
	restore: () => Promise<void>;
}

const SAVE_DEBOUNCE = 900;

export function useCraftEditor(ctx: PluginContext, config: KernelConfig, title: string): CraftEditor {
	const { engine, version } = useEngine(config);
	const [locale, setLocale] = useState<string>(() => {
		try {
			return ctx.i18n.locale;
		} catch {
			return "zh";
		}
	});
	const [note, setNote] = useState<string | null>(null);

	useEffect(() => {
		let disposable: { dispose(): void } | undefined;
		try {
			disposable = ctx.i18n.onChange((next) => setLocale(next));
		} catch {
			disposable = undefined;
		}
		return () => disposable?.dispose();
	}, [ctx]);

	const strings = useMemo(() => editorStrings(locale), [locale]);
	const files = useMemo(() => craftFiles(ctx, engine.document()), [ctx, engine]);

	// Restore once per engine. A failure is silent on purpose: an empty page is a
	// valid starting point, and a toast about a missing autosave would be noise.
	const restored = useRef(false);
	useEffect(() => {
		if (restored.current) return;
		restored.current = true;
		void (async () => {
			const stored = await files.load();
			if (!stored || stored.shapes.length === 0) return;
			engine.setDocument({ ...stored, mode: engine.document().mode });
			engine.markSaved();
		})();
	}, [engine, files]);

	// Autosave: debounced while typing, flushed when the tab goes away. There is no
	// timer left behind — the debounce is a timeout that the cleanup clears.
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | null = null;
		let pending: KernelDocument | null = null;

		const flush = () => {
			if (!pending) return;
			const document = pending;
			pending = null;
			void files.save(document).then(() => engine.markSaved());
		};

		const unsubscribe = engine.subscribe(() => {
			if (!engine.dirty()) return;
			pending = engine.document();
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				timer = null;
				flush();
			}, SAVE_DEBOUNCE);
		});

		return () => {
			unsubscribe();
			if (timer) clearTimeout(timer);
			flush();
		};
	}, [engine, files]);

	// Shortcuts are bound to the window: the canvas is not the only focusable thing
	// in a tab, and a canvas-only listener would stop working after a click on a panel.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
			const mod = event.metaKey || event.ctrlKey;

			if (mod && event.key.toLowerCase() === "z") {
				if (typing) return;
				event.preventDefault();
				if (event.shiftKey) engine.redo();
				else engine.undo();
				return;
			}
			if (mod && event.key.toLowerCase() === "a") {
				if (typing) return;
				event.preventDefault();
				engine.selectAll();
				return;
			}
			if (mod && event.key.toLowerCase() === "d") {
				if (typing) return;
				event.preventDefault();
				engine.duplicateSelection();
				return;
			}
			if (typing) return;
			if (event.key === "Delete" || event.key === "Backspace") {
				event.preventDefault();
				engine.remove();
				return;
			}
			if (event.key === "Escape") {
				engine.clearSelection();
				return;
			}
			const step = event.shiftKey ? 10 : 1;
			if (event.key === "ArrowLeft") engine.nudge(-step, 0);
			if (event.key === "ArrowRight") engine.nudge(step, 0);
			if (event.key === "ArrowUp") engine.nudge(0, -step);
			if (event.key === "ArrowDown") engine.nudge(0, step);
		};

		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [engine]);

	const exportPng = async () => {
		const png = engine.png();
		if (!png) {
			setNote("画布还没有准备好");
			return;
		}
		const saved = await files.exportPng(png, title);
		setNote(saved ? `已导出 ${saved}` : "已取消导出");
	};

	const exportJson = async () => {
		const saved = await files.exportProject(engine.document(), title);
		setNote(saved ? `已导出 ${saved}` : "已取消导出");
	};

	const restore = async () => {
		const stored = await files.load();
		if (!stored) {
			setNote("没有找到已保存的工程");
			return;
		}
		engine.setDocument({ ...stored, mode: engine.document().mode });
		engine.markSaved();
		setNote("已恢复上次保存的工程");
	};

	return { engine, version, strings, files, note, exportPng, exportJson, restore };
}
