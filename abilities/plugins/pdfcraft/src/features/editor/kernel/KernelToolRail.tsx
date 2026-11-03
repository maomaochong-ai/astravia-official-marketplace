import type { KernelEngine } from "./engine.ts";
import { KernelIcon } from "./KernelIcon.tsx";
import { surfacePreset, type ToolId } from "./presets.ts";
import type { EditorStrings } from "../strings.ts";

interface KernelToolRailProps {
	engine: KernelEngine;
	strings: EditorStrings;
}

/** Tools the current surface actually offers, in one column. */
export function KernelToolRail({ engine, strings }: KernelToolRailProps) {
	const preset = surfacePreset(engine.document().mode);
	const active = engine.tool();

	return (
		<div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-[#e6e9f2] bg-white py-2">
			{preset.tools.map((tool: ToolId) => {
				const selected = active === tool;
				return (
					<button
						key={tool}
						type="button"
						title={strings.tools[tool] ?? tool}
						aria-label={strings.tools[tool] ?? tool}
						aria-pressed={selected}
						onClick={() => engine.setTool(tool)}
						className={
							selected
								? "flex h-9 w-9 items-center justify-center rounded-lg bg-[#2f6df6] text-white"
								: "flex h-9 w-9 items-center justify-center rounded-lg text-[#475569] hover:bg-[#f1f4fb] hover:text-[#0f172a]"
						}
					>
						<KernelIcon name={tool} size={17} />
					</button>
				);
			})}
		</div>
	);
}
