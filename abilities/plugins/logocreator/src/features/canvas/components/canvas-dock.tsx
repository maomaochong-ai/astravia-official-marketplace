import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { IconExport, IconGenerate, IconNote, IconRaster, IconReference, IconShuffle, IconSliders } from "../../../shared/components/icons";
import { FOCUS_RING } from "../../../shared/styles/tokens";

export interface CanvasDockProps {
	canGenerate: boolean;
	running: boolean;
	mode: "local" | "ai";
	pendingNotes: number;
	inspectorOpen: boolean;
	/** Which inspector tab is showing, so the dock can reflect it. */
	inspectorTab: "design" | "notes";
	onGenerate: () => void;
	onSurprise: () => void;
	/** True when the host reports a usable image provider (see probeImageProviders). */
	imageAvailable: boolean;
	/** Runs the raster path in-panel: the same work the agent does via the tool. */
	onGenerateImage: () => void;
	/** Present only when the selected design is an AI image: regenerate from it. */
	onGenerateFromReference?: () => void;
	/** 没有可用图像模型时，点 AI 入口直接去设置，而不是给一个点不动的灰按钮。 */
	onOpenAiSettings: () => void;
	onOpenNotes: () => void;
	onToggleInspector: () => void;
	onOpenKit: () => void;
	/** 只有选中了一张稿才能导出；否则按钮点下去什么也不会发生。 */
	canExport: boolean;
}

interface SlotProps {
	label: string;
	/** 悬停提示；与 label 不同时用来补充「为什么是这个状态」。 */
	title?: string;
	icon: JSX.Element;
	onClick: () => void;
	active?: boolean;
	disabled?: boolean;
	badge?: number;
	/** The one primary verb gets the filled treatment. */
	primary?: boolean;
}

function DockSlot({ label, title, icon, onClick, active, disabled, badge, primary }: SlotProps): JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-pressed={active}
			aria-label={label}
			title={title ?? label}
			className={`${FOCUS_RING} relative flex size-8 shrink-0 items-center justify-center rounded-[22%] border border-transparent transition-colors ${
				primary
					? "bg-primary text-primary-foreground hover:opacity-90"
					: active
						? "bg-primary/12 text-primary"
						: "bg-muted/55 text-foreground hover:bg-muted"
			} disabled:pointer-events-none disabled:opacity-40`}
		>
			{icon}
			{badge !== undefined && badge > 0 ? (
				<span className="absolute -right-1 -top-1 flex min-w-[14px] items-center justify-center rounded-full px-[3px] text-[9px] font-semibold leading-[14px] tabular-nums text-white"
						style={{ background: "#2563eb", boxShadow: "0 1px 3px -1px rgba(0,0,0,.4)" }}>
					{badge > 99 ? "99+" : badge}
				</span>
			) : null}
		</button>
	);
}

/**
 * The floating bottom dock — the reference canvas's control bar, one surface lower.
 *
 * Why a dock instead of a column of buttons: this panel is 400–600 px wide and the
 * art has to stay visible while you act on it. A dock pins the four verbs a user
 * actually repeats (generate, re-roll, inspect, notes) inside the canvas viewport,
 * and the label appears on hover so the icons stay dense.
 *
 * 主按钮的文案**不再随引擎变**：它执行的是「用当前引擎跑一遍」，两个引擎共用同一个动词。
 * 上一版在 `Design logos` / `Generate with AI` 之间切换，看起来像两个功能，点下去却是同一段
 * 代码，用户没法预判这次会不会扣费。现在引擎写在悬停提示里，AI 只留 Image mark 一个入口。
 *
 * Deliberately no `backdrop-blur`: the surface behind it repaints on every edit,
 * and a blur would re-read those pixels each frame.
 */
export function CanvasDock({
	canGenerate,
	running,
	mode,
	imageAvailable,
	onGenerateFromReference,
	onGenerateImage,
	onOpenAiSettings,
	pendingNotes,
	inspectorOpen,
	inspectorTab,
	onGenerate,
	onSurprise,
	onOpenNotes,
	onToggleInspector,
	onOpenKit,
	canExport,
}: CanvasDockProps): JSX.Element {
	const { t } = useTranslation();
	const engine = t(mode === "ai" ? "dock.engine.ai" : "dock.engine.local");

	return (
		<div className="pointer-events-none absolute bottom-3 left-1/2 z-40 -translate-x-1/2">
			<div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-end justify-center gap-1 rounded-2xl border border-border/80 bg-popover px-2 py-1.5 shadow-md">
				<DockSlot
					primary
					label={running ? t("action.working") : canGenerate ? t("action.generate") : t("dock.locked")}
					title={canGenerate ? t("dock.generateHint", { engine }) : t("dock.locked")}
					disabled={running || !canGenerate}
					onClick={onGenerate}
					icon={<IconGenerate />}
				/>
				{/*
				 * 图像模型没连上时按钮仍然在：把它藏起来，用户既发现不了 AI 能力，
				 * 也不知道为什么没有。点一下直接去设置，设置里写着下一步做什么。
				 */}
				<DockSlot
					label={imageAvailable ? t("dock.image") : t("dock.imageOff")}
					title={imageAvailable ? t("dock.imageHint") : t("notify.aiNoProvider")}
					disabled={imageAvailable && (running || !canGenerate)}
					onClick={() => (imageAvailable ? onGenerateImage() : onOpenAiSettings())}
					icon={<IconRaster />}
				/>
				{imageAvailable && onGenerateFromReference ? (
					// 「改这一张」：面板里的 image-to-image。以前只有对话里的工具能做，
					// 而用户看着画布想改的时机比在对话里多。
					<DockSlot
						label={t("dock.reference")}
						disabled={running}
						onClick={onGenerateFromReference}
						icon={<IconReference />}
					/>
				) : null}
				<DockSlot
					label={t("action.surprise")}
					title={t("dock.surpriseHint")}
					disabled={running || !canGenerate}
					onClick={onSurprise}
					icon={<IconShuffle />}
				/>
				<span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden />
				<DockSlot
					label={t("dock.inspector")}
					active={inspectorOpen && inspectorTab === "design"}
					onClick={onToggleInspector}
					icon={<IconSliders />}
				/>
				<DockSlot
					label={t("dock.notes")}
					active={inspectorOpen && inspectorTab === "notes"}
					badge={pendingNotes}
					onClick={onOpenNotes}
					icon={<IconNote />}
				/>
				<DockSlot
					label={canExport ? t("dock.export") : t("dock.exportOff")}
					title={canExport ? t("dock.exportHint") : t("dock.exportOff")}
					disabled={!canExport}
					onClick={onOpenKit}
					icon={<IconExport />}
				/>
			</div>
		</div>
	);
}
