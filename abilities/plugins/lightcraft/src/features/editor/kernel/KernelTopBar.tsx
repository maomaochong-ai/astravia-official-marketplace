import type { KernelEngine } from "./engine.ts";
import { KernelIcon } from "./KernelIcon.tsx";
import type { EditorStrings } from "../strings.ts";

/**
 * The three controls that stay visible: history, view, and the files leaving the app.
 * Everything cosmetic lives in the inspector, on the right, where the eye can ignore it.
 */

interface KernelTopBarProps {
	engine: KernelEngine;
	strings: EditorStrings;
	title: string;
	onExportPng: () => void;
	onExportJson: () => void;
	onOpenDocument: () => void;
	onInsertImage: () => void;
}

export function KernelTopBar({
	engine,
	strings,
	title,
	onExportPng,
	onExportJson,
	onOpenDocument,
	onInsertImage,
}: KernelTopBarProps) {
	const zoom = Math.round(engine.zoom() * 100);
	const document = engine.document();

	const button = "flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] hover:bg-[#f1f4fb] hover:text-[#0f172a] disabled:opacity-35 disabled:hover:bg-transparent";

	return (
		<div className="flex h-11 shrink-0 items-center gap-2 border-b border-[#e6e9f2] bg-white px-3">
			<span className="max-w-[180px] truncate text-[13px] font-medium text-[#0f172a]">{title}</span>
			<span className="rounded-md bg-[#f1f4fb] px-1.5 py-0.5 text-[11px] text-[#64748b]">
				{document.width}×{document.height}
			</span>

			<div className="mx-1 h-5 w-px bg-[#e6e9f2]" />

			<button type="button" className={button} title={strings.undo} aria-label={strings.undo} disabled={!engine.canUndo()} onClick={() => engine.undo()}>
				<KernelIcon name="undo" />
			</button>
			<button type="button" className={button} title={strings.redo} aria-label={strings.redo} disabled={!engine.canRedo()} onClick={() => engine.redo()}>
				<KernelIcon name="redo" />
			</button>

			<div className="mx-1 h-5 w-px bg-[#e6e9f2]" />

			<button type="button" className={button} title={strings.zoomOut} aria-label={strings.zoomOut} onClick={() => engine.zoomBy(0.9)}>
				<KernelIcon name="zoomOut" />
			</button>
			<button
				type="button"
				className="min-w-[46px] rounded-lg px-1 text-[12px] tabular-nums text-[#475569] hover:bg-[#f1f4fb]"
				title={strings.fit}
				onClick={() => {
					engine.setZoom(1);
					engine.fit();
				}}
			>
				{zoom}%
			</button>
			<button type="button" className={button} title={strings.zoomIn} aria-label={strings.zoomIn} onClick={() => engine.zoomBy(1.1)}>
				<KernelIcon name="zoomIn" />
			</button>
			<button type="button" className={button} title={strings.fit} aria-label={strings.fit} onClick={() => engine.fit()}>
				<KernelIcon name="fit" />
			</button>

			<div className="ml-auto flex items-center gap-1">
				<button type="button" className={button} title={strings.openDocument} aria-label={strings.openDocument} onClick={onOpenDocument}>
					<KernelIcon name="folder" />
				</button>
				<button type="button" className={button} title={strings.importImage} aria-label={strings.importImage} onClick={onInsertImage}>
					<KernelIcon name="image" />
				</button>
				<button type="button" className={button} title={strings.exportJson} aria-label={strings.exportJson} onClick={onExportJson}>
					<KernelIcon name="upload" />
				</button>
				<button
					type="button"
					className="ml-1 flex h-8 items-center gap-1.5 rounded-lg bg-[#2f6df6] px-2.5 text-[12px] font-medium text-white hover:bg-[#2557d6]"
					onClick={onExportPng}
				>
					<KernelIcon name="download" size={15} />
					{strings.exportPng}
				</button>
			</div>
		</div>
	);
}
