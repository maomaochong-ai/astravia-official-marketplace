import { useEffect, useRef, useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { IconExport, IconGenerate, IconHistory, IconNote, IconRaster, IconReference, IconShuffle, IconSliders } from "../../../shared/components/icons";
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
 * The floating bottom dock — the reference canvas's control bar, one surface lower.
 *
 * 收敛成 5 个动词（上一版 7 个，其中三处是同一个动作的变体）：
 *
 *   生成 ┬ 设计标志（当前引擎）
 *        └ 惊喜我（每种风格各出一张）   ← 同一个函数，只差一个选项，收进下拉
 *   位图（AI）—— 没连模型时点它直接去设置
 *   改这一张 —— 仅当选中一张 AI 稿时出现（image-to-image）
 *   版本 —— 磁盘上设计包的版本清单
 *   设置 —— 设计参数 / 画布备注两个 tab（原来占两个按钮位）
 *   导出 —— 未选中稿时禁用
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
	onOpenVersions,
	onOpenKit,
	canExport,
}: CanvasDockProps): JSX.Element {
	const { t } = useTranslation();
	const engine = t(mode === "ai" ? "dock.engine.ai" : "dock.engine.local");
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement | null>(null);

	// 点外面/按 Esc 收起生成菜单：一个浮层留在画布上会挡住稿。
	useEffect(() => {
		if (!menuOpen) return;
		const onDown = (event: MouseEvent): void => {
			if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
		};
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") setMenuOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [menuOpen]);

	return (
		<div className="pointer-events-none absolute bottom-3 left-1/2 z-40 -translate-x-1/2">
			<div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-end justify-center gap-1 rounded-2xl border border-border/80 bg-popover px-2 py-1.5 shadow-md">
				<div ref={menuRef} className="relative flex items-end gap-0.5">
					<DockSlot
						primary
						label={running ? t("action.working") : canGenerate ? t("action.generate") : t("dock.locked")}
						title={canGenerate ? t("dock.generateHint", { engine }) : t("dock.locked")}
						disabled={running || !canGenerate}
						onClick={onGenerate}
						icon={<IconGenerate />}
					/>
					{/* 下拉箭头：把「惊喜我」这类同函数变体收进一个入口。 */}
					<button
						type="button"
						aria-haspopup="menu"
						aria-expanded={menuOpen}
						aria-label={t("dock.moreWays")}
						title={t("dock.moreWays")}
						disabled={running || !canGenerate}
						onClick={() => setMenuOpen((open) => !open)}
						className={`${FOCUS_RING} flex h-6 w-4 items-center justify-center rounded text-[9px] text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40`}
					>
						▾
					</button>
					{menuOpen ? (
						<div
							role="menu"
							className="absolute bottom-full left-0 mb-1 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg"
						>
							<button
								type="button"
								role="menuitem"
								onClick={() => {
									setMenuOpen(false);
									onGenerate();
								}}
								className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] text-foreground hover:bg-muted"
							>
								<IconGenerate />
								<span className="min-w-0 flex-1 truncate">{t("action.generate")}</span>
								<span className="shrink-0 text-[9px] text-muted-foreground">{engine}</span>
							</button>
							<button
								type="button"
								role="menuitem"
								onClick={() => {
									setMenuOpen(false);
									onSurprise();
								}}
								className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] text-foreground hover:bg-muted"
							>
								<IconShuffle />
								<span className="min-w-0 flex-1 truncate">{t("action.surprise")}</span>
								<span className="shrink-0 text-[9px] text-muted-foreground">{t("dock.surpriseShort")}</span>
							</button>
						</div>
					) : null}
				</div>

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
					// 「改这一张」：面板里的 image-to-image，只在选中 AI 稿时出现。
					<DockSlot
						label={t("dock.reference")}
						disabled={running}
						onClick={onGenerateFromReference}
						icon={<IconReference />}
					/>
				) : null}
				<span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden />
				<DockSlot label={t("dock.versions")} onClick={onOpenVersions} icon={<IconHistory />} />
				{/*
				 * 设置与备注合并成一个入口：同一个 rail、两个 tab，占两个按钮位只是重复。
				 * 有待交备注时点它直接进备注 tab，否则进设计参数。
				 */}
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
