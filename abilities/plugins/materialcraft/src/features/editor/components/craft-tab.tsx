import { useEffect, useState } from "react";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { APP } from "../../../app.config.ts";
import { useCraftEditor } from "../hooks/use-craft-editor.ts";
import { useContainerFullscreen } from "../hooks/use-container-fullscreen.ts";
import { KernelCanvas, pickImage } from "../kernel/KernelCanvas.tsx";
import { KernelInspector } from "../kernel/KernelInspector.tsx";
import { KernelTopBar } from "../kernel/KernelTopBar.tsx";
import { KernelToolRail } from "../kernel/KernelToolRail.tsx";
import { EditorStatusBar } from "./editor-status-bar.tsx";
import { subscribeCraftProgress } from "../session-registry.ts";
import type { CraftProgress } from "../../../domain/agent-report.ts";

/**
 * The tab: a layout, and three hooks. Everything it can do lives in the engine, so the
 * file you are reading is the whole UI surface — there is no second renderer behind it.
 */

export function CraftTab({ ctx }: { ctx: PluginContext }) {
	const editor = useCraftEditor(ctx, APP.kernel, APP.name);
	const fullscreen = useContainerFullscreen();
	const [progress, setProgress] = useState<CraftProgress | null>(null);

	useEffect(() => subscribeCraftProgress(setProgress), []);

	const { engine, version, strings } = editor;

	return (
		<div
			ref={fullscreen.ref}
			className="flex h-full w-full flex-col overflow-hidden bg-white text-[13px] text-[#0f172a] antialiased"
			style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif' }}
		>
			<KernelTopBar
				engine={engine}
				strings={strings}
				title={APP.name}
				onExportPng={() => void editor.exportPng()}
				onExportJson={() => void editor.exportJson()}
				onOpenDocument={() => void editor.restore()}
				onInsertImage={() => void pickImage(engine, { x: engine.document().width / 2, y: engine.document().height / 2 })}
			/>
			<div className="flex min-h-0 flex-1">
				<KernelToolRail engine={engine} strings={strings} />
				<div className="relative min-w-0 flex-1">
					<KernelCanvas engine={engine} version={version} strings={strings} />
				</div>
				<KernelInspector
					engine={engine}
					strings={strings}
					onInsertImage={() => void pickImage(engine, { x: engine.document().width / 2, y: engine.document().height / 2 })}
				/>
			</div>
			<EditorStatusBar
				engine={engine}
				strings={strings}
				progress={progress}
				note={editor.note}
				fullscreen={fullscreen.fullscreen}
				onToggleFullscreen={fullscreen.toggle}
			/>
		</div>
	);
}
