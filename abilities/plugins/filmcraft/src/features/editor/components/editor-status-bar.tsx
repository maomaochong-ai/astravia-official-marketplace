import type { KernelEngine } from "../kernel/engine.ts";
import type { EditorStrings } from "../strings.ts";

/**
 * One thin line: what is on the page, what is selected, whether it is saved.
 * It is also where a batch reports itself, so an agent run is visible while it runs
 * instead of appearing only when it finishes.
 */

interface EditorStatusBarProps {
	engine: KernelEngine;
	strings: EditorStrings;
	progress: { index: number; total: number; label: string } | null;
	note: string | null;
	fullscreen: boolean;
	onToggleFullscreen: () => void;
}

export function EditorStatusBar({
	engine,
	strings,
	progress,
	note,
	fullscreen,
	onToggleFullscreen,
}: EditorStatusBarProps) {
	const document = engine.document();
	const shapes = document.shapes.filter((shape) => !shape.locked).length;
	const selected = engine.selection().length;
	const dirty = engine.dirty();

	return (
		<div className="flex h-7 shrink-0 items-center gap-3 border-t border-[#e6e9f2] bg-white px-3 text-[11px] text-[#64748b]">
			<span className="tabular-nums">
				{shapes} {strings.shapes}
				{selected > 0 ? ` · ${selected} ${strings.selected}` : ""}
			</span>

			{progress ? (
				<span className="flex items-center gap-1.5 text-[#2f6df6]">
					<span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#2f6df6]" />
					{progress.index}/{progress.total} · {progress.label}
				</span>
			) : (
				<span className="truncate">{note ?? strings.hint}</span>
			)}

			<span className="ml-auto tabular-nums">{Math.round(engine.zoom() * 100)}%</span>
			<button
				type="button"
				onClick={onToggleFullscreen}
				className="rounded px-1 text-[11px] text-[#64748b] hover:bg-[#f1f4fb] hover:text-[#0f172a]"
				title={fullscreen ? "退出全屏" : "全屏"}
			>
				{fullscreen ? "退出全屏" : "全屏"}
			</button>
			<span className={dirty ? "text-[#b45309]" : "text-[#16a34a]"}>{dirty ? strings.unsaved : strings.saved}</span>
		</div>
	);
}
