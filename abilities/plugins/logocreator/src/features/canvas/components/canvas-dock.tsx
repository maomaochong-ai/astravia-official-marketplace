import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { IconExport, IconGenerate, IconHistory, IconRaster, IconReference, IconSliders } from "../../../shared/components/icons";
import { FOCUS_RING } from "../../../shared/styles/tokens";

export interface CanvasDockProps {
	canGenerate: boolean;
	running: boolean;
	pendingNotes: number;
	inspectorOpen: boolean;
	/** Which inspector tab is showing, so the dock can reflect it. */
	inspectorTab: "design" | "notes";
	/** 唯一的生成动词：宿主图像模型出图。 */
	onGenerate: () => void;
	/** True when the host reports a usable image provider (see probeImageProviders). */
	imageAvailable: boolean;
	/** Present only when the selected design is an AI image: regenerate from it. */
	onGenerateFromReference?: () => void;
	/** 没有可用图像模型时，点生成入口直接去设置，而不是给一个点不动的灰按钮。 */
	onOpenAiSettings: () => void;
	onOpenNotes: () => void;
	onToggleInspector: () => void;
	onOpenVersions: () => void;
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
				<span
					className="absolute -right-1 -top-1 flex min-w-[14px] items-center justify-center rounded-full px-[3px] text-[9px] font-semibold leading-[14px] tabular-nums text-white"
					style={{ background: "#2563eb", boxShadow: "0 1px 3px -1px rgba(0,0,0,.4)" }}
				>
					{badge > 99 ? "99+" : badge}
				</span>
			) : null}
		</button>
	);
}

/**
 * The floating bottom dock.
 *
 * 五个动词，每个都是**不同**的动作：
 *   生成（宿主 AI 出图）· 改这一张（仅选中 AI 图时）· 版本 · 设置/备注 · 导出
 *
 * 上一版在生成按钮右侧挂了一个 ▾：那是同一条命令的变体菜单，放在一个圆角按钮条里
 * 既不对称也不协调。「每种风格各出一张」因此移进设置面板，dock 只留动词。
 *
 * Deliberately no `backdrop-blur`: the surface behind it repaints on every edit,
 * and a blur would re-read those pixels each frame.
 */
export function CanvasDock({
	canGenerate,
	running,
	pendingNotes,
	inspectorOpen,
	inspectorTab,
	onGenerate,
	imageAvailable,
	onGenerateFromReference,
	onOpenAiSettings,
	onOpenNotes,
	onToggleInspector,
	onOpenVersions,
	onOpenKit,
	canExport,
}: CanvasDockProps): JSX.Element {
	const { t } = useTranslation();

	return (
		<div className="pointer-events-none absolute bottom-3 left-1/2 z-40 -translate-x-1/2">
			<div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-end justify-center gap-1 rounded-2xl border border-border/80 bg-popover px-2 py-1.5 shadow-md">
				<DockSlot
					primary
					label={
						running
							? t("action.working")
							: !canGenerate
								? t("dock.locked")
								: imageAvailable
									? t("action.generateAi")
									: t("dock.imageOff")
					}
					title={
						!canGenerate
							? t("dock.locked")
							: imageAvailable
								? t("dock.generateHint", { engine: t("dock.engine.ai") })
								: t("notify.aiNoProvider")
					}
					disabled={running || !canGenerate}
					onClick={() => (imageAvailable ? onGenerate() : onOpenAiSettings())}
					icon={imageAvailable ? <IconGenerate /> : <IconRaster />}
				/>
				{imageAvailable && onGenerateFromReference ? (
					<DockSlot
						label={t("dock.reference")}
						disabled={running}
						onClick={onGenerateFromReference}
						icon={<IconReference />}
					/>
				) : null}
				<span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden />
				<DockSlot label={t("dock.versions")} onClick={onOpenVersions} icon={<IconHistory />} />
				<DockSlot
					label={t("dock.inspector")}
					title={t("dock.settingsHint")}
					active={inspectorOpen}
					badge={pendingNotes}
					onClick={() => (inspectorOpen ? onToggleInspector() : pendingNotes > 0 ? onOpenNotes() : onToggleInspector())}
					icon={<IconSliders />}
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
