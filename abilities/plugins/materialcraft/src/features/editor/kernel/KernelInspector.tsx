import { useState } from "react";
import type { Shape } from "../../../domain/kernel-document.ts";
import type { AlignMode } from "../../../domain/kernel-document.ts";
import type { KernelEngine } from "./engine.ts";
import { KernelIcon } from "./KernelIcon.tsx";
import type { EditorStrings } from "../strings.ts";

/**
 * Layers on top, properties below — the two things a click on the page leaves you
 * wanting. Fields write through the engine, so every keystroke is undoable.
 */

interface KernelInspectorProps {
	engine: KernelEngine;
	strings: EditorStrings;
	onInsertImage: () => void;
}

function NumberField({
	label,
	value,
	suffix,
	onChange,
}: {
	label: string;
	value: number;
	suffix?: string;
	onChange: (value: number) => void;
}) {
	return (
		<label className="flex items-center gap-1.5 text-[11px] text-[#64748b]">
			<span className="w-3 shrink-0">{label}</span>
			<input
				type="number"
				value={Math.round(value)}
				onChange={(event) => {
					const next = Number(event.target.value);
					if (Number.isFinite(next)) onChange(next);
				}}
				className="h-7 w-full min-w-0 rounded-md border border-[#e6e9f2] bg-white px-1.5 text-[12px] tabular-nums text-[#0f172a] outline-none focus:border-[#2f6df6]"
			/>
			{suffix ? <span className="shrink-0 text-[10px] text-[#94a3b8]">{suffix}</span> : null}
		</label>
	);
}

function ColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	return (
		<div className="flex items-center gap-1.5">
			<input
				type="color"
				value={value.startsWith("#") ? value : "#2f6df6"}
				onChange={(event) => onChange(event.target.value)}
				className="h-6 w-7 cursor-pointer rounded border border-[#e6e9f2] bg-white p-0"
			/>
			<input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="h-7 w-full min-w-0 rounded-md border border-[#e6e9f2] bg-white px-1.5 text-[11px] text-[#0f172a] outline-none focus:border-[#2f6df6]"
			/>
		</div>
	);
}

const ALIGNS: { mode: AlignMode; glyph: string; labelKey: keyof EditorStrings }[] = [
	{ mode: "left", glyph: "alignLeft", labelKey: "alignLeft" },
	{ mode: "center-x", glyph: "alignCenterX", labelKey: "alignCenterX" },
	{ mode: "right", glyph: "alignRight", labelKey: "alignRight" },
	{ mode: "top", glyph: "alignTop", labelKey: "alignTop" },
	{ mode: "middle", glyph: "alignMiddle", labelKey: "alignMiddle" },
	{ mode: "bottom", glyph: "alignBottom", labelKey: "alignBottom" },
	{ mode: "distribute-x", glyph: "distributeX", labelKey: "distributeX" },
	{ mode: "distribute-y", glyph: "distributeY", labelKey: "distributeY" },
];

export function KernelInspector({ engine, strings, onInsertImage }: KernelInspectorProps) {
	const [tab, setTab] = useState<"layers" | "props">("props");
	const document = engine.document();
	const selected = engine.selectedShapes();
	const one = selected.length === 1 ? selected[0] : null;
	const lockedOnly = document.shapes.every((shape) => shape.locked);

	const patch = (next: Partial<Shape>) => engine.patchSelection(next);

	return (
		<div className="flex w-[236px] shrink-0 flex-col border-l border-[#e6e9f2] bg-white">
			<div className="flex h-9 shrink-0 items-center gap-1 border-b border-[#e6e9f2] px-2">
				{( ["props", "layers"] as const ).map((key) => (
					<button
						key={key}
						type="button"
						onClick={() => setTab(key)}
						className={
							tab === key
								? "rounded-md bg-[#eef2ff] px-2 py-1 text-[12px] font-medium text-[#2f6df6]"
								: "rounded-md px-2 py-1 text-[12px] text-[#64748b] hover:bg-[#f6f8fd]"
						}
					>
						{key === "props" ? strings.inspector : strings.layers}
					</button>
				))}
				<span className="ml-auto text-[11px] text-[#94a3b8]">
					{document.shapes.filter((shape) => !shape.locked).length} {strings.shapes}
				</span>
			</div>

			{tab === "layers" ? (
				<div className="flex-1 overflow-y-auto p-1.5">
					{lockedOnly ? (
						<p className="px-2 py-6 text-center text-[12px] leading-relaxed text-[#94a3b8]">{strings.emptyLayers}</p>
					) : (
						[...document.shapes].reverse().map((shape) => {
							const active = engine.selection().includes(shape.id);
							return (
								<button
									key={shape.id}
									type="button"
									disabled={shape.locked}
									onClick={() => engine.select([shape.id])}
									className={
										active
											? "flex w-full items-center gap-1.5 rounded-md bg-[#eef2ff] px-1.5 py-1 text-left text-[12px] text-[#2f6df6]"
											: "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] text-[#334155] hover:bg-[#f6f8fd] disabled:text-[#cbd5e1]"
									}
								>
									<KernelIcon name={shape.locked ? "lock" : shape.kind} size={13} />
									<span className="truncate">{shape.name ?? shape.kind}</span>
								</button>
							);
						})
					)}
				</div>
			) : (
				<div className="flex-1 overflow-y-auto">
					{selected.length === 0 ? (
						<div className="px-3 py-6">
							<p className="text-center text-[12px] leading-relaxed text-[#94a3b8]">{strings.emptyInspector}</p>
							<button
								type="button"
								onClick={onInsertImage}
								className="mx-auto mt-3 flex items-center gap-1.5 rounded-lg border border-[#e6e9f2] px-2.5 py-1.5 text-[12px] text-[#475569] hover:border-[#2f6df6] hover:text-[#2f6df6]"
							>
								<KernelIcon name="image" size={14} />
								{strings.importImage}
							</button>
						</div>
					) : (
						<div className="space-y-3 p-3">
							{one && (
								<>
									<div className="space-y-1.5">
										<p className="text-[11px] font-medium text-[#94a3b8]">{strings.position}</p>
										<div className="grid grid-cols-2 gap-1.5">
											<NumberField label="X" value={one.x} onChange={(x) => engine.update(one.id, { x })} />
											<NumberField label="Y" value={one.y} onChange={(y) => engine.update(one.id, { y })} />
										</div>
									</div>
									<div className="space-y-1.5">
										<p className="text-[11px] font-medium text-[#94a3b8]">{strings.size}</p>
										<div className="grid grid-cols-2 gap-1.5">
											<NumberField label="W" value={one.w} onChange={(w) => engine.update(one.id, { w })} />
											<NumberField label="H" value={one.h} onChange={(h) => engine.update(one.id, { h })} />
										</div>
									</div>
								</>
							)}

							{selected.length > 1 && (
								<div className="space-y-1.5">
									<p className="text-[11px] font-medium text-[#94a3b8]">
										{strings.selected} {selected.length}
									</p>
									<div className="grid grid-cols-4 gap-1">
										{ALIGNS.map((item) => (
											<button
												key={item.mode}
												type="button"
												title={strings[item.labelKey] as string}
												onClick={() => engine.alignSelection(item.mode)}
												className="flex h-7 items-center justify-center rounded-md border border-[#e6e9f2] text-[#475569] hover:border-[#2f6df6] hover:text-[#2f6df6]"
											>
												<KernelIcon name={item.glyph} size={14} />
											</button>
										))}
									</div>
								</div>
							)}

							{(one?.kind === "text" || ONE_TEXT(selected)) && (
								<>
									<div className="space-y-1.5">
										<p className="text-[11px] font-medium text-[#94a3b8]">{strings.text}</p>
										<textarea
											value={one?.text ?? ""}
											onChange={(event) => (one ? engine.update(one.id, { text: event.target.value }, false) : undefined)}
											rows={3}
											className="w-full resize-none rounded-md border border-[#e6e9f2] bg-white p-1.5 text-[12px] leading-relaxed text-[#0f172a] outline-none focus:border-[#2f6df6]"
										/>
									</div>
									<div className="grid grid-cols-2 gap-1.5">
										<NumberField
											label="T"
											value={one?.fontSize ?? 24}
											onChange={(fontSize) => patch({ fontSize: Math.max(6, Math.min(400, fontSize)) })}
										/>
										<NumberField
											label="W"
											value={one?.fontWeight ?? 400}
											onChange={(fontWeight) => patch({ fontWeight: Math.max(100, Math.min(900, fontWeight)) })}
										/>
									</div>
									<ColorField value={one?.color ?? "#0f172a"} onChange={(color) => patch({ color })} />
								</>
							)}

							{!ONE_TEXT(selected) && (
								<>
									<div className="space-y-1.5">
										<p className="text-[11px] font-medium text-[#94a3b8]">{strings.fill}</p>
										<ColorField value={one?.fill ?? "#2f6df6"} onChange={(fill) => patch({ fill })} />
									</div>
									<div className="space-y-1.5">
										<p className="text-[11px] font-medium text-[#94a3b8]">{strings.stroke}</p>
										<ColorField value={one?.stroke ?? "#0f172a"} onChange={(stroke) => patch({ stroke })} />
									</div>
									<div className="grid grid-cols-2 gap-1.5">
										<NumberField
											label="S"
											value={one?.strokeWidth ?? 1}
											onChange={(strokeWidth) => patch({ strokeWidth: Math.max(0, strokeWidth) })}
										/>
										<NumberField
											label="R"
											value={one?.radius ?? 0}
											onChange={(radius) => patch({ radius: Math.max(0, radius) })}
										/>
									</div>
								</>
							)}

							<div className="space-y-1">
								<div className="flex items-center justify-between text-[11px] text-[#94a3b8]">
									<span>{strings.opacity}</span>
									<span className="tabular-nums">{Math.round((one?.opacity ?? 1) * 100)}%</span>
								</div>
								<input
									type="range"
									min={0}
									max={100}
									value={Math.round((one?.opacity ?? 1) * 100)}
									onChange={(event) => patch({ opacity: Number(event.target.value) / 100 })}
									className="w-full accent-[#2f6df6]"
								/>
							</div>

							<div className="grid grid-cols-4 gap-1 border-t border-[#eef1f7] pt-2">
								{[
									{ where: "front" as const, glyph: "front", label: strings.front },
									{ where: "forward" as const, glyph: "forward", label: strings.forward },
									{ where: "backward" as const, glyph: "backward", label: strings.backward },
									{ where: "back" as const, glyph: "back", label: strings.back },
								].map((item) => (
									<button
										key={item.where}
										type="button"
										title={item.label}
										onClick={() => engine.reorderSelection(item.where)}
										className="flex h-7 items-center justify-center rounded-md border border-[#e6e9f2] text-[#475569] hover:border-[#2f6df6] hover:text-[#2f6df6]"
									>
										<KernelIcon name={item.glyph} size={14} />
									</button>
								))}
							</div>

							<div className="flex gap-1.5">
								<button
									type="button"
									onClick={() => engine.duplicateSelection()}
									className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-[#e6e9f2] text-[12px] text-[#475569] hover:border-[#2f6df6] hover:text-[#2f6df6]"
								>
									<KernelIcon name="copy" size={13} />
									{strings.duplicate}
								</button>
								<button
									type="button"
									onClick={() => engine.remove()}
									className="flex h-7 items-center justify-center gap-1 rounded-md border border-[#fecaca] px-2 text-[12px] text-[#dc2626] hover:bg-[#fef2f2]"
								>
									<KernelIcon name="trash" size={13} />
								</button>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function ONE_TEXT(shapes: readonly Shape[]): boolean {
	return shapes.length > 0 && shapes.every((shape) => shape.kind === "text");
}
